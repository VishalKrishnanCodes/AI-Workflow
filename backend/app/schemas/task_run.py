# PATH: backend/app/schemas/task_run.py
#
# PURPOSE:
#   API contract for the /task-runs and /dashboard endpoints.
#
#   TaskRunResponse  → one row in the Task Run History table
#   DashboardStats   → all the numbers shown on the Dashboard page

from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from uuid import UUID
from datetime import datetime
from app.models.task_run import RunStatus

class TaskRunResponse(BaseModel):
    id:               UUID
    task_id:          UUID
    status:           RunStatus
    exit_code:        Optional[int]            = None
    started_at:       datetime
    finished_at:      Optional[datetime]       = None
    duration_seconds: Optional[int]            = None
    container_id:     Optional[str]            = None
    docker_image:     Optional[str]            = None
    input_payload:    Optional[Dict[str, Any]] = {}
    output:           Optional[Dict[str, Any]] = {}
    logs:             Optional[str]            = None
    error_message:    Optional[str]            = None
    triggered_by:     Optional[str]            = None
    celery_task_id:   Optional[str]            = None
    created_at:       datetime

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    total_agents:     int
    active_agents:    int
    total_tools:      int
    enabled_tools:    int
    total_tasks:      int
    active_schedules: int
    total_runs:       int
    successful_runs:  int
    failed_runs:      int
    recent_runs:      List[TaskRunResponse] = []