# PATH: backend/app/agent_runner/graph_builder.py
#
# PURPOSE:
#   Builds and compiles a LangGraph ReAct-style agent graph.
#   This is the core AI execution logic — used by both:
#     - agent_service.py  (dry runs, runs in-process)
#     - run_agent.py      (real task runs, inside a Docker container)
#
# HOW THE GRAPH WORKS:
#   The graph has two nodes:
#     "agent" → calls the LLM with current message history
#     "tools" → executes whatever tool the LLM chose to call
#
#   Flow:
#     START
#       → agent  (LLM decides: answer now, or call a tool?)
#       → if tool_calls present → tools → back to agent
#       → if no tool_calls      → END
#
#   This loop is the "ReAct" pattern (Reason + Act).
#   The agent reasons about the problem, acts by calling tools,
#   sees the result, reasons again, until it has a final answer.

from __future__ import annotations
from typing import Annotated, Any, Dict, List, Optional
import operator

from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, SystemMessage, ToolMessage, HumanMessage
from langchain_core.tools import BaseTool
from langchain_community.tools import DuckDuckGoSearchResults, WikipediaQueryRun
from langchain_community.utilities import WikipediaAPIWrapper
from langchain_experimental.tools import PythonREPLTool
from typing import TypedDict

from app.models.agent import Agent
from app.models.llm_config import LLMConfig
from app.models.tool import Tool, ToolType
from app.models.skill import Skill
from app.services.llm_service import _build_llm

#── Local tool implementations ─────────────────────────────────────────────
from app.agent_runner.tools.web_scraper_tool import WebScraperTool
from app.agent_runner.tools.code_tester_tool import CodeTesterTool

# ── Constants ─────────────────────────────────────────────────────────────────
MAX_TOOL_RESULT_CHARS = 3000   # cap each individual tool response
MAX_HISTORY_MESSAGES  = 12     # keep only the N most recent messages (+ system prompt)


# ── Shared state ──────────────────────────────────────────────────────────────
# Every node reads from and writes to this state dict.
# The `messages` list grows as the conversation progresses —
# each node appends its output using the + (operator.add) reducer.

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]


# ── Tool conversion ───────────────────────────────────────────────────────────

def _build_tools(db_tools: List[Tool]) -> List[BaseTool]:
    """
    Converts DB Tool rows into LangChain BaseTool objects the LLM can call.

    Three types are handled:
      builtin  → pre-packaged tools (web_search, wikipedia, python_repl)
      api      → wraps an HTTP endpoint as a callable tool
      custom   → executes user-written Python code that returns a BaseTool
    """
    lc_tools = []

    for db_tool in db_tools:

        if db_tool.tool_type == ToolType.builtin:
            result = _get_builtin_tool(db_tool.name)
            if result:
                lc_tools.append(result)

        elif db_tool.tool_type == ToolType.api and db_tool.endpoint_url:
            # Wrap the HTTP endpoint as a LangChain tool
            # Each tool gets its own closure to avoid the loop-variable bug
            def _make_api_tool(t: Tool) -> BaseTool:
                import httpx
                from langchain_core.tools import tool as lc_tool

                @lc_tool(t.name, description=t.description or t.name)
                def _api_call(input: str) -> str:
                    """Calls the configured HTTP endpoint with the given input."""
                    response = httpx.request(
                        method=t.http_method or "POST",
                        url=t.endpoint_url,
                        headers=t.headers or {},
                        json={"input": input},
                        timeout=30,
                    )
                    return response.text

                return _api_call

            lc_tools.append(_make_api_tool(db_tool))

        elif db_tool.tool_type == ToolType.custom and db_tool.source_code:
            # Execute the user's Python source code.
            # The code must define a get_tool() function that returns a BaseTool.
            # WARNING: In production, run this inside a sandbox (RestrictedPython / Docker).
            try:
                namespace: Dict[str, Any] = {}
                exec(db_tool.source_code, namespace)  # noqa: S102
                if "get_tool" in namespace:
                    result = namespace["get_tool"]()
                    if result is not None:
                        lc_tools.append(result)
            except Exception as exc:
                print(f"[graph_builder] Failed to load custom tool '{db_tool.name}': {exc}")

    return lc_tools


