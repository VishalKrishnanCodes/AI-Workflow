# PATH: backend/app/routers/tasks.py
#
# PURPOSE:
#   Handles all HTTP requests for the Task Scheduler screen.
#
# ENDPOINTS:
#   GET    /tasks/              → list all tasks
#   POST   /tasks/              → create a new task
#   GET    /tasks/{id}          → get one task
#   PUT    /tasks/{id}          → edit a task
#   DELETE /tasks/{id}          → delete a task
#   PATCH  /tasks/{id}/toggle   → pause or resume a task
#   POST   /tasks/{id}/trigger  → run a task right now (manual trigger)

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.agent import Agent
from app.models.task import Task, TaskStatus
from app.models.task_run import TaskRun, RunStatus
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskTriggerResponse

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("/", response_model=List[TaskResponse])
def list_tasks(db: Session = Depends(get_db)):
    return db.query(Task).order_by(Task.created_at.desc()).all()

@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    # Verify the referenced agent exists before creating the task
    agent = db.query(Agent).filter(Agent.id == payload.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: UUID, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: UUID, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
        if field == "cron_expression":
            task.next_run_at = None
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: UUID, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()


@router.patch("/{task_id}/toggle", response_model=TaskResponse)
def toggle_task(task_id: UUID, db: Session = Depends(get_db)):
    """Pause an active task, or resume a paused task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = (
        TaskStatus.paused if task.status == TaskStatus.active
        else TaskStatus.active
    )
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/trigger", response_model=TaskTriggerResponse)
def trigger_task_manually(task_id: UUID, db: Session = Depends(get_db)):
    """
    Manually run a task right now — bypasses the cron schedule.
    Steps:
      1. Creates a TaskRun record with status=pending
      2. Sends the job to Celery via execute_task.delay()
      3. Celery worker picks it up and spawns a Docker container
      4. Returns the run_id so the frontend can poll for status
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Create a run record immediately so the frontend has something to track
    run = TaskRun(
        task_id=task.id,
        triggered_by="manual",
        status=RunStatus.pending,
        docker_image=task.docker_image,
        input_payload=task.input_payload,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # Dispatch to Celery — this is non-blocking, returns immediately
    from app.celery_worker.tasks import execute_task
    celery_result = execute_task.delay(str(task.id), str(run.id))

    # Save the Celery task ID so we can check status later if needed
    run.celery_task_id = celery_result.id
    db.commit()

    return TaskTriggerResponse(
        task_id=task.id,
        run_id=run.id,
        message=f"Task queued successfully. Celery ID: {celery_result.id}",
    )