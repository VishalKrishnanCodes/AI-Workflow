# PATH: backend/app/services/agent_service.py

# PURPOSE:
#   Contains the logic for running an agent dry run.
#   This is called by the "Dry Run" panel on the Agent Management screen.
#   It does NOT spawn a Docker container — it runs the LangGraph graph
#   directly in the FastAPI process so the user gets instant feedback.
#
# CALLED BY:
#   routers/agents.py → POST /agents/{id}/dry-run

from typing import Any, Dict
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.llm_config import LLMConfig
from app.models.tool import Tool
from app.models.skill import Skill

async def run_dry_run(
    agent: Agent,
    input_prompt: str,
    override_params: Dict[str, Any],
    db: Session,
) -> Dict[str, Any]:
    """
    Executes one pass of the agent's LangGraph workflow.

    Steps:
      1. Load the LLMConfig record linked to this agent
      2. Load all enabled Tool records linked to this agent
      3. Load all Skill records linked to this agent
      4. Build the LangGraph compiled graph via graph_builder
      5. Stream events from the graph, collecting each node visit as a "step"
      6. Extract the final text output from the agent node
      7. Return output + steps + status

    Returns dict with keys:
      output  → final text the agent produced
      steps   → list of {node, output} dicts showing the execution path
      status  → "success" or "error"
      error   → error message string if status == "error"
    """
    try:
        # ── Step 1: Load LLM config ───────────────────────────────────────────
        llm_config = None
        if agent.llm_config_id:
            llm_config = (
                db.query(LLMConfig)
                .filter(LLMConfig.id == agent.llm_config_id)
                .first()
            )

        # ── Step 2: Load enabled tools ────────────────────────────────────────
        tools = []
        if agent.tool_ids:
            tools = (
                db.query(Tool)
                .filter(
                    Tool.id.in_(agent.tool_ids),
                    Tool.is_enabled == True,
                )
                .all()
            )

        # ── Step 3: Load linked skills ────────────────────────────────────────
        skills = []
        if agent.skill_ids:
            skills = (
                db.query(Skill)
                .filter(Skill.id.in_(agent.skill_ids))
                .all()
            )

        # ── Step 4: Build the LangGraph compiled graph ────────────────────────
        from app.agent_runner.graph_builder import build_agent_graph
        graph = build_agent_graph(agent, llm_config, tools, skills, override_params)

        # ── Step 5: Stream through graph nodes ────────────────────────────────
        # Each event is a dict: { node_name: node_output }
        steps = []
        final_output = ""

        async for event in graph.astream(
            {"messages": [{"role": "user", "content": input_prompt}]}
        ):
            node_name   = list(event.keys())[0]
            node_output = event[node_name]

            # Record this step for the UI to display
            steps.append({
                "node":   node_name,
                "output": str(node_output)[:1000],  # cap length for display
            })

            # Extract final text from the agent node's last message
            if node_name == "agent":
                messages = node_output.get("messages", [])
                if messages:
                    last_msg = messages[-1]
                    if hasattr(last_msg, "content") and isinstance(last_msg.content, str):
                        final_output = last_msg.content

        return {
            "output": final_output,
            "steps":  steps,
            "status": "success",
        }

    except Exception as exc:
        return {
            "output": "",
            "steps":  [],
            "status": "error",
            "error":  str(exc),
        }