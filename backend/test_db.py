from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://neondb_owner:npg_3DyIgf7BlhTa@ep-mute-band-a1i3c8n0-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    result = conn.execute(text("SELECT 1"))
    print(result.scalar())