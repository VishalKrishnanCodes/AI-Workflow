# PATH: backend/app/schemas/agent.py
#
# PURPOSE:
#   Pydantic schemas that define the shape of data coming INTO and going OUT OF
#   the /agents API endpoints. These are NOT the database models — they are the
#   API contract between the frontend and backend.
#
#   AgentCreate  → shape of the body when frontend POSTs to create an agent
#   AgentUpdate  → shape of the body when frontend PUTs to edit an agent
#   AgentResponse → shape of the JSON the backend sends back to the frontend
#   DryRunRequest → what the frontend sends when testing an agent
#   DryRunResponse → what the backend returns after a dry run

from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime
from app.models.agent import AgentStatus


class AgentCreate(BaseModel):
    name:               str                     = Field(..., min_length=1, max_length=255)
    description:        Optional[str]           = None
    system_prompt:      Optional[str]           = None
    workflow_config:    Optional[Dict[str, Any]]= {}
    llm_config_id:      Optional[UUID]          = None
    tool_ids:           Optional[List[str]]     = []
    skill_ids:          Optional[List[str]]     = []
    domain:             Optional[str]           = None
    max_iterations:     Optional[str]           = "10"


class AgentUpdate(BaseModel):
    name:               Optional[str]            = None
    description:        Optional[str]            = None
    system_prompt:      Optional[str]            = None
    workflow_config:    Optional[Dict[str, Any]] = None
    llm_config_id:      Optional[UUID]           = None
    tool_ids:           Optional[List[str]]      = None
    skill_ids:          Optional[List[str]]      = None
    domain:             Optional[str]            = None
    max_iterations:     Optional[str]            = None
    status:             Optional[AgentStatus]    = None


class AgentResponse(BaseModel):
    id:              UUID
    name:            str
    description:     Optional[str]            = None
    status:          AgentStatus
    system_prompt:   Optional[str]            = None
    workflow_config: Optional[Dict[str, Any]] = {}
    llm_config_id:   Optional[UUID]           = None
    tool_ids:        Optional[List[str]]      = []
    skill_ids:       Optional[List[str]]      = []
    domain:          Optional[str]            = None
    max_iterations:  Optional[str]            = None
    created_at:      datetime
    updated_at:      Optional[datetime]       = None

    class Config:
        from_attributes = True


class DryRunRequest(BaseModel):
    input_prompt:    str                      = Field(..., min_length=1)
    override_params: Optional[Dict[str, Any]] = {}


class DryRunResponse(BaseModel):
    agent_id:     UUID
    input_prompt: str
    output:       str
    steps:        List[Dict[str, Any]] = []   # each step the LangGraph graph visited
    duration_ms:  int
    status:       str                         # "success" or "error"
    error:        Optional[str] = None