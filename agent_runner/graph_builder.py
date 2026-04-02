# PATH: agent_runner/graph_builder.py
#
# PURPOSE:
#   Docker-compatible version of graph_builder for running agents in containers.
#   This is designed to work with SimpleNamespace objects created in run_agent.py
#   and does NOT import from app.models or app.services.
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

from __future__ import annotations
from typing import Annotated, Any, Dict, List, Optional
import operator

from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, SystemMessage, ToolMessage, HumanMessage
from langchain_core.tools import BaseTool
from typing import TypedDict


# ── Shared state ──────────────────────────────────────────────────────────────
class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]


# ── Tool conversion ───────────────────────────────────────────────────────────

def _build_tools(db_tools: List[Any]) -> List[BaseTool]:
    """
    Converts tool objects (SimpleNamespace from Docker) into LangChain BaseTool objects.
    
    Three types are handled:
      builtin  → pre-packaged tools (web_search, wikipedia, python_repl)
      api      → wraps an HTTP endpoint as a callable tool
      custom   → executes user-written Python code that returns a BaseTool
    """
    lc_tools = []

    for db_tool in db_tools:
        tool_type = getattr(db_tool, "tool_type", "builtin")

        if tool_type == "builtin":
            result = _get_builtin_tool(db_tool.name)
            if result:
                lc_tools.append(result)

        elif tool_type == "api" and getattr(db_tool, "endpoint_url", None):
            # Wrap the HTTP endpoint as a LangChain tool
            def _make_api_tool(t: Any) -> BaseTool:
                import httpx
                from langchain_core.tools import tool as lc_tool

                @lc_tool(t.name, description=getattr(t, "description", t.name))
                def _api_call(input: str) -> str:
                    """Calls the configured HTTP endpoint with the given input."""
                    response = httpx.request(
                        method=getattr(t, "http_method", "POST"),
                        url=t.endpoint_url,
                        headers=getattr(t, "headers", {}),
                        json={"input": input},
                        timeout=30,
                    )
                    return response.text

                return _api_call

            lc_tools.append(_make_api_tool(db_tool))

        elif tool_type == "custom" and getattr(db_tool, "source_code", None):
            # Execute the user's Python source code
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
            from langchain_core.tools import tool
            import httpx
            from bs4 import BeautifulSoup

            @tool
            def web_scraper(url: str) -> str:
                """Scrape content from a web page and extract text.
                Use this to retrieve and analyze content from web pages."""
                try:
                    response = httpx.get(url, timeout=10)
                    response.raise_for_status()
                    soup = BeautifulSoup(response.text, "html.parser")
                    
                    # Remove script and style tags
                    for script in soup(["script", "style"]):
                        script.decompose()
                    
                    text = soup.get_text()
                    lines = (line.strip() for line in text.splitlines())
                    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                    text = "\n".join(chunk for chunk in chunks if chunk)
                    
                    return text[:5000]  # Return first 5000 chars
                except Exception as e:
                    return f"Web scraping failed: {str(e)}"

            return web_scraper

        elif name == "code_tester":
            from langchain_core.tools import tool

            @tool
            def code_tester(code: str) -> str:
                """Test Python code and return the output.
                Use this to validate code snippets before deployment."""
                try:
                    import subprocess
                    result = subprocess.run(
                        ["python", "-c", code],
                        capture_output=True,
                        text=True,
                        timeout=10
                    )
                    output = result.stdout or result.stderr
                    return output if output else "Code executed successfully with no output"
                except Exception as e:
                    return f"Code execution failed: {str(e)}"

            return code_tester

    except ImportError as exc:
        print(f"[graph_builder] Could not import builtin tool '{name}': {exc}")

    return None


