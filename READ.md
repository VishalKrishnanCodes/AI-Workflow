# AI Workflow Platform - Complete Developer Guide

**A full-stack platform for building, managing, and executing AI agents with tool integrations**

---

## 🚀 Project Overview

This is a comprehensive AI workflow platform that allows users to:
- **Create AI Agents**: Build custom AI assistants with specific capabilities
- **Configure LLMs**: Support for OpenAI, Anthropic, Groq, Ollama, and custom endpoints
- **Add Tools**: Integrate web search, Wikipedia, Python REPL, and custom API tools
- **Schedule Tasks**: Run agents on cron schedules or trigger them via webhooks
- **Monitor Execution**: Track task runs with detailed logs and performance metrics

### Architecture
- **Frontend**: React + Vite with Tailwind CSS
- **Backend**: FastAPI (Python) with PostgreSQL database
- **AI Engine**: LangChain + LangGraph for agent execution
- **Task Scheduling**: Celery with Redis for background jobs
- **Containerization**: Docker for isolated agent execution

---

## 🛠 Tech Stack

### Backend
- **Framework**: FastAPI (async Python web framework)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **AI/ML**: LangChain, LangGraph, LangChain Community
- **Task Queue**: Celery with Redis
- **Container Runtime**: Docker
- **LLM Providers**: OpenAI, Anthropic, Groq, Ollama, Custom endpoints

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Routing**: React Router

### DevOps
- **Containerization**: Docker & Docker Compose
- **Process Management**: PM2 (optional)
- **Environment**: Python virtualenv/conda

---

## 🏁 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Docker & Docker Compose

### 1. Clone & Setup
```bash
git clone <repository-url>
cd ai-workflow-platform
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys and database URLs
```

### 3. Database Setup
```bash
# Create PostgreSQL database
createdb ai_workflow_db

# Run migrations
alembic upgrade head
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

### 5. Start Services
```bash
# Terminal 1: Backend
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Redis (if not using Docker)
redis-server

# Terminal 4: Celery Worker (optional)
cd backend
celery -A app.celery_worker worker --loglevel=info
```

### 6. Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## 🤖 Using Multiple LLM Providers

The platform supports **multiple LLM providers** so you can switch between them when rate limits are reached or based on your needs.

### Supported LLM Providers

| Provider | Model Examples | Setup |
|----------|---|---|
| **OpenAI** | gpt-4o, gpt-4-turbo, gpt-3.5-turbo | Requires API key from https://platform.openai.com/api-keys |
| **Anthropic** | claude-3-5-sonnet, claude-3-opus, claude-3-haiku | Requires API key from https://console.anthropic.com |
| **Groq** | mixtral-8x7b-32768, llama2-70b-4096 | Requires API key from https://console.groq.com |
| **Ollama** | Local LLMs (llama2, mistral, neural-chat) | Run locally without API key |
| **Custom Endpoint** | Any LLM API endpoint | Provide your own OpenAI-compatible endpoint |

### How to Add a New LLM Config via UI

1. **Open Browser**: http://localhost:5174
2. **Navigate to**: LLM Settings (top menu)
3. **Click**: "New LLM Config"
4. **Fill Form**:
   - **Name**: e.g., "Claude 3.5 Sonnet"
   - **Provider**: Select from dropdown
   - **Model**: Model ID (e.g., `claude-3-5-sonnet-20241022`)
   - **API Key**: Paste your provider's API key
   - **Temperature**: 0.0-1.0 (lower = deterministic, higher = creative)
   - **Max Tokens**: Max output length per response
   - **Set as Default** (optional): Check if you want this as default for new agents

5. **Test Connection**: Click "Test" to verify API key works
6. **Save**: Click "Create"

### How to Add via API

```bash
# Add OpenAI GPT-4o
curl -X POST http://localhost:8000/llm/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GPT-4o",
    "provider": "openai",
    "model": "gpt-4o",
    "api_key": "sk-your-actual-key-here",
    "temperature": 0.7,
    "max_tokens": 2048,
    "is_default": true
  }'

# Add Anthropic Claude
curl -X POST http://localhost:8000/llm/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Claude 3.5 Sonnet",
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "api_key": "sk-ant-your-actual-key-here",
    "temperature": 0.7,
    "max_tokens": 4096,
    "is_default": false
  }'

