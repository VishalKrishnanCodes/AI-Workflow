# PATH: backend/app/models/llm_config.py
#
# PURPOSE:
#   Defines the `llm_configs` table.
#   One row = one saved LLM configuration.
#   Users can save multiple LLM configs (e.g. "GPT-4 for prod", "Ollama for testing")
#   and assign them to different agents.

import uuid
from sqlalchemy import Column, String, Text, JSON, DateTime, Boolean, Float, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base


class LLMConfig(Base):
    __tablename__ = "llm_configs"

    id       = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name     = Column(String(255), nullable=False)  # friendly label e.g. "My GPT-4 Config"

    # Which LLM provider to use
    # Supported values: openai | anthropic | groq | ollama | custom
    provider = Column(String(100), nullable=False)

    # The exact model name to pass to the API
    # e.g. gpt-4o, claude-3-5-sonnet-20241022, llama3, mixtral-8x7b-32768
    model    = Column(String(200), nullable=False)

    # API credentials — store encrypted in production using Vault or AWS Secrets Manager
    api_key      = Column(Text, nullable=True)
    api_base_url = Column(Text, nullable=True)  # needed for Ollama / custom endpoints

    # Model generation parameters
    temperature = Column(Float,   nullable=True, default=0.7)    # 0 = deterministic, 1 = creative
    max_tokens  = Column(Integer, nullable=True, default=2048)   # max response length
    top_p       = Column(Float,   nullable=True, default=1.0)

    # Any extra provider-specific params stored as JSON
    # e.g. {"frequency_penalty": 0.5, "presence_penalty": 0.1}
    extra_params = Column(JSON, nullable=True, default=dict)

    is_active  = Column(Boolean, default=True)   # soft disable without deleting
    is_default = Column(Boolean, default=False)  # only one config should be default

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<LLMConfig id={self.id} provider={self.provider} model={self.model}>"