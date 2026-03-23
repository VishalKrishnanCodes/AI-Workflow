import uuid 
import enum
from sqlalchemy import Column, String, Text, JSON, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID 
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class TriggerType(str, enum.Enum):
    cron = "cron"
    manual = "manual"
    webhook = "webhook"
    event = "event"

class TaskStatus(str, enum.Enum):
    active = "active"   # task is enabled and will run on schedule
    paused = "paused"   # task is temporarily disabled
    draft  = "draft"    # task is being configured, not yet active  

class Task(Base):
    __tablename__ = "tasks"
 
    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
 
    # Which agent this task runs — must exist in the agents table
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
 
    # ── Scheduling ─────────────────────────────────────────────────────────────
    trigger_type    = Column(Enum(TriggerType), default=TriggerType.manual)
    cron_expression = Column(String(100), nullable=True)  # e.g. "0 9 * * 1-5" = 9am Mon-Fri
    webhook_secret  = Column(String(255), nullable=True)  # secret to validate webhook calls
 
    # ── Execution ──────────────────────────────────────────────────────────────
    # The data/prompt passed to the agent when it runs
    input_payload = Column(JSON, nullable=True, default=dict)
 
    # Docker image to use for this task's container
    # If empty, falls back to settings.DOCKER_RUNNER_IMAGE
    docker_image = Column(String(500), nullable=True)
 
    # Extra environment variables injected into the container
    docker_env_vars = Column(JSON, nullable=True, default=dict)
 
    # Kill the container if it runs longer than this (seconds)
    docker_timeout_seconds = Column(String(10), nullable=True, default="300")
 
    status = Column(Enum(TaskStatus), default=TaskStatus.draft)
 
    # Celery beat periodic task ID — stored so we can cancel/reschedule cron tasks
    celery_task_id = Column(String(255), nullable=True)
 
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
 
    # One task → many runs (full history)
    agent = relationship("Agent", back_populates="tasks")
    runs  = relationship("TaskRun", back_populates="task", cascade="all, delete-orphan")
 
    def __repr__(self):
        return f"<Task id={self.id} name={self.name} trigger={self.trigger_type}>"
 