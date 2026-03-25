# PATH: backend/app/routers/dashboard.py
#
# PURPOSE:
#   Provides the single endpoint that powers the Dashboard landing page.
#   Returns all counts and recent run history in one API call.
#
# ENDPOINTS:
#   GET /dashboard/stats  → all metrics for the dashboard

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.agent import Agent, AgentStatus
from app.models.tool import Tool
from app.models.task import Task, TaskStatus, TriggerType
from app.models.task_run import TaskRun, RunStatus
from app.schemas.task_run import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Returns all numbers needed to populate the Dashboard:
      - total_agents        → total count of agents created
      - active_agents       → agents with status=active
      - total_tools         → total tools in the library
      - enabled_tools       → tools currently switched on
      - total_tasks         → total scheduled tasks
      - active_schedules    → cron tasks that are currently active
      - total_runs          → all-time run count
      - successful_runs     → runs that exited with code 0
      - failed_runs         → runs that errored or timed out
      - recent_runs         → last 10 runs for the activity feed
    """
    total_agents     = db.query(func.count(Agent.id)).scalar()     or 0
    active_agents    = db.query(func.count(Agent.id)).filter(
                           Agent.status == AgentStatus.active
                       ).scalar() or 0

    total_tools      = db.query(func.count(Tool.id)).scalar()      or 0
    enabled_tools    = db.query(func.count(Tool.id)).filter(
                           Tool.is_enabled == True
                       ).scalar() or 0

    total_tasks      = db.query(func.count(Task.id)).scalar()      or 0
    active_schedules = db.query(func.count(Task.id)).filter(
                           Task.status      == TaskStatus.active,
                           Task.trigger_type == TriggerType.cron,
                       ).scalar() or 0

    total_runs       = db.query(func.count(TaskRun.id)).scalar()   or 0
    successful_runs  = db.query(func.count(TaskRun.id)).filter(
                           TaskRun.status == RunStatus.success
                       ).scalar() or 0
    failed_runs      = db.query(func.count(TaskRun.id)).filter(
                           TaskRun.status == RunStatus.failed
                       ).scalar() or 0

    recent_runs = (
        db.query(TaskRun)
        .order_by(TaskRun.started_at.desc())
        .limit(10)
        .all()
    )

    return DashboardStats(
        total_agents=total_agents,
        active_agents=active_agents,
        total_tools=total_tools,
        enabled_tools=enabled_tools,
        total_tasks=total_tasks,
        active_schedules=active_schedules,
        total_runs=total_runs,
        successful_runs=successful_runs,
        failed_runs=failed_runs,
        recent_runs=recent_runs,
    )