# PATH: backend/app/schemas/skill.py
#
# PURPOSE:
#   Pydantic schemas for Skill API endpoints.

from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class SkillCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    system_instruction: str
    is_enabled: Optional[bool] = True


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    system_instruction: Optional[str] = None
    is_enabled: Optional[bool] = None


class SkillResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    system_instruction: str
    is_enabled: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
