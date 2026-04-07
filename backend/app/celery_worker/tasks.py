# PATH: backend/app/celery_worker/tasks.py
#
# PURPOSE:
#   Defines the `execute_task` Celery task — the worker function that
#   runs every time a scheduled or manually triggered task fires.
#
# WHAT IT DOES (step by step):
#   1. Opens a database session
#   2. Loads the Task and TaskRun records from PostgreSQL
#   3. Marks the run status as RUNNING
#   4. Builds Docker environment variables from the task config
#   5. Spawns a Docker container using the agent-runner image
#   6. Waits for the container to finish (with timeout)
#   7. Collects all stdout/stderr logs from the container
#   8. Removes the container
#   9. Updates the TaskRun record: status, exit_code, logs, duration
#  10. Closes the database session
#
# THE DOCKER CONTAINER:
#   The container runs agent-runner/run_agent.py which:
#     - Calls the FastAPI /agents/{id} endpoint to load config
#     - Builds the LangGraph graph
#     - Runs the agent with the task's input_payload
#     - Prints logs to stdout (captured here)

import docker
from datetime import datetime, timezone

from app.celery_worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.config import settings
from app.models.task import Task
from app.models.task_run import TaskRun, RunStatus

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def execute_task(self, task_id: str, run_id: str):
    """
    Celery task that spawns a Docker container to run an AI agent.

    Args:
        task_id → UUID string of the Task record
        run_id  → UUID string of the TaskRun record (already created by the router)

    The `bind=True` gives us access to `self` so we can call self.retry()
    on failures, which re-queues the job up to max_retries times.
    """
    db  = SessionLocal()
    run = None

    try:
        # ── Load records from DB ──────────────────────────────────────────────
        task: Task    = db.query(Task).filter(Task.id == task_id).first()
        run:  TaskRun = db.query(TaskRun).filter(TaskRun.id == run_id).first()

        if not task:
            raise ValueError(f"Task {task_id} not found")
        if not run:
            raise ValueError(f"TaskRun {run_id} not found")

        # ── Mark as running ───────────────────────────────────────────────────
        run.status     = RunStatus.running
        run.started_at = datetime.now(timezone.utc)
        db.commit()

        # ── Build environment variables for the container ─────────────────────
        # These are read by run_agent.py inside the container
        env_vars = {
            "TASK_ID":       str(task.id),
            "RUN_ID":        str(run.id),
            "AGENT_ID":      str(task.agent_id),
            # Internal URL so the container can call the FastAPI backend
            "API_BASE_URL":  getattr(settings, "DOCKER_API_BASE_URL", "http://host.docker.internal:8000"),
        }
        # Merge any task-level custom env vars (e.g. API keys for specific tools)
        if task.docker_env_vars:
            env_vars.update(task.docker_env_vars)

        # ── Spawn the Docker container ────────────────────────────────────────
        docker_client = docker.from_env()
        image         = task.docker_image or settings.DOCKER_RUNNER_IMAGE
        timeout_secs  = int(task.docker_timeout_seconds or 300)

        container = docker_client.containers.run(
            image=image,
            environment=env_vars,
            network=settings.DOCKER_NETWORK,
            detach=True,          # run in background, don't block
            remove=False,         # keep container after exit so we can read logs
            mem_limit="512m",     # prevent runaway memory usage
            cpu_period=100000,
            cpu_quota=50000,      # cap at 50% of one CPU core
        )

        # Save container ID immediately in case we need to debug
        run.container_id = container.id
        run.docker_image = image
        db.commit()

        # ── Wait for container to finish ──────────────────────────────────────
        # container.wait() blocks until the container exits or timeout is hit
        result    = container.wait(timeout=timeout_secs)
        exit_code = result.get("StatusCode", -1)

        # ── Collect logs ──────────────────────────────────────────────────────
        logs = container.logs(stdout=True, stderr=True).decode("utf-8", errors="replace")

        # ── Remove the container ──────────────────────────────────────────────
        try:
            container.remove(force=True)
        except Exception:
            pass  # non-critical if removal fails

        # ── Update run record ─────────────────────────────────────────────────
        finished_at           = datetime.now(timezone.utc)
        run.finished_at       = finished_at
        run.exit_code         = exit_code
        run.logs              = logs
        run.duration_seconds  = int((finished_at - run.started_at).total_seconds())
        run.status            = RunStatus.success if exit_code == 0 else RunStatus.failed

        if exit_code != 0:
            # Grab the last 500 chars of logs as the error summary
            run.error_message = logs[-500:] if logs else "Container exited with non-zero code"

        # Update the task's last_run timestamp
        task.last_run_at = finished_at
        db.commit()

    except docker.errors.ImageNotFound as exc:
        # Image doesn't exist — no point retrying, user needs to fix the image name
        _mark_failed(db, run, f"Docker image not found: {exc}")
        raise

    except docker.errors.APIError as exc:
        _mark_failed(db, run, f"Docker API error: {exc}")
        raise self.retry(exc=exc)

    except Exception as exc:
        _mark_failed(db, run, str(exc))
        raise self.retry(exc=exc)

    finally:
        db.close()


def _mark_failed(db, run: TaskRun, error_message: str):
    """
    Helper that marks a run as failed and saves to DB.
    Called in every except block so failures are always recorded.
    """
    if run is None:
        return
    try:
        run.status        = RunStatus.failed
        run.finished_at   = datetime.now(timezone.utc)
        run.error_message = error_message
        if run.started_at and run.finished_at:
            run.duration_seconds = int(
                (run.finished_at - run.started_at).total_seconds()
            )
        db.commit()
    except Exception:
        db.rollback()