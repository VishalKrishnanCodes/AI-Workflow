# PATH: backend/app/routers/skill.py
#
# PURPOSE:
#   Handles all HTTP requests for Skills Management.
#
# ENDPOINTS:
#   GET    /skills/              → list all skills
#   POST   /skills/              → create a new skill
#   GET    /skills/{id}          → get a single skill
#   PUT    /skills/{id}          → update a skill
#   DELETE /skills/{id}          → delete a skill

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.skill import Skill
from app.schemas.skill import SkillCreate, SkillUpdate, SkillResponse

router = APIRouter(prefix="/skills", tags=["Skills"])


@router.get("/", response_model=List[SkillResponse])
def list_skills(db: Session = Depends(get_db)):
    """List all available skills."""
    return db.query(Skill).order_by(Skill.created_at.desc()).all()


@router.post("/", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
def create_skill(payload: SkillCreate, db: Session = Depends(get_db)):
    """Create a new skill."""
    existing = db.query(Skill).filter(Skill.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Skill '{payload.name}' already exists")
    skill = Skill(**payload.model_dump())
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


@router.get("/{skill_id}", response_model=SkillResponse)
def get_skill(skill_id: UUID, db: Session = Depends(get_db)):
    """Get a single skill by ID."""
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.put("/{skill_id}", response_model=SkillResponse)
def update_skill(skill_id: UUID, payload: SkillUpdate, db: Session = Depends(get_db)):
    """Update a skill."""
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(skill, field, value)
    db.commit()
    db.refresh(skill)
    return skill


@router.delete("/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_skill(skill_id: UUID, db: Session = Depends(get_db)):
    """Delete a skill."""
    skill = db.query(Skill).filter(Skill.id == skill_id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    db.delete(skill)
    db.commit()
