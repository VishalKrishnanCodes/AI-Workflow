# PATH: agent-runner/run_agent.py
#
# PURPOSE:
#   This script runs INSIDE the Docker container for each task execution.
#   It is the entry point of the agent-runner Docker image.
#
# HOW IT WORKS:
#   1. Reads TASK_ID, RUN_ID, AGENT_ID from environment variables
#      (injected by the Celery worker in tasks.py)
#   2. Calls the FastAPI backend to fetch the agent's full config
#   3. Calls the FastAPI backend to fetch the task's input payload
#   4. Builds the LangGraph graph using graph_builder.py
#   5. Runs the graph with the input payload
#   6. Prints all output to stdout (collected as logs by tasks.py)
#   7. Exits with code 0 on success, 1 on failure
#
# NOTE:
#   This file is separate from the backend — it lives in agent-runner/
#   and is built into its own Docker image (Dockerfile.runner).
#   It imports graph_builder by copying it in during the Docker build.

import os
import sys
import json
import asyncio
import httpx


# ── Read environment variables ────────────────────────────────────────────────
TASK_ID      = os.environ.get("TASK_ID")
RUN_ID       = os.environ.get("RUN_ID")
AGENT_ID     = os.environ.get("AGENT_ID")
API_BASE_URL = os.environ.get("API_BASE_URL", "http://backend:8000")

if not all([TASK_ID, RUN_ID, AGENT_ID]):
    print("ERROR: TASK_ID, RUN_ID, and AGENT_ID environment variables are required")
    sys.exit(1)

print(f"[runner] Starting task={TASK_ID} run={RUN_ID} agent={AGENT_ID}")

# ── Fetch config from the FastAPI backend ─────────────────────────────────────

def fetch(path: str) -> dict:
    """Makes a GET request to the backend API and returns parsed JSON."""
    url = f"{API_BASE_URL}{path}"
    print(f"[runner] Fetching {url}")
    response = httpx.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


# ── Main execution ────────────────────────────────────────────────────────────

async def main():
    try:
        # 1. Load agent config
        agent_data = fetch(f"/agents/{AGENT_ID}")
        print(f"[runner] Loaded agent: {agent_data['name']}")

        # 2. Load task config (to get input_payload)
        task_data = fetch(f"/tasks/{TASK_ID}")
        input_payload = task_data.get("input_payload", {})
        input_prompt  = input_payload.get("prompt", "Run the agent task.")
        print(f"[runner] Input prompt: {input_prompt[:100]}...")

        # 3. Load LLM config if set
        llm_config_data = None
        if agent_data.get("llm_config_id"):
            llm_config_data = fetch(f"/llm/{agent_data['llm_config_id']}")
            print(f"[runner] LLM: {llm_config_data['provider']} / {llm_config_data['model']}")

        # 4. Load tools
        tools_data = []
        for tool_id in (agent_data.get("tool_ids") or []):
            try:
                tool = fetch(f"/tools/{tool_id}")
                if tool.get("is_enabled"):
                    tools_data.append(tool)
                    print(f"[runner] Tool loaded: {tool['name']}")
            except Exception as exc:
                print(f"[runner] Warning: could not load tool {tool_id}: {exc}")

        # 5. Load skills
        skills_data = []
        for skill_id in (agent_data.get("skill_ids") or []):
            try:
                skill = fetch(f"/skills/{skill_id}")
                skills_data.append(skill)
                print(f"[runner] Skill loaded: {skill['name']}")
            except Exception as exc:
                print(f"[runner] Warning: could not load skill {skill_id}: {exc}")

        # 6. Build lightweight model objects from the API response dicts
        #    (We can't use SQLAlchemy here — no DB connection in the container)
        from types import SimpleNamespace

        agent = SimpleNamespace(
            id=agent_data["id"],
            name=agent_data["name"],
            system_prompt=agent_data.get("system_prompt"),
            workflow_config=agent_data.get("workflow_config", {}),
            tool_ids=agent_data.get("tool_ids", []),
            skill_ids=agent_data.get("skill_ids", []),
            llm_config_id=agent_data.get("llm_config_id"),
            max_iterations=agent_data.get("max_iterations", "10"),
        )

        llm_config = None
        if llm_config_data:
            llm_config = SimpleNamespace(
                id=llm_config_data["id"],
                provider=llm_config_data["provider"],
                model=llm_config_data["model"],
                api_key=llm_config_data.get("api_key"),
                api_base_url=llm_config_data.get("api_base_url"),
                temperature=llm_config_data.get("temperature", 0.7),
                max_tokens=llm_config_data.get("max_tokens", 2048),
                top_p=llm_config_data.get("top_p", 1.0),
                extra_params=llm_config_data.get("extra_params", {}),
            )

        tools = []
        for t in tools_data:
            tools.append(SimpleNamespace(
                id=t["id"],
                name=t["name"],
                description=t.get("description"),
                tool_type=t["tool_type"],
                endpoint_url=t.get("endpoint_url"),
                http_method=t.get("http_method", "POST"),
                headers=t.get("headers", {}),
                source_code=t.get("source_code"),
                is_enabled=t.get("is_enabled", True),
            ))

        skills = []
        for s in skills_data:
            skills.append(SimpleNamespace(
                id=s["id"],
                name=s["name"],
                description=s.get("description"),
                category=s.get("category"),
                system_instruction=s.get("system_instruction"),
            ))

        # 7. Build the LangGraph graph
        from app.agent_runner.graph_builder import build_agent_graph
        graph = build_agent_graph(agent, llm_config, tools, skills, {})
        print("[runner] LangGraph compiled successfully")

        # 8. Run the graph
        print("[runner] Executing agent...")
        final_output = ""

        async for event in graph.astream(
            {"messages": [{"role": "user", "content": input_prompt}]}
        ):
            node_name   = list(event.keys())[0]
            node_output = event[node_name]
            print(f"[runner] Node: {node_name}")

            if node_name == "agent":
                messages = node_output.get("messages", [])
                if messages:
                    last = messages[-1]
                    if hasattr(last, "content") and isinstance(last.content, str):
                        final_output = last.content

        print(f"[runner] Final output:\n{final_output}")
        print("[runner] Task completed successfully")

    except Exception as exc:
        print(f"[runner] FATAL ERROR: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())