import logging
import traceback
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from croniter import croniter

from app.celery_worker.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.task import Task, TriggerType, TaskStatus
from app.models.task_run import TaskRun, RunStatus

logger = logging.getLogger(__name__)

ist = ZoneInfo("Asia/Kolkata")  # ← define once at module level


@celery_app.task
def check_and_trigger_tasks():
    db = SessionLocal()
    try:
        now = datetime.now(ist)  # ← IST now

        tasks = db.query(Task).filter(
            Task.status == TaskStatus.active,
            Task.trigger_type == TriggerType.cron,
            Task.cron_expression.isnot(None)
        ).all()

        logger.warning(f"Found {len(tasks)} cron tasks")

        for task in tasks:
            try:
                # If next_run_at is not set, initialize it
                if not task.next_run_at:
                    base_time = task.last_run_at or task.created_at or now
                    cron = croniter(task.cron_expression, base_time)
                    task.next_run_at = cron.get_next(datetime).replace(tzinfo=ist)  # ← ist
                    db.commit()

                # Normalize next_run_at to tz-aware
                next_run = task.next_run_at
                if next_run.tzinfo is None:
                    next_run = next_run.replace(tzinfo=ist)  # ← ist, not utc

                logger.warning(f"Task '{task.name}': next_run={next_run}, now={now}, due={now >= next_run}")

                if now >= next_run:
                    run = TaskRun(
                        task_id=task.id,
                        triggered_by="cron",
                        status=RunStatus.pending,
                        docker_image=task.docker_image,
                        input_payload=task.input_payload,
                    )
                    db.add(run)
                    db.commit()
                    db.refresh(run)

                    from app.celery_worker.tasks import execute_task
                    celery_result = execute_task.delay(str(task.id), str(run.id))

                    run.celery_task_id = celery_result.id

                    cron = croniter(task.cron_expression, now)
                    task.next_run_at = cron.get_next(datetime).replace(tzinfo=ist)  # ← ist
                    db.commit()

                    logger.warning(f"Task '{task.name}' triggered! Next run: {task.next_run_at}")

            except Exception as e:
                logger.warning(f"Error scheduling task {task.id} '{task.name}': {e}")
                logger.warning(traceback.format_exc())

    except Exception as e:
        logger.warning(f"Error in scheduler periodic task: {e}")
        logger.warning(traceback.format_exc())
    finally:
        db.close()