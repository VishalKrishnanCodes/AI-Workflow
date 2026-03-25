# PATH: backend/app/celery_worker/celery_app.py

# PURPOSE:
#   Creates the Celery application instance.
#   Celery is the task queue that runs jobs in the background.

# HOW IT FITS IN:
#   1. A user triggers a task (manually or via cron)
#   2. The FastAPI router calls execute_task.delay(task_id, run_id)
#   3. Celery puts the job onto the Redis queue (broker)
#   4. A Celery worker process picks up the job from the queue
#   5. The worker runs tasks.py → execute_task() → spawns Docker container
#   6. Result is stored back in Redis (result backend)

# TO START THE WORKER (run this in a terminal):
#   celery -A app.celery_worker.celery_app worker --loglevel=info
#
# TO START THE BEAT SCHEDULER (for cron tasks):
#   celery -A app.celery_worker.celery_app beat --loglevel=info

from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "ai_workflow",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.celery_worker.tasks"],  # tells Celery where to find task functions
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Timezone
    timezone="UTC",
    enable_utc=True,

    # Reliability settings
    task_acks_late=True,              # only mark task done after it finishes (not when picked up)
    task_reject_on_worker_lost=True,  # re-queue if worker crashes mid-task

    # Result expiry — keep results in Redis for 24 hours
    result_expires=86400,
)