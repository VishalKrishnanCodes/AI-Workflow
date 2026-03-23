# PATH: backend/app/models/task_run.py
#
# PURPOSE:
#   Defines the `task_runs` table.
#   One row = one actual execution of a task.
#   This is what powers the "Task Run History" screen.
#   Every time a task fires (manually or on schedule), a new row is inserted here.

import uuid
import enum
from sqlalchemy import Column, String, Text, JSON, DateTime, Integer, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class RunStatus(str, enum.Enum):
    pending   = "pending"    # created, waiting for a Celery worker to pick it up
    running   = "running"    # Celery worker has started the Docker container
    success   = "success"    # container exited with code 0
    failed    = "failed"     # container exited with non-zero code or exception
    timeout   = "timeout"    # container was killed because it exceeded the time limit
    cancelled = "cancelled"  # user manually cancelled the run


class TaskRun(Base):
    __tablename__ = "task_runs"

    id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False)

    # ── Status & result ────────────────────────────────────────────────────────
    status    = Column(Enum(RunStatus), default=RunStatus.pending, nullable=False)
    exit_code = Column(Integer, nullable=True)  # 0 = success, anything else = error

    # ── Timing ─────────────────────────────────────────────────────────────────
    started_at       = Column(DateTime(timezone=True), server_default=func.now())
    finished_at      = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)  # finished_at - started_at

    # ── Docker info ────────────────────────────────────────────────────────────
    container_id = Column(String(255), nullable=True)  # Docker container ID for debugging
    docker_image = Column(String(500), nullable=True)  # which image was used

    # ── Input / Output ─────────────────────────────────────────────────────────
    input_payload = Column(JSON, nullable=True, default=dict)  # what was sent to the agent
    output        = Column(JSON, nullable=True, default=dict)  # what the agent returned

    # Full stdout + stderr from the container — shown in the log viewer on the UI
    logs          = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)  # human-readable failure reason

    # ── Tracking ───────────────────────────────────────────────────────────────
    celery_task_id = Column(String(255), nullable=True)  # Celery async task ID
    triggered_by   = Column(String(50),  nullable=True)  # "manual" | "cron" | "webhook"

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("Task", back_populates="runs")

    def __repr__(self):
        return f"<TaskRun id={self.id} task_id={self.task_id} status={self.status}>"