def _get_builtin_tool(name: str) -> Optional[BaseTool]:
    """Maps a built-in tool name to a LangChain community tool instance."""
    try:
        if name == "web_search":
            from langchain_core.tools import tool

            @tool
            def duckduckgo_search(query: str) -> str:
                """Search the web using DuckDuckGo for current information.
                Use this tool to find recent news, articles, and web content."""
                try:
                    from langchain_community.tools import DuckDuckGoSearchRun
                    search_tool = DuckDuckGoSearchRun()
                    result = search_tool.run(query)
                    return result if result else "No search results found."
                except Exception as e:
                    return f"Search failed: {str(e)}"

            return duckduckgo_search

        elif name == "wikipedia":
            from langchain_core.tools import tool

            @tool
            def wikipedia_search(query: str) -> str:
                """Search Wikipedia for encyclopedic knowledge and detailed articles.
                Use this for factual information, historical context, and reference material."""
                try:
                    from langchain_community.tools import WikipediaQueryRun
                    from langchain_community.utilities import WikipediaAPIWrapper
                    wiki_tool = WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper())
                    result = wiki_tool.run(query)
                    return result if result else "No Wikipedia results found."
                except Exception as e:
                    return f"Wikipedia search failed: {str(e)}"

            return wikipedia_search

        elif name == "python_repl":
            from langchain_experimental.tools import PythonREPLTool
            tool = PythonREPLTool()
            tool.name = "python_repl"
            tool.description = "Execute Python code for calculations, data analysis, and programming tasks."
            return tool

        elif name == "web_scraper":
            try:
                from app.agent_runner.tools.web_scraper_tool import WebScraperTool
                return WebScraperTool
            except Exception as exc:
                print(f"[graph_builder] web_scraper failed to load: {exc}")
                return None

        elif name == "code_tester":
            try:
                from app.agent_runner.tools.code_tester_tool import CodeTesterTool
                return CodeTesterTool
            except Exception as exc:
                print(f"[graph_builder] code_tester failed to load: {exc}")
                return None

    except ImportError as exc:
        print(f"[graph_builder] Could not import builtin tool '{name}': {exc}")

    return None


# ── Graph builder ─────────────────────────────────────────────────────────────

