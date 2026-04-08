# PATH: backend/app/schemas/task.py
#
# PURPOSE:
#   API contract for the /tasks endpoints.

from pydantic import BaseModel
from typing import Optional, Any, Dict
from uuid import UUID
from datetime import datetime
from app.models.task import TriggerType, TaskStatus

class TaskCreate(BaseModel):
    name:                   str
    description:            Optional[str]            = None
    agent_id:               UUID
    trigger_type:           TriggerType              = TriggerType.manual
    cron_expression:        Optional[str]            = None
    webhook_secret:         Optional[str]            = None
    input_payload:          Optional[Dict[str, Any]] = {}
    docker_image:           Optional[str]            = None
    docker_env_vars:        Optional[Dict[str, str]] = {}
    docker_timeout_seconds: Optional[str]            = "300"
    status:                 Optional[TaskStatus]     = TaskStatus.active


class TaskUpdate(BaseModel):
    name:                   Optional[str]            = None
    description:            Optional[str]            = None
    agent_id:               Optional[UUID]           = None
    trigger_type:           Optional[TriggerType]    = None
    cron_expression:        Optional[str]            = None
    webhook_secret:         Optional[str]            = None
    input_payload:          Optional[Dict[str, Any]] = None
    docker_image:           Optional[str]            = None
    docker_env_vars:        Optional[Dict[str, str]] = None
    docker_timeout_seconds: Optional[str]            = None
    status:                 Optional[TaskStatus]     = None


class TaskResponse(BaseModel):
    id:                     UUID
    name:                   str
    description:            Optional[str]            = None
    agent_id:               UUID
    trigger_type:           TriggerType
    cron_expression:        Optional[str]            = None
    webhook_secret:         Optional[str]            = None
    input_payload:          Optional[Dict[str, Any]] = {}
    docker_image:           Optional[str]            = None
    docker_env_vars:        Optional[Dict[str, str]] = {}
    docker_timeout_seconds: Optional[str]            = None
    status:                 TaskStatus
    celery_task_id:         Optional[str]            = None
    created_at:             datetime
    updated_at:             Optional[datetime]       = None
    last_run_at:            Optional[datetime]       = None
    next_run_at:            Optional[datetime]       = None

    class Config:
        from_attributes = True


class TaskTriggerResponse(BaseModel):
    task_id: UUID
    run_id:  UUID
    message: str