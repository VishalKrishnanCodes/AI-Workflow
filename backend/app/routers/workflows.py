# PATH: backend/app/routers/workflows.py
#
# PURPOSE:
#   Handles the Workflow Builder page operations.
#   A "workflow" in this context is a Task with a rich workflow_config
#   that stores: use-case description, LLM assignments per node,
#   selected tools, and the LangGraph node/edge definition.
#
# ENDPOINTS:
#   POST /workflows/dry-run   → run a workflow config without saving it
#   POST /workflows/save      → save a workflow as a Task (draft status)
#   GET  /workflows/          → list all saved workflow-tasks
#   GET  /workflows/{id}      → get a single workflow-task with full config

import time
import uuid as uuid_lib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from uuid import UUID

from app.core.database import get_db
from app.models.agent import Agent
from app.models.task import Task, TaskStatus, TriggerType
from app.models.llm_config import LLMConfig
from app.models.tool import Tool

router = APIRouter(prefix="/workflows", tags=["Workflow Builder"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class WorkflowNode(BaseModel):
    id:           str
    label:        str
    type:         str           # "input" | "llm" | "tool" | "output"
    llm_config_id: Optional[str] = None
    tool_id:      Optional[str] = None
    prompt:       Optional[str] = None   # per-node prompt/instruction
    config:       Optional[Dict[str, Any]] = {}


class WorkflowEdge(BaseModel):
    id:     str
    source: str    # node id
    target: str    # node id
    label:  Optional[str] = None


class WorkflowConfig(BaseModel):
    nodes: List[WorkflowNode] = []
    edges: List[WorkflowEdge] = []


class WorkflowDryRunRequest(BaseModel):
    # The use-case description
    use_case:         str

    # Which agent to run this under
    agent_id:         Optional[str] = None

    # LLM to use (overrides agent's default if set)
    llm_config_id:    Optional[str] = None

    # Tool IDs selected for this workflow
    tool_ids:         List[str] = []

    # The actual LangGraph workflow definition
    workflow_config:  Optional[WorkflowConfig] = None

    # The test prompt for the dry run
    test_prompt:      str


class WorkflowSaveRequest(BaseModel):
    name:             str
    use_case:         str
    agent_id:         str
    llm_config_id:    Optional[str] = None
    tool_ids:         List[str] = []
    workflow_config:  Optional[WorkflowConfig] = None
    docker_image:     Optional[str] = "ai-workflow-agent-runner:latest"
    docker_timeout_seconds: Optional[str] = "300"


# ── Dry Run ────────────────────────────────────────────────────────────────────

@router.post("/dry-run")
async def workflow_dry_run(
    payload: WorkflowDryRunRequest,
    db: Session = Depends(get_db),
):
    """
    Executes a workflow configuration as a dry run without saving anything.
    Used by the Test / Dry Run section at the bottom of the Workflow Builder page.

    If agent_id is provided, loads that agent and merges the workflow overrides on top.
    If no agent_id, builds a temporary in-memory agent from the provided config.
    """
    start = time.time()

    try:
        # ── Load or build agent ─────────────────────────────────────────────
        if payload.agent_id:
            agent = db.query(Agent).filter(Agent.id == payload.agent_id).first()
            if not agent:
                raise HTTPException(status_code=404, detail="Agent not found")
            # Override tools and LLM if provided in the workflow config
            if payload.tool_ids:
                agent.tool_ids = payload.tool_ids
            if payload.llm_config_id:
                agent.llm_config_id = payload.llm_config_id
        else:
            # Build a temporary agent object without touching the DB
            from types import SimpleNamespace
            agent = SimpleNamespace(
                id=str(uuid_lib.uuid4()),
                name="Workflow Dry Run",
                system_prompt=payload.use_case,
                tool_ids=payload.tool_ids,
                llm_config_id=payload.llm_config_id,
                max_iterations="10",
                workflow_config=payload.workflow_config.model_dump() if payload.workflow_config else {},
            )

        # ── Load LLM config ─────────────────────────────────────────────────
        llm_config = None
        llm_id = payload.llm_config_id or (agent.llm_config_id if hasattr(agent, 'llm_config_id') else None)
        if llm_id:
            try:
                llm_config = db.query(LLMConfig).filter(LLMConfig.id == llm_id).first()
            except Exception:
                pass

        # ── Load tools ──────────────────────────────────────────────────────
        tools = []
        tool_ids = payload.tool_ids or (agent.tool_ids if hasattr(agent, 'tool_ids') else [])
        if tool_ids:
            tools = db.query(Tool).filter(
                Tool.id.in_(tool_ids),
                Tool.is_enabled == True,
            ).all()

        # ── Run LangGraph ───────────────────────────────────────────────────
        from app.agent_runner.graph_builder import build_agent_graph
        graph = build_agent_graph(agent, llm_config, tools, {})

        steps = []
        final_output = ""

        async for event in graph.astream(
            {"messages": [{"role": "user", "content": payload.test_prompt}]}
        ):
            node_name   = list(event.keys())[0]
            node_output = event[node_name]
            steps.append({
                "node":   node_name,
                "output": str(node_output)[:1000],
            })
            if node_name == "agent":
                msgs = node_output.get("messages", [])
                if msgs:
                    last = msgs[-1]
                    if hasattr(last, "content") and isinstance(last.content, str):
                        final_output = last.content

        return {
            "output":      final_output,
            "steps":       steps,
            "duration_ms": int((time.time() - start) * 1000),
            "status":      "success",
            "error":       None,
        }

    except Exception as exc:
        return {
            "output":      "",
            "steps":       [],
            "duration_ms": int((time.time() - start) * 1000),
            "status":      "error",
            "error":       str(exc),
        }


# ── Save Workflow as Task ──────────────────────────────────────────────────────

@router.post("/save")
def save_workflow(payload: WorkflowSaveRequest, db: Session = Depends(get_db)):
    """
    Saves a workflow configuration as a Task in draft status.
    The workflow_config JSON is stored on the task's input_payload
    so the Scheduler page can pick it up and run it.
    """
    # Validate agent exists
    try:
        agent = db.query(Agent).filter(Agent.id == payload.agent_id).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid agent_id")

    task = Task(
        name=payload.name,
        description=payload.use_case,
        agent_id=payload.agent_id,
        trigger_type=TriggerType.manual,
        status=TaskStatus.draft,
        docker_image=payload.docker_image or "ai-workflow-agent-runner:latest",
        docker_timeout_seconds=payload.docker_timeout_seconds or "300",
        input_payload={
            "prompt":          payload.use_case,
            "llm_config_id":   payload.llm_config_id,
            "tool_ids":        payload.tool_ids,
            "workflow_config": payload.workflow_config.model_dump() if payload.workflow_config else {},
        },
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return {
        "id":      str(task.id),
        "name":    task.name,
        "status":  task.status,
        "message": "Workflow saved as a draft task. Go to Scheduler to activate it.",
    }


# ── List / Get saved workflows ─────────────────────────────────────────────────

@router.get("/")
def list_workflows(db: Session = Depends(get_db)):
    """Returns all tasks that have a workflow_config in their input_payload."""
    tasks = db.query(Task).filter(
        Task.input_payload.isnot(None),
    ).order_by(Task.created_at.desc()).all()

    result = []
    for t in tasks:
        payload = t.input_payload or {}
        if "workflow_config" in payload:
            result.append({
                "id":              str(t.id),
                "name":            t.name,
                "description":     t.description,
                "status":          t.status,
                "agent_id":        str(t.agent_id),
                "llm_config_id":   payload.get("llm_config_id"),
                "tool_ids":        payload.get("tool_ids", []),
                "workflow_config": payload.get("workflow_config", {}),
                "created_at":      t.created_at.isoformat() if t.created_at else None,
                "updated_at":      t.updated_at.isoformat() if t.updated_at else None,
            })
    return result


@router.get("/{workflow_id}")
def get_workflow(workflow_id: UUID, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == workflow_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Workflow not found")
    payload = task.input_payload or {}
    return {
        "id":              str(task.id),
        "name":            task.name,
        "description":     task.description,
        "status":          task.status,
        "agent_id":        str(task.agent_id),
        "llm_config_id":   payload.get("llm_config_id"),
        "tool_ids":        payload.get("tool_ids", []),
        "workflow_config": payload.get("workflow_config", {}),
        "created_at":      task.created_at.isoformat() if task.created_at else None,
    }