def build_agent_graph(
    agent: Agent,
    llm_config: Optional[LLMConfig],
    db_tools: List[Tool],
    db_skills: List[Skill],
    override_params: Dict[str, Any] = {},
) -> StateGraph:
    """
    Assembles and compiles the LangGraph agent workflow.

    Args:
        agent          → the Agent DB row (has system_prompt, max_iterations, etc.)
        llm_config     → the LLMConfig DB row (has provider, model, api_key, etc.)
        db_tools       → list of Tool DB rows the agent is allowed to use
        db_skills      → list of Skill DB rows to inject into the system prompt
        override_params → optional runtime param overrides (e.g. temperature)

    Returns:
        A compiled LangGraph StateGraph ready to call .invoke() or .astream() on.
    """

    # ── Build the LLM ─────────────────────────────────────────────────────────
    if llm_config:
        llm = _build_llm(llm_config)
        # Check if this is Groq - it may have tool calling issues
        is_groq = llm_config.provider.lower() == "groq"
    else:
        # Fallback: read OPENAI_API_KEY from environment
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
        is_groq = False

    # ── Convert DB tools to LangChain tools ───────────────────────────────────
    tools     = _build_tools(db_tools)

    # Standard tool executor for non-Groq LLMs that support tool calling
    def standard_tool_executor(state: AgentState) -> AgentState:
        """Execute a tool call generated by the LLM."""
        last_message = state["messages"][-1]
        
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            tool_results = []
            for tool_call in last_message.tool_calls:
                tool_name  = tool_call.get("name") or tool_call.get("type")
                tool_input = tool_call.get("args") or {}
                tool_id    = tool_call.get("id")
                
                tool_obj = next((t for t in tools if t.name == tool_name), None)
                
                if tool_obj:
                    try:
                        if hasattr(tool_obj, 'invoke'):
                            result = tool_obj.invoke(tool_input)
                        elif hasattr(tool_obj, 'run'):
                            if isinstance(tool_input, dict) and len(tool_input) == 1:
                                result = tool_obj.run(list(tool_input.values())[0])
                            else:
                                result = tool_obj.run(str(tool_input))
                        else:
                            result = f"Tool {tool_name} has no executable method"

                        # Truncate large responses so they don't blow the context window
                        result_str = str(result)
                        if len(result_str) > MAX_TOOL_RESULT_CHARS:
                            result_str = result_str[:MAX_TOOL_RESULT_CHARS] + f"\n... [truncated — {len(result_str)} chars total]"

                        tool_results.append(ToolMessage(
                            content=result_str,
                            tool_call_id=tool_id or f"{tool_name}_{len(state['messages'])}",
                            name=tool_name,
                        ))
                    except Exception as e:
                        tool_results.append(ToolMessage(
                            content=f"Tool execution failed: {str(e)}",
                            tool_call_id=tool_id or f"{tool_name}_error_{len(state['messages'])}",
                            name=tool_name,
                            is_error=True,
                        ))
                else:
                    tool_results.append(ToolMessage(
                        content=f"Tool '{tool_name}' not found. Available tools: {[t.name for t in tools]}",
                        tool_call_id=tool_id or f"{tool_name}_notfound_{len(state['messages'])}",
                        name=tool_name,
                        is_error=True,
                    ))
            
            return {"messages": tool_results}
        
        return {"messages": []}

    # For Groq, create a custom tool execution function
    def groq_tool_executor(state: AgentState) -> AgentState:
        """Execute a tool call in Groq's custom format: TOOL: tool_name parameters"""
        last_message = state["messages"][-1]
        content = last_message.content.strip()

        # Parse TOOL: tool_name parameters
        if content.upper().startswith("TOOL:"):
            tool_call = content[5:].strip()  # Remove "TOOL:"
            parts = tool_call.split(None, 1)  # Split on first space
            if len(parts) >= 1:
                tool_name = parts[0]
                params = parts[1] if len(parts) > 1 else ""

                # Find the tool
                tool = next((t for t in tools if t.name == tool_name), None)
                if tool:
                    try:
                        if hasattr(tool, 'invoke'):
                            result = tool.invoke({"query": params} if params else {})
                        elif hasattr(tool, 'run'):
                            result = tool.run(params if params else "")
                        else:
                            result = f"Tool {tool_name} found but no invoke/run method"

                        result_str = str(result)
                        if len(result_str) > MAX_TOOL_RESULT_CHARS:
                            result_str = result_str[:MAX_TOOL_RESULT_CHARS] + f"\n... [truncated — {len(result_str)} chars total]"

                        tool_message = ToolMessage(
                            content=result_str,
                            tool_call_id=f"{tool_name}_{len(state['messages'])}",
                            name=tool_name,
                        )
                        return {"messages": [tool_message]}
                    except Exception as e:
                        error_msg = f"Tool execution failed: {str(e)}"
                        tool_message = ToolMessage(
                            content=error_msg,
                            tool_call_id=f"{tool_name}_error_{len(state['messages'])}",
                            name=tool_name,
                            is_error=True
                        )
                        return {"messages": [tool_message]}
                else:
                    error_msg = f"Tool '{tool_name}' not found. Available tools: {[t.name for t in tools]}"
                    from langchain_core.messages import AIMessage
                    return {"messages": [AIMessage(content=error_msg)]}
            else:
                error_msg = "Invalid tool format. Use: TOOL: <tool_name> <parameters>"
                from langchain_core.messages import AIMessage
                return {"messages": [AIMessage(content=error_msg)]}
        else:
            # Not a tool call, pass through
            return {"messages": [last_message]}

    # Bind tools to the LLM so it knows it can call them
    # When tools are bound, the LLM response may include tool_calls
    # Skip tool binding for Groq due to compatibility issues
    if tools and not is_groq:
        llm_with_tools = llm.bind_tools(tools)
    else:
        llm_with_tools = llm

    # ── System prompt ─────────────────────────────────────────────────────────
    system_prompt = (
        agent.system_prompt
        or "You are a helpful AI assistant. Complete the user's task step by step."
    )

    # Inject skill instructions into the system prompt
    if db_skills:
        skill_instructions = "\n\n".join([
            f"## Skill: {skill.name}\n{skill.system_instruction}"
            for skill in db_skills
        ])
        system_prompt += f"\n\n### Behavioral Skills\n\nThe following behavioral instructions guide how you should approach tasks:\n\n{skill_instructions}"

    # For Groq, add tool instructions to the system prompt since we can't bind tools
    if is_groq and tools:
        tool_descriptions = "\n".join([
            f"- {tool.name}: {tool.description}"
            for tool in tools
        ])
        system_prompt += f"\n\nYou have access to the following tools:\n{tool_descriptions}\n\nTo use a tool, respond with: TOOL: <tool_name> <parameters>\nFor example: TOOL: duckduckgo_search current weather"

    # ── Node: agent ───────────────────────────────────────────────────────────
    # This node calls the LLM with the full message history.
    # It either returns a final answer or tool_calls (asking to run a tool).
    def call_agent(state: AgentState) -> AgentState:
        messages = state["messages"]

        # Add the system prompt at the start if it isn't already there
        system_msg = SystemMessage(content=system_prompt)
        non_system = [m for m in messages if not isinstance(m, SystemMessage)]

        # Keep only the most recent messages to avoid token limit errors.
        # Always preserve: system prompt + first human message + recent history.
        if len(non_system) > MAX_HISTORY_MESSAGES:
            # Keep the first message (original user prompt) + the most recent tail
            trimmed = [non_system[0]] + non_system[-(MAX_HISTORY_MESSAGES - 1):]
        else:
            trimmed = non_system

        response = llm_with_tools.invoke([system_msg] + trimmed)
        return {"messages": [response]}

    # ── Edge: should we call a tool, or are we done? ──────────────────────────
    # If the LLM returned tool_calls → route to "tools" node
    # If the LLM returned a plain text answer → route to END
    def should_continue(state: AgentState) -> str:
        last_message = state["messages"][-1]
        # Check for standard tool_calls (for non-Groq LLMs)
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
        # Check for custom tool format (for Groq)
        if hasattr(last_message, "content") and isinstance(last_message.content, str):
            if last_message.content.strip().upper().startswith("TOOL:"):
                return "tools"
        return "end"

    # ── Assemble the graph ────────────────────────────────────────────────────
    workflow = StateGraph(AgentState)
    workflow.add_node("agent", call_agent)

    if tools and not is_groq:
        # Use standard tool executor for non-Groq LLMs
        workflow.add_node("tools", standard_tool_executor)
        workflow.add_conditional_edges(
            "agent",
            should_continue,
            {
                "tools": "tools",  # LLM wants to call a tool → go to tools node
                "end":   END,      # LLM has a final answer   → stop
            },
        )
        # After the tool runs, go back to agent so it can see the tool result
        workflow.add_edge("tools", "agent")
    elif tools and is_groq:
        # Use custom tool executor for Groq
        workflow.add_node("tools", groq_tool_executor)
        workflow.add_conditional_edges(
            "agent",
            should_continue,
            {
                "tools": "tools",  # LLM wants to call a tool → go to custom executor
                "end":   END,      # LLM has a final answer   → stop
            },
        )
        # After the tool runs, go back to agent so it can see the tool result
        workflow.add_edge("tools", "agent")
    else:
        # No tools available — agent always goes straight to END
        workflow.add_edge("agent", END)

    workflow.set_entry_point("agent")
    return workflow.compile()