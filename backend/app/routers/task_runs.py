# PATH: backend/app/routers/task_runs.py
#
# PURPOSE:
#   Handles all HTTP requests for the Task Run History screen.
#
# ENDPOINTS:
#   GET    /task-runs/        → list all run history (filterable by task_id)
#   GET    /task-runs/{id}    → get one run — includes full logs
#   DELETE /task-runs/{id}    → delete a single run record

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.models.task_run import TaskRun
from app.schemas.task_run import TaskRunResponse

router = APIRouter(prefix="/task-runs", tags=["Task Run History"])


@router.get("/", response_model=List[TaskRunResponse])
def list_runs(
    task_id: Optional[UUID] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """
    Returns run history, newest first.
    Pass ?task_id=<uuid> to filter runs for a specific task.
    Pass ?skip=0&limit=50 for pagination.
    """
    query = db.query(TaskRun)
    if task_id:
        query = query.filter(TaskRun.task_id == task_id)
    return query.order_by(TaskRun.started_at.desc()).offset(skip).limit(limit).all()


@router.get("/{run_id}", response_model=TaskRunResponse)
def get_run(run_id: UUID, db: Session = Depends(get_db)):
    """
    Get a single run by ID.
    This includes the full `logs` field — used by the log viewer
    when the user expands a row in the Task Run History table.
    """
    run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.delete("/{run_id}", status_code=204)
def delete_run(run_id: UUID, db: Session = Depends(get_db)):
    run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    db.delete(run)
    db.commit()