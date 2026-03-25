# PATH: backend/app/routers/llm.py
#
# PURPOSE:
#  Handles all HTTP requests for the LLM Settings screen.
#
# ENDPOINTS:
#   GET    /llm/              → list all saved LLM configs
#   POST   /llm/              → add a new LLM config
#   GET    /llm/{id}          → get one LLM config
#   PUT    /llm/{id}          → edit an LLM config
#   DELETE /llm/{id}          → delete an LLM config
#   POST   /llm/{id}/test     → test if the API key + model work

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.llm_config import LLMConfig
from app.schemas.llm_config import (
    LLMConfigCreate, LLMConfigUpdate,
    LLMConfigResponse, LLMTestResponse,
)
from app.services.llm_service import test_llm_connection

router = APIRouter(prefix="/llm", tags=["LLM Settings"])

@router.get("/", response_model=List[LLMConfigResponse])
def list_llm_configs(db: Session = Depends(get_db)):
    return db.query(LLMConfig).order_by(LLMConfig.created_at.desc()).all()

@router.post("/", response_model=LLMConfigResponse, status_code=status.HTTP_201_CREATED)
def create_llm_config(payload: LLMConfigCreate, db: Session = Depends(get_db)):
    # Only one config can be the default — unset all others first
    if payload.is_default:
        db.query(LLMConfig).update({LLMConfig.is_default: False})
    config = LLMConfig(**payload.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return config

@router.get("/{config_id}", response_model=LLMConfigResponse)
def get_llm_config(config_id: UUID, db: Session = Depends(get_db)):
    config = db.query(LLMConfig).filter(LLMConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="LLM config not found")
    return config


@router.put("/{config_id}", response_model=LLMConfigResponse)
def update_llm_config(config_id: UUID, payload: LLMConfigUpdate, db: Session = Depends(get_db)):
    config = db.query(LLMConfig).filter(LLMConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="LLM config not found")
    if payload.is_default:
        db.query(LLMConfig).update({LLMConfig.is_default: False})
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    db.commit()
    db.refresh(config)
    return config


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_llm_config(config_id: UUID, db: Session = Depends(get_db)):
    config = db.query(LLMConfig).filter(LLMConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="LLM config not found")
    db.delete(config)
    db.commit()

@router.post("/{config_id}/test", response_model=LLMTestResponse)
async def test_connection(config_id: UUID, db: Session = Depends(get_db)):
    """
    Sends a tiny test prompt to the LLM to verify the API key and endpoint work.
    Called when user clicks 'Test Connection' on the LLM Settings screen.
    """
    config = db.query(LLMConfig).filter(LLMConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="LLM config not found")
    return await test_llm_connection(config)