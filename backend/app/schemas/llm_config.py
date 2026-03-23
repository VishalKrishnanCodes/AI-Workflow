# PATH: backend/app/schemas/llm_config.py
#
# PURPOSE:
#   API contract for the /llm endpoints.
#
#   LLMConfigCreate  → body when adding a new LLM config
#   LLMConfigUpdate  → body when editing an existing LLM config
#   LLMConfigResponse → what the API returns
#   LLMTestResponse  → result of clicking "Test Connection" on the LLM Settings screen

from pydantic import BaseModel
from typing import Optional, Any, Dict
from uuid import UUID
from datetime import datetime

class LLMConfigCreate(BaseModel):
    name:         str
    provider:     str               # openai | anthropic | groq | ollama | custom
    model:        str               # exact model identifier
    api_key:      Optional[str]     = None
    api_base_url: Optional[str]     = None  # for Ollama / custom endpoints
    temperature:  Optional[float]   = 0.7
    max_tokens:   Optional[int]     = 2048
    top_p:        Optional[float]   = 1.0
    extra_params: Optional[Dict[str, Any]] = {}
    is_active:    Optional[bool]    = True
    is_default:   Optional[bool]    = False

class LLMConfigUpdate(BaseModel):
    name:         Optional[str]     = None
    provider:     Optional[str]     = None
    model:        Optional[str]     = None
    api_key:      Optional[str]     = None
    api_base_url: Optional[str]     = None
    temperature:  Optional[float]   = None
    max_tokens:   Optional[int]     = None
    top_p:        Optional[float]   = None
    extra_params: Optional[Dict[str, Any]] = None
    is_active:    Optional[bool]    = None
    is_default:   Optional[bool]    = None

class LLMConfigResponse(BaseModel):
    id:           UUID
    name:         str
    provider:     str
    model:        str
    api_key:      Optional[str]     = None
    api_base_url: Optional[str]     = None
    temperature:  Optional[float]   = None
    max_tokens:   Optional[int]     = None
    top_p:        Optional[float]   = None
    extra_params: Optional[Dict[str, Any]] = {}
    is_active:    bool
    is_default:   bool
    created_at:   datetime
    updated_at:   Optional[datetime] = None

    class Config:
        from_attributes = True


class LLMTestResponse(BaseModel):
    success:    bool
    message:    str
    latency_ms: Optional[int] = None