def _build_llm(llm_config: Any) -> Any:
    """
    Builds an LLM instance from configuration.
    
    Args:
        llm_config: SimpleNamespace with provider, model, api_key, etc.
    
    Returns:
        A LangChain LLM instance
    """
    provider = llm_config.provider.lower()
    model = llm_config.model

    # Build provider-specific LLM
    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            api_key=getattr(llm_config, "api_key", None),
            temperature=getattr(llm_config, "temperature", 0.7),
            max_tokens=getattr(llm_config, "max_tokens", 2048),
            top_p=getattr(llm_config, "top_p", 1.0),
        )
    
    elif provider == "anthropic":
        try:
            from langchain_anthropic import ChatAnthropic  # type: ignore
            return ChatAnthropic(
                model=model,
                api_key=getattr(llm_config, "api_key", None),
                temperature=getattr(llm_config, "temperature", 0.7),
                max_tokens=getattr(llm_config, "max_tokens", 2048),
            )
        except ImportError:
            print("[graph_builder] Warning: langchain_anthropic not installed, falling back to OpenAI")
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model="gpt-4o-mini",
                api_key=getattr(llm_config, "api_key", None),
                temperature=0.7,
            )
    
    elif provider == "groq":
        try:
            from langchain_groq import ChatGroq  # type: ignore
            return ChatGroq(
                model=model,
                api_key=getattr(llm_config, "api_key", None),
                temperature=getattr(llm_config, "temperature", 0.7),
            )
        except ImportError:
            print("[graph_builder] Warning: langchain_groq not installed, falling back to OpenAI")
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model="gpt-4o-mini",
                api_key=getattr(llm_config, "api_key", None),
                temperature=0.7,
            )
    
    elif provider == "ollama":
        try:
            from langchain_ollama import ChatOllama  # type: ignore
            base_url = getattr(llm_config, "api_base_url", "http://localhost:11434")
            return ChatOllama(
                model=model,
                base_url=base_url,
                temperature=getattr(llm_config, "temperature", 0.7),
            )
        except ImportError:
            print("[graph_builder] Warning: langchain_ollama not installed, falling back to OpenAI")
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
    
    elif provider == "azure":
        try:
            from langchain_openai import AzureChatOpenAI  # type: ignore
            return AzureChatOpenAI(
                model=model,
                api_key=getattr(llm_config, "api_key", None),
                api_version="2024-02-15-preview",
                azure_endpoint=getattr(llm_config, "api_base_url", ""),
                temperature=getattr(llm_config, "temperature", 0.7),
            )
        except ImportError:
            print("[graph_builder] Warning: Azure OpenAI setup failed, falling back to OpenAI")
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model="gpt-4o-mini",
                api_key=getattr(llm_config, "api_key", None),
                temperature=0.7,
            )
    
    else:
        # Fallback to OpenAI
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model="gpt-4o-mini",
            api_key=getattr(llm_config, "api_key", None),
            temperature=0.7,
        )


# ── Graph builder ─────────────────────────────────────────────────────────────

