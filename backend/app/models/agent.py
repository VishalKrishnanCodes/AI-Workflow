import uuid
import enum
from sqlalchemy import Column, String, Boolean, Text, JSON, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class AgentStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    draft = "draft"

class Agent(Base):
    __tablename__ = "agents"
 
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(AgentStatus), default=AgentStatus.draft, nullable=False)
 
    # LangGraph workflow stored as JSON
    workflow_config = Column(JSON, nullable=True, default={})
 
    # Which LLM config this agent uses
    llm_config_id = Column(UUID(as_uuid=True), nullable=True)
 
    # Tool IDs this agent can use
    tool_ids = Column(JSON, nullable=True, default=[])
 
    # Instructions given to the LLM
    system_prompt = Column(Text, nullable=True)
 
    max_iterations = Column(String(10), nullable=True, default="10")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
 
    tasks = relationship("Task", back_populates="agent", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Agent id={self.id} name={self.name} status={self.status}>"