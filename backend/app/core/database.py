from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL, 
    pool_pre_ping = True,
    pool_size = 10,
    max_overflow = 20,
    echo = True
)

SessionLocal = sessionmaker(autocommit=False, autoflash=False, bind=engine)

Base = declarative_base()

def get_db():
    """
    FastAPI dependency — opens a DB session for each request,
    yields it, then closes it when the request is done.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()