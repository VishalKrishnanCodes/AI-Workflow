from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "AI Workflow"
    DEBUG: bool = False
    SECRET_KEY: str = "changeme-in-production"

    #DATABASE_URL: str = "postgresql://postgres:Dev123%21%40%23@localhost:5432/ai_workflow"
    DATABASE_URL: str = "postgresql://neondb_owner:npg_3DyIgf7BlhTa@ep-mute-band-a1i3c8n0-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    #DATABASE_URL = "postgresql://neondb_owner:password@ep-xxx.neon.tech/neondb?sslmode=require"
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    DOCKER_RUNNER_IMAGE: str = "ai-workflow-agent-runner:latest"
    DOCKER_NETWORK: str = "ai_workflow_network"

    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    openai_api_key : str
    class Config:
        env_file = ".env"

settings = Settings()