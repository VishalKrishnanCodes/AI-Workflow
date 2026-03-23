# PATH: backend/app/routers/agents.py
#
# PURPOSE:
#   Handles all HTTP requests for the Agent Management screen.
#   Each function below is one API endpoint.
#
# ENDPOINTS:
#   GET    /agents/              → list all agents
#   POST   /agents/              → create a new agent
#   GET    /agents/{id}          → get a single agent
#   PUT    /agents/{id}          → update an agent
#   DELETE /agents/{id}          → delete an agent
#   PATCH  /agents/{id}/toggle   → flip active ↔ inactive
#   POST   /agents/{id}/dry-run  → test the agent with a prompt

import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.agent import Agent, AgentStatus
from app.schemas.agent import AgentCreate, AgentUpdate, AgentResponse, DryRunRequest, DryRunResponse
from app.services.agent_service import run_dry_run

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.get("/", response_model=List[AgentResponse])
def list_agents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Agent).offset(skip).limit(limit).all()


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(payload: AgentCreate, db: Session = Depends(get_db)):
    agent = Agent(**payload.model_dump())
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent(agent_id: UUID, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.put("/{agent_id}", response_model=AgentResponse)
def update_agent(agent_id: UUID, payload: AgentUpdate, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    db.commit()
    db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: UUID, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.delete(agent)
    db.commit()


@router.patch("/{agent_id}/toggle", response_model=AgentResponse)
def toggle_agent(agent_id: UUID, db: Session = Depends(get_db)):
    """Enable or disable an agent — flips active ↔ inactive."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.status = (
        AgentStatus.inactive if agent.status == AgentStatus.active
        else AgentStatus.active
    )
    db.commit()
    db.refresh(agent)
    return agent


@router.post("/{agent_id}/dry-run", response_model=DryRunResponse)
async def dry_run_agent(agent_id: UUID, payload: DryRunRequest, db: Session = Depends(get_db)):
    """
    Test an agent with a prompt without creating a task or spawning Docker.
    Used by the Dry Run panel at the bottom of the Agent Management screen.
    """
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    start = time.time()
    result = await run_dry_run(agent, payload.input_prompt, payload.override_params or {}, db)
    return DryRunResponse(
        agent_id=agent_id,
        input_prompt=payload.input_prompt,
        output=result.get("output", ""),
        steps=result.get("steps", []),
        duration_ms=int((time.time() - start) * 1000),
        status=result.get("status", "success"),
        error=result.get("error"),
    )