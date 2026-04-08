# AI Workflow Platform — LLM Context Guide

A full-stack platform for building, managing, and executing AI agents with tool integrations, task scheduling, and a visual workflow builder.

---

## Architecture Overview

```
Browser (React + Vite)
    ↓  HTTP (Axios)
FastAPI Backend  (port 8000)
    ↓  calls
Service Layer  (agent_service, llm_service)
    ↓  uses
LangGraph Agent  (agent_runner/graph_builder.py)
    ↓  reads config from
PostgreSQL  (via SQLAlchemy ORM)

For scheduled/triggered tasks:
Celery Worker → Docker Container → agent_runner/run_agent.py → FastAPI /agents/{id}
```

### Services (Docker Compose)
| Service | Image | Port | Role |
|---|---|---|---|
| `postgres` | postgres:16-alpine | 5432 | Primary database |
| `redis` | redis:7-alpine | 6379 | Celery broker + result backend |
| `backend` | ./backend/Dockerfile | 8000 | FastAPI API server |
| `worker` | ./backend/Dockerfile | — | Celery worker (same image, different CMD) |
| `frontend` | node:20-alpine | 5173 | React dev server |
| `agent-runner` | Built separately | — | Docker container for isolated agent execution |

Build the agent-runner image once:
```bash
docker build -f agent_runner/Dockerfile.runner -t ai-workflow-agent-runner:latest .
```

Start everything:
```bash
docker compose up --build
```

---

## Tech Stack

**Backend:** FastAPI, SQLAlchemy, PostgreSQL, Alembic, Celery, Redis, Docker SDK  
**AI/ML:** LangChain, LangGraph (ReAct pattern), LangChain Community, LangChain Experimental  
**LLM Providers:** OpenAI, Anthropic, Groq, Ollama, Custom endpoints  
**Frontend:** React 18, Vite, Tailwind CSS, React Router, Axios  

---

## Quick Start

### Docker (recommended)
```bash
docker compose up --build
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Local Dev
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Celery worker (separate terminal)
celery -A app.celery_worker.celery_app worker --loglevel=info --concurrency=4

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Environment Variables (`backend/.env`)
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_workflow
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1
DOCKER_RUNNER_IMAGE=ai-workflow-agent-runner:latest
DOCKER_NETWORK=ai_workflow_network
DOCKER_API_BASE_URL=http://host.docker.internal:8000
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
```

---

## Project File Structure

```
ai-workflow-platform/
├── docker-compose.yml
├── .env
├── agent_runner/                    # Standalone Docker agent runner
│   ├── Dockerfile.runner
│   ├── run_agent.py                 # Entry point inside the container
│   ├── graph_builder.py             # LangGraph logic (mirrors backend version)
│   └── requirements-runner.txt
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/                     # DB migrations
│   └── app/
│       ├── main.py                  # FastAPI app entry point
│       ├── core/
│       │   ├── config.py            # Settings (reads .env)
│       │   ├── database.py          # SQLAlchemy engine + SessionLocal + Base
│       │   └── seed.py              # Seeds default data on startup
│       ├── models/                  # SQLAlchemy ORM table definitions
│       │   ├── agent.py
│       │   ├── llm_config.py
│       │   ├── tool.py
│       │   ├── skill.py
│       │   ├── task.py
│       │   └── task_run.py
│       ├── schemas/                 # Pydantic request/response schemas
│       │   ├── agent.py
│       │   ├── llm_config.py
│       │   ├── tool.py
│       │   ├── skill.py
│       │   ├── task.py
│       │   └── task_run.py
│       ├── routers/                 # FastAPI route handlers
│       │   ├── agents.py
│       │   ├── llm.py
│       │   ├── tools.py
│       │   ├── skill.py
│       │   ├── tasks.py
│       │   ├── task_runs.py
│       │   ├── dashboard.py
│       │   └── workflows.py
│       ├── services/
│       │   ├── agent_service.py     # Dry run logic
│       │   └── llm_service.py       # Builds LangChain LLM objects + tests connection
│       ├── agent_runner/
│       │   ├── graph_builder.py     # Core LangGraph ReAct graph builder
│       │   └── tools/
│       │       ├── web_scraper_tool.py
│       │       └── code_tester_tool.py
│       └── celery_worker/
│           ├── celery_app.py        # Celery app instance
│           ├── tasks.py             # execute_task: spawns Docker container
│           └── scheduler.py        # Celery Beat schedule config
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx                  # Routes definition
        ├── index.css
        ├── api/                     # Axios API client functions
        │   ├── client.js            # Axios base instance (VITE_API_URL)
        │   ├── agents.js
        │   ├── llm.js
        │   ├── tools.js
        │   ├── skills.js
        │   ├── tasks.js
        │   ├── taskRuns.js
        │   ├── runs.js
        │   └── workflows.js
        ├── pages/                   # One file per route
        │   ├── Dashboard.jsx
        │   ├── AgentManagement.jsx
        │   ├── LLMSettings.jsx
        │   ├── ToolsManagement.jsx
        │   ├── WorkflowBuilder.jsx
        │   ├── TaskScheduler.jsx
        │   └── TaskRunHistory.jsx
        └── components/
            └── shared/
                ├── Layout.jsx       # Nav + page wrapper
                └── UI.jsx           # Reusable UI primitives
```