# Add Groq (free tier, no API key cost)
curl -X POST http://localhost:8000/llm/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Groq Mixtral",
    "provider": "groq",
    "model": "mixtral-8x7b-32768",
    "api_key": "gsk-your-actual-key-here",
    "temperature": 0.7,
    "max_tokens": 2048,
    "is_default": false
  }'
```

### Getting API Keys

#### OpenAI
1. Visit https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy and paste into LLM config form

#### Anthropic
1. Visit https://console.anthropic.com/account/keys
2. Create new API key
3. Copy and paste into LLM config form

#### Groq (Recommended - Free Tier)
1. Visit https://console.groq.com/keys
2. Create new API key (free tier available!)
3. Copy and paste into LLM config form

#### Ollama (Local - No API Key Needed)
```bash
# Install Ollama from https://ollama.ai
# Then run:
ollama run llama2
# or
ollama run mistral

# Add to platform:
curl -X POST http://localhost:8000/llm/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Local Llama2",
    "provider": "ollama",
    "model": "llama2",
    "api_key": "",
    "api_base_url": "http://localhost:11434",
    "temperature": 0.7,
    "max_tokens": 2048,
    "is_default": false
  }'
```

### Switching LLM for an Agent

1. **Edit Agent**: Click on an agent card → "Edit" button
2. **Select LLM**: Choose from "LLM Config" dropdown
3. **Test**: Use Dry Run panel to test with new LLM
4. **Save**: Changes auto-save

### Performance Tips

| Provider | Speed | Cost | Quality | Best For |
|----------|-------|------|---------|----------|
| Groq (free tier) | ⚡⚡⚡ Fast | Free | Good | Testing, high-volume |
| Ollama (local) | ⚡⚡ Medium | Free | Good | Private/offline work |
| Claude (Anthropic) | ⚡⚡ Medium | $$ | Excellent | Complex reasoning |
| GPT-4o (OpenAI) | ⚡ Slower | $$$ | Excellent | Production-grade |

### Handling Rate Limits

When you hit rate limits on your primary LLM:

1. **Keep Multiple Configs Active**: Have 2-3 LLMs configured
2. **Rotate in Agent**: Change `llm_config_id` to an alternative
3. **Monitor Costs**: OpenAI/Anthropic have usage dashboards
4. **Use Groq Free Tier**: Great backup option with no rate limits

---

## 📊 Database Schema

### Core Tables

#### agents
```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    system_prompt TEXT,
    workflow_config JSONB DEFAULT '{}',
    llm_config_id UUID REFERENCES llm_configs(id),
    tool_ids UUID[] DEFAULT '{}',
    max_iterations INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

