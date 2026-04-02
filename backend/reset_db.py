#!/usr/bin/env python
"""Quick script to reset and reseed the database."""

import sys
sys.path.insert(0, '.')

from sqlalchemy import inspect
from app.core.database import SessionLocal, engine, Base
from app.models.agent import Agent
from app.models.skill import Skill
from app.models.tool import Tool
from app.models.llm_config import LLMConfig

#Step 1: Ensure tables exist
print("Creating tables...")
Base.metadata.create_all(bind=engine)
print("Done!")

# Step 2: Check database
print("\nChecking database...")
db = SessionLocal()
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f"Tables: {tables}")

# Step 3: Reset all data
print("\nDeleting existing data...")
db.query(Agent).delete()
db.query(Skill).delete() 
db.query(Tool).delete()
db.query(LLMConfig).delete()
db.commit()
print("Data deleted!")

# Step 4: Reseed
print("\nReseeding database...")
from app.core.seed import seed_database
seed_database(db)
db.commit()

# Step 5: Verify
agent_count = db.query(Agent).count()
skill_count = db.query(Skill).count()
tool_count = db.query(Tool).count()
llm_count = db.query(LLMConfig).count()

print("\n=== RESULTS ===")
print(f"LLM Configs: {llm_count}")
print(f"Tools: {tool_count}")
print(f"Skills: {skill_count}")
print(f"Agents: {agent_count}")

if skill_count > 0 and agent_count > 0:
    print("\nSUCCESS! Database is ready.")
    print("Your agents and skills have been seeded.")
else:
    print("\nFAILED! Some data is missing.")

db.close()