---

## Database Schema

### `agents`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(255) | |
| description | TEXT | |
| status | ENUM | `active` / `inactive` / `draft` |
| system_prompt | TEXT | Instructions given to the LLM |
| workflow_config | JSON | LangGraph workflow definition |
| llm_config_id | UUID | FK → llm_configs |
| tool_ids | JSON | Array of Tool UUIDs |
| skill_ids | JSON | Array of Skill UUIDs |
| domain | VARCHAR(100) | Optional domain tag |
| max_iterations | VARCHAR(10) | Max ReAct loop iterations |
| created_at / updated_at | TIMESTAMP | |

### `llm_configs`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(255) | Friendly name |
| provider | VARCHAR(50) | `openai` / `anthropic` / `groq` / `ollama` / `custom` |
| model | VARCHAR(255) | e.g. `gpt-4o`, `claude-3-5-sonnet-20241022` |
| api_key | TEXT | Stored in plaintext — encrypt in production |
| api_base_url | VARCHAR(500) | For Ollama or custom endpoints |
| temperature | DECIMAL(3,2) | 0.0–1.0 |
| max_tokens | INTEGER | |
| is_default | BOOLEAN | Only one can be default |
| is_active | BOOLEAN | |

### `tools`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(255) | |
| tool_type | ENUM | `builtin` / `api` / `custom` / `langchain` |
| description | TEXT | |
| endpoint_url | VARCHAR(500) | For `api` type tools |
| http_method | VARCHAR(10) | GET / POST |
| headers | JSON | HTTP headers |
| input_schema | JSON | JSON Schema for inputs |
| source_code | TEXT | For `custom` type — must define `get_tool()` returning a `BaseTool` |
| is_enabled | BOOLEAN | |

### `skills`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(255) UNIQUE | |
| description | TEXT | Shown to user when selecting |
| category | VARCHAR(100) | e.g. `reasoning`, `analysis`, `code` |
| system_instruction | TEXT | Injected into agent system prompt |
| is_enabled | BOOLEAN | |

### `tasks`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(255) | |
| agent_id | UUID | FK → agents |
| trigger_type | ENUM | `cron` / `manual` / `webhook` / `event` |
| cron_expression | VARCHAR(100) | e.g. `0 9 * * 1-5` |
| input_payload | JSON | Prompt + config sent to the agent |
| docker_image | VARCHAR(255) | Defaults to `ai-workflow-agent-runner:latest` |
| docker_env_vars | JSON | Extra env vars for the container |
| docker_timeout_seconds | VARCHAR | Kill container after N seconds |
| status | ENUM | `active` / `paused` / `draft` |
| last_run_at | TIMESTAMP | |

### `task_runs`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| task_id | UUID | FK → tasks |
| status | ENUM | `pending` / `running` / `success` / `failed` / `timeout` / `cancelled` |
| exit_code | INTEGER | 0 = success |
| started_at / finished_at | TIMESTAMP | |
| duration_seconds | INTEGER | |
| container_id | VARCHAR(255) | Docker container ID |
| docker_image | VARCHAR(255) | Image used for this run |
| logs | TEXT | Full stdout/stderr from container |
| error_message | TEXT | Last 500 chars of logs on failure |
| triggered_by | VARCHAR(50) | `manual` / `cron` / `webhook` |

---

## API Reference

Base URL: `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs`

### Agents `/agents`
```
GET    /agents/              List all agents
POST   /agents/              Create agent
GET    /agents/{id}          Get agent
PUT    /agents/{id}          Update agent
DELETE /agents/{id}          Delete agent
PATCH  /agents/{id}/toggle   Enable / disable
POST   /agents/{id}/dry-run  Test agent with a prompt (runs in-process, no Docker)
```

### LLM Configs `/llm`
```
GET    /llm/                 List configs
POST   /llm/                 Create config
PUT    /llm/{id}             Update config
DELETE /llm/{id}             Delete config
POST   /llm/{id}/test        Test API key / connection
```

### Tools `/tools`
```
GET    /tools/               List tools
POST   /tools/               Create tool
PUT    /tools/{id}           Update tool
DELETE /tools/{id}           Delete tool
PATCH  /tools/{id}/toggle    Enable / disable
```

### Skills `/skills`
```
GET    /skills/              List skills
POST   /skills/              Create skill
PUT    /skills/{id}          Update skill
DELETE /skills/{id}          Delete skill
```

### Tasks `/tasks`
```
GET    /tasks/               List tasks
POST   /tasks/               Create task
GET    /tasks/{id}           Get task
PUT    /tasks/{id}           Update task
DELETE /tasks/{id}           Delete task
POST   /tasks/{id}/trigger   Manually trigger task (spawns Docker container via Celery)
```

### Task Runs `/task-runs`
```
GET    /task-runs/           List run history
GET    /task-runs/{id}       Get run with full logs
```

