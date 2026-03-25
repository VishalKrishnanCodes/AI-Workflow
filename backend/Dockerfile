# PATH: backend/Dockerfile
#
# PURPOSE:
#   Builds the Docker image for the FastAPI backend server.
#   This same image is also used to run Celery workers —
#   the command is overridden in docker-compose.yml.
#
# STAGES:
#   Single stage for simplicity. In production, use multi-stage
#   builds to keep the final image smaller.

FROM python:3.11-slim

# Set working directory inside the container
WORKDIR /app

# Install system dependencies needed by psycopg2 and docker SDK
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (Docker cache layer)
# This layer is only rebuilt when requirements.txt changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port FastAPI will listen on
EXPOSE 8000

# Default command — starts the FastAPI server
# Overridden in docker-compose.yml for the Celery worker service
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]