from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "AI Workflow"
    DEBUG: bool = False
    SECRET_KEY: str = "changeme-in-production"

    DATABASE_URL: str = "postgresql://user:password@localhost:5432/ai_workflow"

    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    DOCKER_RUNNER_IMAGE: str = "ai-workflow-agent-runner:latest"
    DOCKER_NETWORK: str = "ai_workflow_network"

    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"

settings = Settings()