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

from typing import Annotated, Any, Dict, List, Optional
import operator

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.tools import BaseTool
from typing import TypedDict

from app.models.agent import Agent
from app.models.llm_config import LLMConfig
from app.models.tool import Tool, ToolType
from app.services.llm_service import _build_llm


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
            from langchain_community.tools import DuckDuckGoSearchRun
            return DuckDuckGoSearchRun()

        elif name == "wikipedia":
            from langchain_community.tools import WikipediaQueryRun
            from langchain_community.utilities import WikipediaAPIWrapper
            return WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper())

        elif name == "python_repl":
            from langchain_experimental.tools import PythonREPLTool
            return PythonREPLTool()

    except ImportError as exc:
        print(f"[graph_builder] Could not import builtin tool '{name}': {exc}")

    return None


# ── Graph builder ─────────────────────────────────────────────────────────────

def build_agent_graph(
    agent: Agent,
    llm_config: Optional[LLMConfig],
    db_tools: List[Tool],
    override_params: Dict[str, Any] = {},
) -> StateGraph:
    """
    Assembles and compiles the LangGraph agent workflow.

    Args:
        agent          → the Agent DB row (has system_prompt, max_iterations, etc.)
        llm_config     → the LLMConfig DB row (has provider, model, api_key, etc.)
        db_tools       → list of Tool DB rows the agent is allowed to use
        override_params → optional runtime param overrides (e.g. temperature)

    Returns:
        A compiled LangGraph StateGraph ready to call .invoke() or .astream() on.
    """

    # ── Build the LLM ─────────────────────────────────────────────────────────
    if llm_config:
        llm = _build_llm(llm_config)
    else:
        # Fallback: read OPENAI_API_KEY from environment
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

    # ── Convert DB tools to LangChain tools ───────────────────────────────────
    tools     = _build_tools(db_tools)
    tool_node = ToolNode(tools) if tools else None

    # Bind tools to the LLM so it knows it can call them
    # When tools are bound, the LLM response may include tool_calls
    llm_with_tools = llm.bind_tools(tools) if tools else llm

    # ── System prompt ─────────────────────────────────────────────────────────
    system_prompt = (
        agent.system_prompt
        or "You are a helpful AI assistant. Complete the user's task step by step."
    )

    # ── Node: agent ───────────────────────────────────────────────────────────
    # This node calls the LLM with the full message history.
    # It either returns a final answer or tool_calls (asking to run a tool).
    def call_agent(state: AgentState) -> AgentState:
        messages = state["messages"]
        # Add the system prompt at the start if it isn't already there
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=system_prompt)] + messages
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    # ── Edge: should we call a tool, or are we done? ──────────────────────────
    # If the LLM returned tool_calls → route to "tools" node
    # If the LLM returned a plain text answer → route to END
    def should_continue(state: AgentState) -> str:
        last_message = state["messages"][-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
        return "end"

    # ── Assemble the graph ────────────────────────────────────────────────────
    workflow = StateGraph(AgentState)
    workflow.add_node("agent", call_agent)

    if tool_node:
        workflow.add_node("tools", tool_node)
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
    else:
        # No tools available — agent always goes straight to END
        workflow.add_edge("agent", END)

    workflow.set_entry_point("agent")
    return workflow.compile()