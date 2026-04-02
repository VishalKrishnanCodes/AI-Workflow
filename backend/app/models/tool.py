# PATH: backend/app/models/tool.py
#
# PURPOSE:
#   Defines the `tools` table.
#   One row = one tool an agent can call during its workflow.
#   Supports 4 types of tools:
#     builtin   → pre-packaged tools (web search, Wikipedia, Python REPL)
#     custom    → user writes Python code that returns a LangChain tool
#     api       → call any HTTP endpoint as a tool
#     langchain → reference a LangChain community tool by name

import uuid
import enum
from sqlalchemy import Column, String, Text, JSON, DateTime, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.core.database import Base

class ToolType(str, enum.Enum):
    builtin   = "builtin"
    custom    = "custom"
    api       = "api"
    langchain = "langchain"
    
class Tool(Base):
    __tablename__ = "tools"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name        = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)  # shown to the LLM so it knows when to use this tool
    tool_type   = Column(Enum(ToolType), nullable=False, default=ToolType.custom)

    # ── For api-type tools ─────────────────────────────────────────────────────
    endpoint_url = Column(Text,        nullable=True)
    http_method  = Column(String(10),  nullable=True, default="POST")
    headers      = Column(JSON,        nullable=True, default=dict)  # e.g. {"Authorization": "Bearer ..."}
    auth_config  = Column(JSON,        nullable=True, default=dict)  # optional auth details

    # ── Schema ─────────────────────────────────────────────────────────────────
    # JSON Schema describing what inputs the tool accepts
    # The LLM uses this to know how to call the tool correctly
    input_schema  = Column(JSON, nullable=True, default=dict)
    output_schema = Column(JSON, nullable=True, default=dict)

    # ── For custom-type tools ──────────────────────────────────────────────────
    # User writes a Python function here. Must define a get_tool() function
    # that returns a LangChain BaseTool object.
    source_code = Column(Text, nullable=True)

    # Any extra config specific to this tool
    config = Column(JSON, nullable=True, default=dict)

    is_enabled = Column(Boolean, default=True)  # toggle on/off without deleting

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Tool id={self.id} name={self.name} type={self.tool_type}>"