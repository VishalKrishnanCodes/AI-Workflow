# PATH: backend/app/routers/tools.py
#
# PURPOSE:
#   Handles all HTTP requests for the Tools Management screen.
#
# ENDPOINTS:
#   GET    /tools/              → list all tools
#   POST   /tools/              → create a new tool
#   GET    /tools/{id}          → get one tool
#   PUT    /tools/{id}          → edit a tool
#   DELETE /tools/{id}          → delete a tool
#   PATCH  /tools/{id}/toggle   → enable or disable a tool

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.tool import Tool
from app.schemas.tool import ToolCreate, ToolUpdate, ToolResponse

router = APIRouter(prefix="/tools", tags=["Tools"])

@router.get("/", response_model=List[ToolResponse])
def list_tools(db: Session = Depends(get_db)):
    return db.query(Tool).order_by(Tool.created_at.desc()).all()

@router.post("/", response_model=ToolResponse, status_code=status.HTTP_201_CREATED)
def create_tool(payload: ToolCreate, db: Session = Depends(get_db)):
    # Tool names must be unique — the LLM uses the name to identify tools
    existing = db.query(Tool).filter(Tool.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Tool name '{payload.name}' already exists")
    tool = Tool(**payload.model_dump())
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return tool

@router.get("/{tool_id}", response_model=ToolResponse)
def get_tool(tool_id: UUID, db: Session = Depends(get_db)):
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool

@router.put("/{tool_id}", response_model=ToolResponse)
def update_tool(tool_id: UUID, payload: ToolUpdate, db: Session = Depends(get_db)):
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tool, field, value)
    db.commit()
    db.refresh(tool)
    return tool

@router.delete("/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tool(tool_id: UUID, db: Session = Depends(get_db)):
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    db.delete(tool)
    db.commit()

@router.patch("/{tool_id}/toggle", response_model=ToolResponse)
def toggle_tool(tool_id: UUID, db: Session = Depends(get_db)):
    """Enable or disable a tool without deleting it."""
    tool = db.query(Tool).filter(Tool.id == tool_id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    tool.is_enabled = not tool.is_enabled
    db.commit()
    db.refresh(tool)
    return tool