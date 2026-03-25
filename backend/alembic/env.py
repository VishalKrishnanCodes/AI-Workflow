# PATH: backend/alembic/env.py
#
# PURPOSE:
#   Alembic uses this file to connect to the database and detect
#   model changes when generating migrations.
#
# HOW TO USE ALEMBIC:
#   # Generate a new migration after changing a model:
#   alembic revision --autogenerate -m "describe your change"
#
#   # Apply all pending migrations to the database:
#   alembic upgrade head
#
#   # Roll back the last migration:
#   alembic downgrade -1

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os
import sys

# Add backend/ to the Python path so we can import app.*
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.database import Base

# Import all models so Alembic can detect them for autogenerate
import app.models  # noqa: F401

config = context.config

# Override the sqlalchemy.url with the value from our settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()