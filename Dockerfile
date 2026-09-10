# ─────────────────────────────────────────────────────────────────────────────
# DEDICATED ALWAYS-ON CLOUD SERVER DOCKERFILE
# Indian Railways AI Command & Persistent Storage Platform (RAKSHA PATH)
# Target: Railway.app, Render, AWS EC2, DigitalOcean, Docker VPS
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# Prevent interactive prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies, curl, and Node.js 20 LTS
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    build-essential \
    libpq-dev \
    sqlite3 \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python ML, optimization & API requirements
COPY ai-models/requirements.txt ./ai-models-requirements.txt
RUN pip install --no-cache-dir -r ./ai-models-requirements.txt \
    && pip install --no-cache-dir python-multipart

# Copy complete project source code
COPY . .

# Create persistent storage directories
RUN mkdir -p /app/data/backups /app/data/storage

# Declare persistent volume mount for server disk backups & SQLite
VOLUME ["/app/data"]

# Default exposed port for Node.js API Gateway (PaaS maps $PORT dynamically)
EXPOSE 5000

# Health check against server telemetry
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/v1/server/telemetry || exit 1

# Start the unified supervisor
CMD ["node", "start-server.js"]