#### llm_configs
```sql
CREATE TABLE llm_configs (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(255) NOT NULL,
    api_key TEXT,  -- Encrypted in production
    api_base_url VARCHAR(500),
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2048,
    top_p DECIMAL(3,2) DEFAULT 1.0,
    extra_params JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

#### tools
```sql
CREATE TABLE tools (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tool_type VARCHAR(50) NOT NULL,  -- builtin|custom|api|langchain
    description TEXT,
    endpoint_url VARCHAR(500),
    http_method VARCHAR(10) DEFAULT 'POST',
    headers JSONB DEFAULT '{}',
    input_schema JSONB,
    source_code TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

#### tasks
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    agent_id UUID REFERENCES agents(id),
    trigger_type VARCHAR(50) DEFAULT 'manual',  -- cron|manual|webhook|event
    cron_expression VARCHAR(100),
    input_payload JSONB DEFAULT '{}',
    docker_image VARCHAR(255),
    docker_env_vars JSONB DEFAULT '{}',
    docker_timeout_seconds INTEGER DEFAULT 300,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

#### task_runs
```sql
CREATE TABLE task_runs (
    id UUID PRIMARY KEY,
    task_id UUID REFERENCES tasks(id),
    status VARCHAR(50) DEFAULT 'pending',
    exit_code INTEGER,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    duration_seconds INTEGER,
    container_id VARCHAR(255),
    logs TEXT,
    error_message TEXT,
    triggered_by VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔌 API Reference

### Base URL: `http://localhost:8000`

### Agents API
```
GET    /agents/              # List all agents
POST   /agents/              # Create new agent
GET    /agents/{id}          # Get agent details
PUT    /agents/{id}          # Update agent
DELETE /agents/{id}          # Delete agent
PATCH  /agents/{id}/toggle   # Enable/disable agent
POST   /agents/{id}/dry-run  # Test agent with prompt
```

### LLM Configuration API
```
GET    /llm/                 # List LLM configs
POST   /llm/                 # Create LLM config
PUT    /llm/{id}             # Update LLM config
DELETE /llm/{id}            # Delete LLM config
POST   /llm/{id}/test        # Test LLM connection
```

### Tools API
```
GET    /tools/               # List all tools
POST   /tools/               # Create new tool
GET    /tools/{id}           # Get tool details
PUT    /tools/{id}           # Update tool
DELETE /tools/{id}           # Delete tool
PATCH  /tools/{id}/toggle    # Enable/disable tool
```

### Tasks API
```
GET    /tasks/               # List all tasks
POST   /tasks/               # Create new task
GET    /tasks/{id}           # Get task details
PUT    /tasks/{id}           # Update task
DELETE /tasks/{id}           # Delete task
POST   /tasks/{id}/trigger   # Run task manually
```

### Task Runs API
```
GET    /task-runs/           # List all task runs
GET    /task-runs/{id}       # Get run details with logs
```

### Dashboard API
```
GET    /dashboard/stats      # Get dashboard statistics
```

---

## 🏗 Development Workflow

### Adding a New Feature

1. **Plan the Database Changes**
   - Add new columns/tables in `models/`
   - Create Alembic migration: `alembic revision --autogenerate -m "add new feature"`

2. **Update API Schemas**
   - Add Pydantic models in `schemas/`
   - Define request/response structures

3. **Implement Business Logic**
   - Add service functions in `services/`
   - Handle validation and data processing

4. **Create API Endpoints**
   - Add routes in `routers/`
   - Wire up dependencies and error handling

5. **Update Frontend**
   - Add React components
   - Connect to new API endpoints
   - Update state management

### Common Development Tasks

#### Adding a New LLM Provider
1. Update `llm_service.py` `_build_llm()` function
2. Add provider validation in schemas
3. Test with provider's API documentation

#### Adding a New Tool Type
1. Update `ToolType` enum in `models/tool.py`
2. Add tool creation logic in `graph_builder.py`
3. Update tool schemas and validation

#### Adding a New Built-in Tool
1. Add case in `graph_builder.py` `_get_builtin_tool()`
2. Import required LangChain tool
3. Test tool execution in dry-run

---

## 🐳 Deployment

### Docker Compose (Recommended)
```bash
# Production deployment
docker-compose up -d

# Development with hot reload
docker-compose -f docker-compose.dev.yml up
```

### Manual Deployment
```bash
# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend (build for production)
cd frontend
npm run build
# Serve dist/ with nginx or similar
```

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_workflow_db

# Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0

# LLM API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...

# Docker
DOCKER_RUNNER_IMAGE=ai-workflow-runner:latest

# Security
SECRET_KEY=your-secret-key-here
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

## 📁 Detailed File Guide

### PROJECT ROOT
```
ai-workflow-platform/
├── backend/                 # FastAPI backend application
├── frontend/               # React frontend application
├── agent-runner/           # Docker container for agent execution
├── docker-compose.yml      # Multi-service orchestration
├── .env.example           # Environment variables template
└── README.md              # This file
```

---

## 🎨 FRONTEND FILES

### Core Structure
```
frontend/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable React components
│   │   ├── agents/        # Agent management components
│   │   ├── dashboard/     # Dashboard widgets
│   │   ├── llm/          # LLM configuration components
│   │   ├── scheduler/     # Task scheduling components
│   │   ├── tools/        # Tool management components
│   │   └── shared/       # Common UI components
│   ├── pages/            # Main page components
│   │   ├── AgentManagement.jsx
│   │   ├── Dashboard.jsx
│   │   ├── LLMSettings.jsx
│   │   ├── TaskRunHistory.jsx
│   │   ├── TaskScheduler.jsx
│   │   └── ToolsManagement.jsx
│   ├── hooks/            # Custom React hooks
│   ├── store/            # Zustand state management
│   ├── api/              # API client functions
│   ├── utils/            # Utility functions
│   ├── assets/           # Images, icons, etc.
│   ├── index.css         # Global styles
│   └── main.jsx          # React app entry point
├── package.json          # Dependencies and scripts
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind CSS configuration
└── index.html            # HTML template
```

### Key Frontend Components
- **Layout.jsx**: Main app layout with navigation
- **UI.jsx**: Reusable UI components (buttons, modals, forms)
- **Agent Form**: Create/edit agent configurations
- **LLM Config Form**: Manage LLM provider settings
- **Task Scheduler**: Cron job configuration interface
- **Dashboard Charts**: Performance metrics and statistics

---

## 🔧 BACKEND FILES
BACKEND FILES
1. backend/app/core/config.py
WHAT IT DOES:
Reads all your environment variables (like DATABASE_URL, REDIS_URL, SECRET_KEY)
and makes them available to every other file in the app.
Think of it as the settings panel for the entire backend.
KEY THINGS INSIDE:
DATABASE_URL       → where PostgreSQL is running
REDIS_URL          → where Redis is running
CELERY_BROKER_URL  → Celery uses Redis as its job queue
DOCKER_RUNNER_IMAGE → the Docker image used to execute agent tasks
CORS_ORIGINS       → allows your React frontend to talk to FastAPI
HOW IT'S USED:
Every other file does: from app.core.config import settings
Then uses: settings.DATABASE_URL, settings.REDIS_URL, etc.
---
2. backend/app/core/database.py
WHAT IT DOES:
Creates the connection to your PostgreSQL database.
Sets up SQLAlchemy (the Python library that lets you write
Python classes instead of raw SQL).
KEY THINGS INSIDE:
engine         → the actual database connection
SessionLocal   → a factory for creating DB sessions (one per request)
Base           → all your models (tables) inherit from this
get_db()       → a function FastAPI calls automatically to open/close
a DB session for each API request
HOW IT'S USED:
Your model files do: from app.core.database import Base
Your router files do: from app.core.database import get_db
---
MODELS (these define your database tables)
3. backend/app/models/agent.py
WHAT IT DOES:
Defines the "agents" table in PostgreSQL.
One row = one AI agent the user has created.
COLUMNS (fields in the table):
id              → unique ID (UUID)
name            → agent name e.g. "Research Agent"
description     → what this agent does
status          → active / inactive / draft
workflow_config → the LangGraph workflow stored as JSON
llm_config_id   → which LLM this agent uses (links to llm_configs table)
tool_ids        → list of tool IDs this agent can use
system_prompt   → the instructions given to the LLM
created_at      → timestamp when created
RELATIONSHIPS:
An agent can have many Tasks (one agent → many scheduled tasks)
---
4. backend/app/models/llm_config.py
WHAT IT DOES:
Defines the "llm_configs" table.
One row = one LLM configuration the user has saved.
(e.g. "My GPT-4 config" with API key and temperature settings)
COLUMNS:
id           → unique ID
name         → friendly name e.g. "OpenAI GPT-4 Production"
provider     → openai | anthropic | ollama | groq | custom
model        → gpt-4o | claude-3-5-sonnet | llama3 etc.
api_key      → stored API key (encrypt this in production!)
api_base_url → for Ollama or custom endpoints
temperature  → controls randomness (0.0 = deterministic, 1.0 = creative)
max_tokens   → max length of LLM response
is_default   → only one LLM config can be the default
---
5. backend/app/models/tool.py
WHAT IT DOES:
Defines the "tools" table.
One row = one tool an agent can use.
COLUMNS:
id           → unique ID
name         → tool name e.g. "Web Search"
tool_type    → builtin | custom | api | langchain
endpoint_url → for API tools: the URL to call
http_method  → GET or POST
headers      → HTTP headers for the API call
input_schema → what inputs this tool accepts (JSON Schema)
source_code  → for custom tools: actual Python code
is_enabled   → toggle on/off without deleting
---
6. backend/app/models/task.py
WHAT IT DOES:
Defines the "tasks" table.
One row = one scheduled or triggerable task.
A task says: "Run Agent X on this schedule using this Docker image"
COLUMNS:
id                      → unique ID
name                    → task name
agent_id                → which agent to run (links to agents table)
trigger_type            → cron | manual | webhook | event
cron_expression         → e.g. "0 9 * * 1-5" = 9am Monday-Friday
input_payload           → the data/prompt sent to the agent when it runs
docker_image            → which Docker image to use for execution
docker_env_vars         → environment variables passed into the container
docker_timeout_seconds  → kill the container after this many seconds
status                  → active | paused | draft
---
7. backend/app/models/task_run.py
WHAT IT DOES:
Defines the "task_runs" table.
One row = one actual execution of a task (the run history).
Every time a task runs, a new row is created here.
COLUMNS:
id               → unique ID
task_id          → which task this run belongs to
status           → pending | running | success | failed | timeout | cancelled
exit_code        → 0 = success, anything else = error
started_at       → when execution started
finished_at      → when it completed
duration_seconds → how long it took
container_id     → Docker container ID that ran this
logs             → all stdout/stderr output from the container
error_message    → if it failed, why
triggered_by     → manual | cron | webhook
---
8. backend/app/models/init.py
WHAT IT DOES:
A simple file that imports all models into one place.
This means other files can do: from app.models import Agent, Task
instead of importing from each individual file.
---
SCHEMAS (these validate API request/response data)
9. backend/app/schemas/agent.py
WHAT IT DOES:
Defines the shape (structure) of data for Agent API calls.
Pydantic checks that every request and response matches these rules.
CLASSES INSIDE:
AgentCreate    → what fields are required when CREATING an agent (POST body)
AgentUpdate    → what fields can be changed when EDITING an agent (PUT body)
AgentResponse  → what fields are returned when you GET an agent
DryRunRequest  → the input_prompt sent for a dry run test
DryRunResponse → the output, steps taken, duration returned after dry run
WHY SEPARATE FROM MODELS:
Models = database shape
Schemas = API shape
They are similar but NOT the same. e.g. you never want to return
the raw api_key in an API response even if it's stored in the DB.
---
10. backend/app/schemas/schemas.py
WHAT IT DOES:
Same as agent.py but covers all other resources:
LLMConfig, Tool, Task, TaskRun, and Dashboard.
CLASSES INSIDE:
LLMConfigCreate / LLMConfigUpdate / LLMConfigResponse
LLMTestResponse     → { success: true, latency_ms: 240 }
ToolCreate / ToolUpdate / ToolResponse
TaskCreate / TaskUpdate / TaskResponse
TaskTriggerResponse → returned when you manually trigger a task
TaskRunResponse     → one row of run history
DashboardStats      → all the counters for the dashboard page
---
ROUTERS (these are your API endpoints)
11. backend/app/routers/agents.py
WHAT IT DOES:
Registers the /agents API endpoints.
When your React frontend calls the API, these functions handle it.
ENDPOINTS INSIDE:
GET    /agents/              → list all agents
POST   /agents/              → create a new agent
GET    /agents/{id}          → get one agent by ID
PUT    /agents/{id}          → edit an agent
DELETE /agents/{id}          → delete an agent
PATCH  /agents/{id}/toggle   → enable/disable an agent
POST   /agents/{id}/dry-run  → test the agent with a prompt
---
12. backend/app/routers/routers.py
WHAT IT DOES:
Registers ALL other API endpoints in one file:
LLM, Tools, Tasks, Task Runs, and Dashboard.
ENDPOINTS INSIDE:
LLM:
GET    /llm/                  → list all LLM configs
POST   /llm/                  → add a new LLM config
PUT    /llm/{id}              → edit an LLM config
DELETE /llm/{id}              → delete an LLM config
POST   /llm/{id}/test         → test if the API key works
Tools:
GET    /tools/                → list all tools
POST   /tools/                → create a tool
PUT    /tools/{id}            → edit a tool
DELETE /tools/{id}            → delete a tool
PATCH  /tools/{id}/toggle     → enable/disable a tool
Tasks:
GET    /tasks/                → list all tasks
POST   /tasks/                → create a task
GET    /tasks/{id}            → get one task
PUT    /tasks/{id}            → edit a task
DELETE /tasks/{id}            → delete a task
POST   /tasks/{id}/trigger    → manually run a task NOW
Task Runs (history):
GET    /task-runs/            → list all run history
GET    /task-runs/{id}        → get one run with full logs
Dashboard:
GET    /dashboard/stats       → all counts + recent runs for dashboard
---
SERVICES (business logic, called by routers)
13. backend/app/services/agent_service.py
WHAT IT DOES:
Contains the logic for running an agent dry run.
The router receives the HTTP request, then calls this service
to do the actual AI execution work.
FUNCTION: run_dry_run(agent, input_prompt, override_params, db)
Loads the agent's LLM config from the database
Loads the agent's tools from the database
Calls graph_builder.py to build the LangGraph workflow
Runs the workflow with the user's input prompt
Streams through each step (node in the graph)
Returns the final output + all intermediate steps
---
14. backend/app/services/llm_service.py
WHAT IT DOES:
Two jobs:
_build_llm() → takes a stored LLMConfig and builds a real
LangChain LLM object (ChatOpenAI, ChatAnthropic, etc.)
test_llm_connection() → sends a tiny "Say ok" message to verify
the API key and connection work
SUPPORTED PROVIDERS:
openai    → uses langchain_openai.ChatOpenAI
anthropic → uses langchain_anthropic.ChatAnthropic
groq      → uses langchain_groq.ChatGroq
ollama    → uses ChatOpenAI pointed at local Ollama URL
custom    → uses ChatOpenAI with a custom base_url
---
AGENT RUNNER
15. backend/app/agent_runner/graph_builder.py
WHAT IT DOES:
This is the core LangGraph logic.
It builds a ReAct-style agent workflow graph.
HOW IT WORKS (step by step):
Takes the Agent config, LLMConfig, and list of Tools
Builds the LLM using llm_service._build_llm()
Converts DB tool records into real LangChain tool objects
Creates a StateGraph with two nodes:
"agent" node → calls the LLM
"tools" node → executes whatever tool the LLM decided to call
Adds a conditional edge:
If the LLM returned tool_calls → go to "tools" node
If the LLM returned a final answer → go to END
Returns the compiled graph
THE LOOP (ReAct pattern):
User prompt → agent thinks → calls a tool → sees result →
agent thinks again → calls another tool OR gives final answer → END
BUILTIN TOOLS SUPPORTED:
web_search   → DuckDuckGo search
wikipedia    → Wikipedia lookup
python_repl  → runs Python code
(more can be added in _get_builtin_tool function)
---
WHAT FILES ARE STILL NEEDED (next to be created)
backend/app/celery_worker/tasks.py  → the Celery task that spawns Docker
backend/app/main.py                 → FastAPI app entry point
backend/requirements.txt            → all Python dependencies
backend/Dockerfile                  → containerize the API
docker-compose.yml                  → run everything together
.env.example                        → environment variable template
frontend/...                        → all React screens
---
QUICK MENTAL MAP
Browser (React)
↓  HTTP request
FastAPI Router  (routers/agents.py, routers/routers.py)
↓  calls
Service Layer   (services/agent_service.py, services/llm_service.py)
↓  uses
LangGraph       (agent_runner/graph_builder.py)
↓  reads config from
Database        (models/*.py via core/database.py)
↓  runs in
PostgreSQL      (configured in core/config.py)
For scheduled tasks:
Task Scheduler → Celery Worker → Docker Container → agent_runner#### LLM API Key Issues
```bash
# Test LLM connection via API
curl -X POST "http://localhost:8000/llm/{id}/test" \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Tool Execution Failures
- Check tool configurations in database
- Verify API keys for external services (DuckDuckGo, etc.)
- Review agent logs in task_runs table

#### Frontend Build Issues
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Debug Commands
```bash
# Check backend logs
cd backend
python -m uvicorn app.main:app --reload --log-level debug

# Check database contents
psql -U postgres -d ai_workflow_db -c "SELECT * FROM agents;"

# Test API endpoints
curl http://localhost:8000/health
curl http://localhost:8000/docs

# Check Redis connection
redis-cli ping
```

---

## 🤝 Contributing

### Code Style
- **Backend**: Black formatter, isort imports, type hints required
- **Frontend**: ESLint, Prettier
- **Commits**: Conventional commits format

### Testing
```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test

# Integration tests
docker-compose -f docker-compose.test.yml up
```

### Documentation
- Update this README for new features
- Add docstrings to all functions
- Update API schemas for new endpoints

---

## 📚 Additional Resources

- **FastAPI Docs**: https://fastapi.tiangolo.com/
- **LangChain Docs**: https://python.langchain.com/
- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/
- **React Docs**: https://react.dev/
- **SQLAlchemy Docs**: https://sqlalchemy.org/

---

*This guide is maintained by Vishal. Last updated: April 1st 2026*