def build_agent_graph(
    agent: Any,
    llm_config: Optional[Any],
    db_tools: List[Any],
    db_skills: List[Any],
    override_params: Dict[str, Any] = {},
) -> StateGraph:
    """
    Assembles and compiles the LangGraph agent workflow.
    
    Args:
        agent          → the Agent object (SimpleNamespace in Docker)
        llm_config     → the LLMConfig object (SimpleNamespace in Docker)
        db_tools       → list of Tool objects
        db_skills      → list of Skill objects
        override_params → optional runtime param overrides
    
    Returns:
        A compiled LangGraph StateGraph ready to call .invoke() or .astream() on.
    """

    # ── Build the LLM ─────────────────────────────────────────────────────────
    if llm_config:
        llm = _build_llm(llm_config)
        # Check if this is Groq
        is_groq = llm_config.provider.lower() == "groq"
    else:
        # Fallback to OpenAI
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
        is_groq = False

    # ── Convert DB tools to LangChain tools ───────────────────────────────────
    tools = _build_tools(db_tools)

    # Standard tool executor for non-Groq LLMs
    def standard_tool_executor(state: AgentState) -> AgentState:
        """Execute a tool call generated by the LLM."""
        last_message = state["messages"][-1]
        
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            tool_results = []
            for tool_call in last_message.tool_calls:
                tool_name = tool_call.get("name") or tool_call.get("type")
                tool_input = tool_call.get("args") or {}
                tool_id = tool_call.get("id")
                
                tool = next((t for t in tools if t.name == tool_name), None)
                
                if tool:
                    try:
                        if hasattr(tool, 'invoke'):
                            result = tool.invoke(tool_input)
                        elif hasattr(tool, 'run'):
                            if isinstance(tool_input, dict) and len(tool_input) == 1:
                                result = tool.run(list(tool_input.values())[0])
                            else:
                                result = tool.run(str(tool_input))
                        else:
                            result = f"Tool {tool_name} has no executable method"
                        
                        tool_results.append(ToolMessage(
                            content=str(result),
                            tool_call_id=tool_id or f"{tool_name}_{len(state['messages'])}",
                            name=tool_name
                        ))
                    except Exception as e:
                        tool_results.append(ToolMessage(
                            content=f"Tool execution failed: {str(e)}",
                            tool_call_id=tool_id or f"{tool_name}_error_{len(state['messages'])}",
                            name=tool_name,
                            is_error=True
                        ))
                else:
                    tool_results.append(ToolMessage(
                        content=f"Tool '{tool_name}' not found. Available tools: {[t.name for t in tools]}",
                        tool_call_id=tool_id or f"{tool_name}_notfound_{len(state['messages'])}",
                        name=tool_name,
                        is_error=True
                    ))
            
            return {"messages": tool_results}
        
        return {"messages": []}

    # For Groq, custom tool execution
    def groq_tool_executor(state: AgentState) -> AgentState:
        """Execute a tool call in Groq's custom format."""
        last_message = state["messages"][-1]
        content = last_message.content.strip()

        if content.upper().startswith("TOOL:"):
            tool_call = content[5:].strip()
            parts = tool_call.split(None, 1)
            if len(parts) >= 1:
                tool_name = parts[0]
                params = parts[1] if len(parts) > 1 else ""

                tool = next((t for t in tools if t.name == tool_name), None)
                if tool:
                    try:
                        if hasattr(tool, 'invoke'):
                            result = tool.invoke({"query": params} if params else {})
                        elif hasattr(tool, 'run'):
                            result = tool.run(params if params else "")
                        else:
                            result = f"Tool {tool_name} found but no invoke/run method"

                        tool_message = ToolMessage(
                            content=str(result),
                            tool_call_id=f"{tool_name}_{len(state['messages'])}",
                            name=tool_name
                        )
                        return {"messages": [tool_message]}
                    except Exception as e:
                        tool_message = ToolMessage(
                            content=f"Tool execution failed: {str(e)}",
                            tool_call_id=f"{tool_name}_error_{len(state['messages'])}",
                            name=tool_name,
                            is_error=True
                        )
                        return {"messages": [tool_message]}
                else:
                    error_msg = f"Tool '{tool_name}' not found. Available tools: {[t.name for t in tools]}"
                    return {"messages": [HumanMessage(content=error_msg)]}
            else:
                error_msg = "Invalid tool format. Use: TOOL: <tool_name> <parameters>"
                return {"messages": [HumanMessage(content=error_msg)]}
        else:
            return {"messages": [last_message]}

    # Bind tools to LLM
    if tools and not is_groq:
        llm_with_tools = llm.bind_tools(tools)
    else:
        llm_with_tools = llm

    # ── System prompt ─────────────────────────────────────────────────────────
    system_prompt = (
        getattr(agent, "system_prompt", None)
        or "You are a helpful AI assistant. Complete the user's task step by step."
    )

    # Inject skill instructions
    if db_skills:
        skill_instructions = "\n\n".join([
            f"## Skill: {s.name}\n{s.system_instruction}"
            for s in db_skills
        ])
        system_prompt += f"\n\n### Behavioral Skills\n\nThe following behavioral instructions guide how you should approach tasks:\n\n{skill_instructions}"

    # For Groq, add tool instructions to system prompt
    if is_groq and tools:
        tool_descriptions = "\n".join([
            f"- {tool.name}: {getattr(tool, 'description', tool.name)}"
            for tool in tools
        ])
        system_prompt += f"\n\nYou have access to the following tools:\n{tool_descriptions}\n\nTo use a tool, respond with: TOOL: <tool_name> <parameters>"

    # ── Node: agent ───────────────────────────────────────────────────────────
    def call_agent(state: AgentState) -> AgentState:
        messages = state["messages"]
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=system_prompt)] + messages
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    # ── Edge: should we call a tool? ──────────────────────────────────────────
    def should_continue(state: AgentState) -> str:
        last_message = state["messages"][-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
        if hasattr(last_message, "content") and isinstance(last_message.content, str):
            if last_message.content.strip().upper().startswith("TOOL:"):
                return "tools"
        return "end"

    # ── Assemble the graph ────────────────────────────────────────────────────
    workflow = StateGraph(AgentState)
    workflow.add_node("agent", call_agent)

    if tools and not is_groq:
        workflow.add_node("tools", standard_tool_executor)
        workflow.add_conditional_edges(
            "agent",
            should_continue,
            {"tools": "tools", "end": END},
        )
        workflow.add_edge("tools", "agent")
    elif tools and is_groq:
        workflow.add_node("tools", groq_tool_executor)
        workflow.add_conditional_edges(
            "agent",
            should_continue,
            {"tools": "tools", "end": END},
        )
        workflow.add_edge("tools", "agent")
    else:
        workflow.add_edge("agent", END)

    workflow.set_entry_point("agent")
    return workflow.compile()
