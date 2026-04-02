#!/usr/bin/env python
"""Add missing skill_ids column to agents table."""

import sys
sys.path.insert(0, '.')

from sqlalchemy import text
from app.core.database import SessionLocal, engine

print("Adding skill_ids column to agents table...")

db = SessionLocal()
try:
    # Check if column already exists
    result = db.execute(text("""
        SELECT COUNT(*) as cnt FROM information_schema.columns 
        WHERE table_name = 'agents' AND column_name = 'skill_ids'
    """))
    
    column_exists = result.scalar() > 0
    
    if column_exists:
        print("skill_ids column already exists!")
    else:
        print("Adding skill_ids column...")
        db.execute(text("""
            ALTER TABLE agents 
            ADD COLUMN skill_ids JSON DEFAULT '[]'
        """))
        db.commit()
        print("Successfully added skill_ids column!")
    
    # Now reseed
    print("\nReseeding database...")
    from sqlalchemy.orm import Session
    from app.models.agent import Agent
    from app.models.skill import Skill
    from app.models.tool import Tool
    from app.models.llm_config import LLMConfig
    
# Clear data (in proper order to respect foreign keys)
    print("\nClearing old data...")
    from app.models.task_run import TaskRun
    from app.models.task import Task
    
    db.query(TaskRun).delete()     # Delete task runs first
    db.query(Task).delete()        # Delete tasks (they reference agents)
    db.query(Agent).delete()       # Delete agents
    db.query(Skill).delete()
    db.query(Tool).delete()
    db.query(LLMConfig).delete()
    db.commit()
    print("Data cleared")
    
    # Reseed
    from app.core.seed import seed_database
    seed_database(db)
    db.commit()
    print("Reseeded database")
    
    # Verify
    agent_count = db.query(Agent).count()
    skill_count = db.query(Skill).count()
    tool_count = db.query(Tool).count()
    llm_count = db.query(LLMConfig).count()
    
    print("\n=== FINAL RESULTS ===")
    print(f"LLM Configs: {llm_count}")
    print(f"Tools: {tool_count}")
    print(f"Skills: {skill_count}")
    print(f"Agents: {agent_count}")
    
    if skill_count > 0 and agent_count > 0 and llm_count > 0:
        print("\n[SUCCESS] Database is ready!")
        print("  Agents, skills, tools, and LLM configs have been created.")
        print("\nNext steps:")
        print("  1. Start the backend: uvicorn app.main:app --reload")
        print("  2. Start the frontend: npm run dev")
        print("  3. You should see your saved agents in the UI!")
    else:
        print("\nWARNING: Some data is missing.")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    db.rollback()
finally:
    db.close()