### Workflows `/workflows`
```
POST   /workflows/dry-run    Run a workflow config without saving
POST   /workflows/save       Save workflow as a draft Task
GET    /workflows/           List saved workflows
GET    /workflows/{id}       Get single workflow
```

### Dashboard `/dashboard`
```
GET    /dashboard/stats      Counts + recent runs for the dashboard page
```

### Health
```
GET    /health               { status: "ok" }
GET    /                     { message: "AI Workflow API is running" }
```

---

## Core Backend Logic

### `app/core/config.py`
Reads all env vars via `pydantic-settings`. Every other file imports `from app.core.config import settings`.

### `app/core/database.py`
Creates the SQLAlchemy `engine`, `SessionLocal` factory, and `Base` class. `get_db()` is a FastAPI dependency that opens/closes a DB session per request.

### `app/core/seed.py`
Runs on startup. Seeds default agents, tools, LLM configs if the DB is empty.

### `app/services/llm_service.py`
- `_build_llm(llm_config)` → returns a LangChain chat model (`ChatOpenAI`, `ChatAnthropic`, `ChatGroq`, etc.)
- `test_llm_connection(llm_config)` → sends a tiny test message and returns `{ success, latency_ms }`

### `app/agent_runner/graph_builder.py` — Core AI Logic
Builds a LangGraph ReAct-style agent graph.

**ReAct loop:**
```
User prompt → agent node (LLM) → tool_calls? → tools node → back to agent → ... → final answer → END
```

**Tool types supported:**
- `builtin`: `web_search` (DuckDuckGo), `wikipedia`, `python_repl`, `web_scraper`, `code_tester`
- `api`: wraps any HTTP endpoint as a callable tool
- `custom`: executes user-written Python; code must define `get_tool() -> BaseTool`

**Groq special handling:** Groq doesn't support native tool binding, so the graph uses a text-based `TOOL: <name> <params>` format parsed from the LLM response.

**Skills:** Skill `system_instruction` fields are appended to the agent's system prompt before the graph runs.

### `app/celery_worker/tasks.py` — Task Execution
`execute_task(task_id, run_id)` Celery task:
1. Loads Task + TaskRun from DB
2. Marks run as `running`
3. Spawns a Docker container (`ai-workflow-agent-runner:latest`) with env vars: `TASK_ID`, `RUN_ID`, `AGENT_ID`, `API_BASE_URL`
4. Waits for container exit (with timeout)
5. Collects stdout/stderr logs
6. Updates TaskRun: `status`, `exit_code`, `logs`, `duration_seconds`

Container limits: `mem_limit=512m`, CPU capped at 50% of one core.

---

## Frontend Routes

| Path | Page | Description |
|---|---|---|
| `/` | Dashboard | Stats overview + recent runs |
| `/agents` | AgentManagement | Create/edit/delete agents, dry run |
| `/llm` | LLMSettings | Manage LLM provider configs |
| `/tools` | ToolsManagement | Manage tools (builtin, API, custom) |
| `/workflows` | WorkflowBuilder | Visual workflow builder + dry run |
| `/scheduler` | TaskScheduler | Create/manage scheduled tasks |
| `/history` | TaskRunHistory | View run logs and history |

Frontend API calls go through `src/api/client.js` (Axios instance pointed at `VITE_API_URL`, default `http://localhost:8000`).

---

## LLM Providers

| Provider | `provider` value | Notes |
|---|---|---|
| OpenAI | `openai` | Requires `api_key` |
| Anthropic | `anthropic` | Requires `api_key` |
| Groq | `groq` | Requires `api_key`; no native tool binding — uses text-based tool format |
| Ollama | `ollama` | No API key; set `api_base_url` to `http://localhost:11434` |
| Custom | `custom` | OpenAI-compatible endpoint; set `api_base_url` |

---

## Adding New Features

### New LLM Provider
1. Update `_build_llm()` in `app/services/llm_service.py`
2. Add provider to the `provider` enum/validation in schemas

### New Built-in Tool
1. Add a case in `_get_builtin_tool()` in `app/agent_runner/graph_builder.py`
2. Add the tool name to the seed data or register it via the Tools API

### New Custom Tool (via UI)
- Tool type: `custom`
- Source code must define: `def get_tool() -> BaseTool: ...`

### New API Tool (via UI)
- Tool type: `api`
- Provide `endpoint_url`, `http_method`, optional `headers`
- The tool will POST `{ "input": "<user_input>" }` to the endpoint

---

## Common Issues

**LLM API key not working:**
```bash
curl -X POST http://localhost:8000/llm/{id}/test
```

**Frontend can't reach backend:**  
Check `VITE_API_URL` in frontend env and `CORS_ORIGINS` in backend config.

**Docker container fails to start:**  
Make sure the agent-runner image is built: `docker build -f agent_runner/Dockerfile.runner -t ai-workflow-agent-runner:latest .`

**Database reset:**
```bash
python backend/reset_db.py
```

---

*Last updated: April 8, 2026*
