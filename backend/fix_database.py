#!/usr/bin/env python
"""
Database fix script to:
1. Ensure all tables exist with latest schema
2. Clear old demo data and reseed with skills
3. Verify the database state
"""

import sys
import os
import logging

# Suppress SQLAlchemy logging
logging.getLogger('sqlalchemy').setLevel(logging.WARNING)

# Add the backend to path (but assume we're already here)
if '.' not in sys.path:
    sys.path.insert(0, '.')

from sqlalchemy import inspect
from app.core.database import SessionLocal, engine, Base
from app.models.agent import Agent
from app.models.llm_config import LLMConfig
from app.models.tool import Tool
from app.models.skill import Skill
from app.models.task import Task

def check_database():
    """Check current database schema"""
    inspector = inspect(engine)
    
    print("\n[Database Check]")
    
    # Check if tables exist
    tables = inspector.get_table_names()
    print(f"++ Tables in database: {', '.join(tables)}")
    
    # Check agents table columns
    if 'agents' in tables:
        cols = [c['name'] for c in inspector.get_columns('agents')]
        print(f"\n++ Agents columns: {', '.join(cols)}")
        has_skill_ids = 'skill_ids' in cols
        print(f"  - skill_ids column: {'[OK] EXISTS' if has_skill_ids else '[NO] MISSING'}")

def reset_and_seed():
    """Reset all data and reseed from scratch"""
    db = SessionLocal()
    
    try:
        print("\n[Resetting Database]")
        
        # Delete all agents (will cascade to tasks)
        count = db.query(Agent).delete()
        print(f"++ Deleted {count} agents (and related tasks)")
        
        # Delete all skills
        count = db.query(Skill).delete()
        print(f"++ Deleted {count} skills")
        
        # Delete all tools
        count = db.query(Tool).delete()
        print(f"++ Deleted {count} tools")
        
        # Delete all LLM configs
        count = db.query(LLMConfig).delete()
        print(f"++ Deleted {count} LLM configs")
        
        db.commit()
        print("\n[Reseeding Database]")
        
        # Now reseed
        from app.core.seed import seed_database
        seed_database(db)
        db.commit()
        
        # Verify
        agent_count = db.query(Agent).count()
        skill_count = db.query(Skill).count()
        tool_count = db.query(Tool).count()
        llm_count = db.query(LLMConfig).count()
        
        print(f"\n[Verification]")
        print(f"++ LLM configs: {llm_count}")
        print(f"++ Tools: {tool_count}")
        print(f"++ Skills: {skill_count}")
        print(f"++ Agents: {agent_count}")
        
        if skill_count > 0 and agent_count > 0:
            print("\n[SUCCESS] Database reset and reseeded successfully!")
            return True
        else:
            print("\n[FAILED] Database reset but missing data")
            return False
            
    except Exception as e:
        print(f"\n[FAILED] Error during reset/seed: {type(e).__name__}")
        print(f"  {str(e)}")
        db.rollback()
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("AI Workflow Database Fix Script")
    print("=" * 60)
    
    # Step 1: Ensure tables exist
    print("\n[Creating Tables]")
    Base.metadata.create_all(bind=engine)
    print("++ All tables created (or already existed)")
    
    # Step 2: Check database
    check_database()
    
    # Step 3: Reset and reseed
    if reset_and_seed():
        print("\n[Next Steps]")
        print("1. Run the backend: uvicorn app.main:app --reload")
        print("2. Go to http://localhost:5173 to see your agents")
        print("=" * 60)
    else:
        print("\n[FAILED] Database fix failed. Please check the errors above.")
        sys.exit(1)
