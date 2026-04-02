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
from app.models.skill     import Skill
from app.models.task      import Task,      TriggerType, TaskStatus
from app.core.config      import settings


def seed_database(db: Session) -> None:
    """
    Insert default rows if the database is empty.
    Safe to call on every app startup — skips if data already exists.
    """

    # ── 1. Seed LLM configs and tools ─────────────────────────────────────────
    # Hardcoded demo LLMs and tools are intentionally disabled. Create LLM and tool
    # entries manually via the UI or API for production behavior.
    # (If you want automatic demo data in the future, enable seeding code here.)


    # ── 2.5 Seed skills ──────────────────────────────────────────────────────
    if db.query(Skill).count() == 0:
        skills = [
            Skill(
                id=uuid.UUID("00000000-0000-0000-0004-000000000001"),
                name="Follow Up Suggester",
                category="analysis",
                description="Automatically suggests clarifying and follow-up questions after answering.",
                system_instruction=(
                    "After providing your response, always suggest 2-3 thoughtful follow-up questions "
                    "that the user might want to explore further. Format them as:\n\n"
                    "**Follow-up Questions:**\n- Question 1\n- Question 2\n- Question 3"
                ),
                is_enabled=True,
            ),
            Skill(
                id=uuid.UUID("00000000-0000-0000-0004-000000000002"),
                name="Code Explainer",
                category="code",
                description="Explains code in detail, breaking down logic and reasoning.",
                system_instruction=(
                    "When explaining code, always:\n"
                    "1. Start with the overall purpose\n"
                    "2. Break down each section line-by-line\n"
                    "3. Explain the logic and reasoning behind each step\n"
                    "4. Provide examples of inputs and expected outputs\n"
                    "5. Highlight any edge cases or potential issues"
                ),
                is_enabled=True,
            ),
            Skill(
                id=uuid.UUID("00000000-0000-0000-0004-000000000003"),
                name="Bug Hunter",
                category="code",
                description="Proactively identifies bugs, security issues, and edge cases.",
                system_instruction=(
                    "You are a meticulous bug hunter. When analyzing code:\n"
                    "1. Look for potential null pointer / type errors\n"
                    "2. Check for security vulnerabilities (SQL injection, XSS, etc.)\n"
                    "3. Identify off-by-one errors and boundary condition issues\n"
                    "4. Look for race conditions and concurrency problems\n"
                    "5. Check for performance bottlenecks\n"
                    "Always provide concrete, actionable fixes."
                ),
                is_enabled=True,
            ),
            Skill(
                id=uuid.UUID("00000000-0000-0000-0004-000000000004"),
                name="Database Expert",
                category="data",
                description="Provides expert advice on database design, indexing, and optimization.",
                system_instruction=(
                    "You are a database architecture expert. When discussing databases:\n"
                    "1. Consider normalization vs. denormalization trade-offs\n"
                    "2. Recommend appropriate indexes for query performance\n"
                    "3. Discuss schema design patterns and best practices\n"
                    "4. Suggest optimization strategies for slow queries\n"
                    "5. Consider scalability and sharding strategies\n"
                    "Always explain your reasoning with specific examples."
                ),
                is_enabled=True,
            ),
            Skill(
                id=uuid.UUID("00000000-0000-0000-0004-000000000005"),
                name="Devils Advocate",
                category="reasoning",
                description="Always considers the opposite view and challenges assumptions.",
                system_instruction=(
                    "You are a critical thinking expert who always considers multiple perspectives. "
                    "When responding:\n"
                    "1. First, present the proposed idea or solution\n"
                    "2. Then, systematically explore potential weaknesses and downsides\n"
                    "3. Consider the opposite viewpoint in detail\n"
                    "4. Identify hidden assumptions that might not hold\n"
                    "5. Suggest alternative approaches that address the weaknesses\n"
                    "This helps arrive at more robust conclusions."
                ),
                is_enabled=True,
            ),
            Skill(
                id=uuid.UUID("00000000-0000-0000-0004-000000000006"),
                name="Step-by-Step Reasoner",
                category="reasoning",
                description="Breaks down problems systematically and reasons through each step.",
                system_instruction=(
                    "Always approach problems with a structured, step-by-step methodology:\n"
                    "1. **Understand**: Clearly restate the problem in your own words\n"
                    "2. **Decompose**: Break the problem into smaller, manageable sub-problems\n"
                    "3. **Reason**: Work through each step logically, showing your work\n"
                    "4. **Verify**: Check each step's correctness before proceeding\n"
                    "5. **Synthesize**: Combine results to reach the final conclusion\n"
                    "Always show your reasoning chain, not just the answer."
                ),
                is_enabled=True,
            ),
        ]
        db.add_all(skills)
        db.flush()
        print("[seed] [OK] Skills seeded")

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
        print("[seed] [OK] Agents seeded")

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
        print("[seed] [OK] Tasks seeded")

    db.commit()
    print("[seed] Database ready")