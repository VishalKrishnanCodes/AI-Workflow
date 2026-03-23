# PATH: backend/app/schemas/tool.py
#
# PURPOSE:
#   API contract for the /tools endpoints.
 
from pydantic import BaseModel
from typing import Optional, Any, Dict
from uuid import UUID
from datetime import datetime
from app.models.tool import ToolType
 
 
class ToolCreate(BaseModel):
    name:          str
    description:   Optional[str]           = None
    tool_type:     ToolType                = ToolType.custom
    endpoint_url:  Optional[str]           = None
    http_method:   Optional[str]           = "POST"
    headers:       Optional[Dict[str, str]]= {}
    auth_config:   Optional[Dict[str, Any]]= {}
    input_schema:  Optional[Dict[str, Any]]= {}
    output_schema: Optional[Dict[str, Any]]= {}
    source_code:   Optional[str]           = None
    config:        Optional[Dict[str, Any]]= {}
    is_enabled:    Optional[bool]          = True
 
 
class ToolUpdate(BaseModel):
    name:          Optional[str]            = None
    description:   Optional[str]            = None
    endpoint_url:  Optional[str]            = None
    http_method:   Optional[str]            = None
    headers:       Optional[Dict[str, str]] = None
    auth_config:   Optional[Dict[str, Any]] = None
    input_schema:  Optional[Dict[str, Any]] = None
    output_schema: Optional[Dict[str, Any]] = None
    source_code:   Optional[str]            = None
    config:        Optional[Dict[str, Any]] = None
    is_enabled:    Optional[bool]           = None
 
 
class ToolResponse(BaseModel):
    id:            UUID
    name:          str
    description:   Optional[str]            = None
    tool_type:     ToolType
    endpoint_url:  Optional[str]            = None
    http_method:   Optional[str]            = None
    headers:       Optional[Dict[str, str]] = {}
    auth_config:   Optional[Dict[str, Any]] = {}
    input_schema:  Optional[Dict[str, Any]] = {}
    output_schema: Optional[Dict[str, Any]] = {}
    source_code:   Optional[str]            = None
    config:        Optional[Dict[str, Any]] = {}
    is_enabled:    bool
    created_at:    datetime
    updated_at:    Optional[datetime] = None
 
    class Config:
        from_attributes = True