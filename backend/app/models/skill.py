# PATH: backend/app/models/skill.py
#
# PURPOSE:
#   Defines the `skills` table.
#   One row = one reusable skill/behavior that agents can adopt.
#   Skills are selected at agent creation and modify the agent's system prompt.

import uuid
from sqlalchemy import Column, String, Text, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base


class Skill(Base):
    __tablename__ = "skills"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)  # shown to user when selecting skills
    category    = Column(String(100), nullable=True)  # e.g. "reasoning", "analysis", "code"
    
    # The system prompt instruction to inject when this skill is selected
    # e.g. "Always reason step-by-step before concluding..."
    system_instruction = Column(Text, nullable=False)
    
    is_enabled  = Column(Boolean, default=True)  # toggle on/off without deleting
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Skill id={self.id} name={self.name}>"
