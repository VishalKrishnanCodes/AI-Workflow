# PATH: backend/app/core/seed.py
#
# PURPOSE:
#   Seeds the database with default agents, tools, and an LLM config
#   the first time the app starts against an empty database.
#
#   Called once from main.py startup — it checks if data already exists
#   before inserting, so it is completely safe to run on every restart.
#
# DEFAULT DATA SEEDED:
#   LLM Config : GPT-4o (user fills in their own API key via LLM Settings)
#   Tools      : web_search, wikipedia, python_repl  (all builtin)
#   Agents     : Research Agent, Code Review Agent, Data Analyst Agent
#   Tasks      : one cron task per agent (as examples)

import uuid
from sqlalchemy.orm import Session
from app.models.agent     import Agent,     AgentStatus
from app.models.llm_config import LLMConfig
from app.models.tool      import Tool,      ToolType
from app.models.task      import Task,      TriggerType, TaskStatus
from app.core.config      import settings


def seed_database(db: Session) -> None:
    """
    Insert default rows if the database is empty.
    Safe to call on every app startup — skips if data already exists.
    """

    # ── 1. Seed LLM configs ───────────────────────────────────────────────────
    if db.query(LLMConfig).count() == 0:
        llm_gpt4 = LLMConfig(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            name="GPT-4o (add your key in LLM Settings)",
            provider="openai",
            model="gpt-4o",
            api_key="",          # user must fill this in via the UI
            temperature=0.7,
            max_tokens=2048,
            is_active=True,
            is_default=True,
        )
        llm_claude = LLMConfig(
            id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
            name="Claude 3.5 Sonnet (add your key in LLM Settings)",
            provider="anthropic",
            model="claude-3-5-sonnet-20241022",
            api_key="",
            temperature=0.7,
            max_tokens=4096,
            is_active=True,
            is_default=False,
        )
        db.add_all([llm_gpt4, llm_claude])
        db.flush()
        print("[seed] ✓ LLM configs seeded")

    # ── 2. Seed tools ─────────────────────────────────────────────────────────
    if db.query(Tool).count() == 0:
        tools = [
            Tool(
                id=uuid.UUID("00000000-0000-0000-0001-000000000001"),
                name="web_search",
                description="Search the web using DuckDuckGo. Use this to find current information, news, or anything not in training data.",
                tool_type=ToolType.builtin,
                is_enabled=True,
            ),
            Tool(
                id=uuid.UUID("00000000-0000-0000-0001-000000000002"),
                name="wikipedia",
                description="Query Wikipedia for encyclopedic background knowledge on any topic.",
                tool_type=ToolType.builtin,
                is_enabled=True,
            ),
            Tool(
                id=uuid.UUID("00000000-0000-0000-0001-000000000003"),
                name="python_repl",
                description="Execute Python code. Use for calculations, data processing, parsing, or any task that benefits from code.",
                tool_type=ToolType.builtin,
                is_enabled=True,
            ),
        ]
        db.add_all(tools)
        db.flush()
        print("[seed] ✓ Tools seeded")

    # ── 3. Seed agents ────────────────────────────────────────────────────────
    if db.query(Agent).count() == 0:
        llm_id  = uuid.UUID("00000000-0000-0000-0000-000000000001")
        llm_id2 = uuid.UUID("00000000-0000-0000-0000-000000000002")
        ws_id   = str(uuid.UUID("00000000-0000-0000-0001-000000000001"))
        wk_id   = str(uuid.UUID("00000000-0000-0000-0001-000000000002"))
        py_id   = str(uuid.UUID("00000000-0000-0000-0001-000000000003"))

        research_agent = Agent(
            id=uuid.UUID("00000000-0000-0000-0002-000000000001"),
            name="Research Agent",
            description="Searches the web and Wikipedia to answer questions with thorough, cited responses.",
            status=AgentStatus.active,
            system_prompt=(
                "You are a meticulous research assistant. "
                "When given a question, search the web and Wikipedia to gather information. "
                "Always cite your sources and present findings in a clear, structured format."
            ),
            llm_config_id=llm_id,
            tool_ids=[ws_id, wk_id],
            max_iterations="10",
        )
        code_review_agent = Agent(
            id=uuid.UUID("00000000-0000-0000-0002-000000000002"),
            name="Code Review Agent",
            description="Analyses code for bugs, security vulnerabilities, and style issues using a Python REPL.",
            status=AgentStatus.active,
            system_prompt=(
                "You are a senior software engineer performing a code review. "
                "Use the Python REPL to run and test code snippets where useful. "
                "Check for: correctness, security vulnerabilities, performance issues, "
                "and code style. Provide specific, actionable feedback."
            ),
            llm_config_id=llm_id2,
            tool_ids=[py_id],
            max_iterations="8",
        )
        data_analyst_agent = Agent(
            id=uuid.UUID("00000000-0000-0000-0002-000000000003"),
            name="Data Analyst Agent",
            description="Runs Python to analyse datasets, compute statistics, and produce clear insights.",
            status=AgentStatus.inactive,
            system_prompt=(
                "You are an expert data analyst. "
                "Use Python (pandas, numpy, matplotlib) to process and analyse data. "
                "Always show your working, explain your methodology, and summarise "
                "key insights clearly for a non-technical audience."
            ),
            llm_config_id=llm_id,
            tool_ids=[py_id, ws_id],
            max_iterations="15",
        )

        db.add_all([research_agent, code_review_agent, data_analyst_agent])
        db.flush()
        print("[seed] ✓ Agents seeded")

    # ── 4. Seed example tasks ─────────────────────────────────────────────────
    if db.query(Task).count() == 0:
        tasks = [
            Task(
                id=uuid.UUID("00000000-0000-0000-0003-000000000001"),
                name="Daily Market Digest",
                description="Runs every weekday morning to produce a market summary.",
                agent_id=uuid.UUID("00000000-0000-0000-0002-000000000001"),
                trigger_type=TriggerType.cron,
                cron_expression="0 7 * * 1-5",
                input_payload={"prompt": "Give me a concise market digest for today. Cover major indices, top movers, and key economic news."},
                docker_image=settings.DOCKER_RUNNER_IMAGE,
                docker_timeout_seconds="300",
                status=TaskStatus.active,
            ),
            Task(
                id=uuid.UUID("00000000-0000-0000-0003-000000000002"),
                name="Weekly Code Audit",
                description="Runs every Monday morning to audit the main application code.",
                agent_id=uuid.UUID("00000000-0000-0000-0002-000000000002"),
                trigger_type=TriggerType.cron,
                cron_expression="0 9 * * 1",
                input_payload={"prompt": "Review the latest code changes for bugs, security issues, and style improvements."},
                docker_image=settings.DOCKER_RUNNER_IMAGE,
                docker_timeout_seconds="300",
                status=TaskStatus.active,
            ),
            Task(
                id=uuid.UUID("00000000-0000-0000-0003-000000000003"),
                name="Ad-hoc Data Analysis",
                description="Manually triggered analysis task.",
                agent_id=uuid.UUID("00000000-0000-0000-0002-000000000003"),
                trigger_type=TriggerType.manual,
                input_payload={"prompt": "Analyse the provided dataset and produce a summary of key insights."},
                docker_image=settings.DOCKER_RUNNER_IMAGE,
                docker_timeout_seconds="600",
                status=TaskStatus.paused,
            ),
        ]
        db.add_all(tasks)
        db.flush()
        print("[seed] ✓ Tasks seeded")

    db.commit()
    print("[seed] Database ready")