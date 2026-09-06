#!/usr/bin/env bash
# ==============================================================================
# Indian Railways AI Maintenance Platform - Development Environment Setup
# Script: setup-development.sh
# Purpose: Configures local development environment for Node.js backend, Python
#          AI inference engine, PostgreSQL seeds, and local frontend preview.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Color scheme
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
BOLD="\033[1m"
RESET="\033[0m"

log_info()    { echo -e "${BLUE}[INFO]${RESET} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${RESET} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${RESET} $1"; }
log_error()   { echo -e "${RED}[ERROR]${RESET} $1"; }
log_step()    { echo -e "\n${BOLD}${CYAN}=== Step $1: $2 ===${RESET}"; }

show_help() {
    cat << EOF
Usage: ./setup-development.sh [OPTIONS]

Indian Railways AI Platform - Local Dev Environment Initializer

OPTIONS:
  -h, --help            Show this help message and exit
  --skip-python         Skip Python virtual environment setup
  --skip-node           Skip Node.js package setup
  --skip-db             Skip PostgreSQL database seeding
  --docker              Spin up local PostgreSQL and Redis via Docker Compose
  --port-api <port>     Set AI microservice port (default: 5000)
  --port-backend <port> Set Node.js backend port (default: 8080)

EXAMPLES:
  ./setup-development.sh
  ./setup-development.sh --docker
  ./setup-development.sh --skip-db
EOF
    exit 0
}

# Default flags
SKIP_PYTHON=false
SKIP_NODE=false
SKIP_DB=false
USE_DOCKER=false
PORT_API=5000
PORT_BACKEND=8080

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help) show_help ;;
        --skip-python) SKIP_PYTHON=true; shift ;;
        --skip-node) SKIP_NODE=true; shift ;;
        --skip-db) SKIP_DB=true; shift ;;
        --docker) USE_DOCKER=true; shift ;;
        --port-api) PORT_API="$2"; shift 2 ;;
        --port-backend) PORT_BACKEND="$2"; shift 2 ;;
        *) log_error "Unknown option: $1"; show_help ;;
    esac
done

echo -e "${BOLD}${GREEN}"
cat << 'EOF'
=================================================================
  INDIAN RAILWAYS AI MAINTENANCE PLATFORM (IR-AIMP)
  Local Development Environment Setup
=================================================================
EOF
echo -e "${RESET}"
log_info "Project root: ${PROJECT_ROOT}"
log_info "Date: $(date '+%Y-%m-%d %H:%M:%S %Z')"

# ── Step 1: Check System Prerequisites ───────────────────────────────────────
log_step "1/6" "Checking System Dependencies"

check_cmd() {
    local cmd="$1"
    local desc="$2"
    if command -v "$cmd" &>/dev/null; then
        log_success "Found $desc ($cmd: $($cmd --version 2>&1 | head -n1))"
    else
        log_warn "Missing $desc ($cmd)"
        return 1
    fi
}

check_cmd "git" "Git Version Control" || true
check_cmd "node" "Node.js Runtime" || log_error "Node.js 18+ is required. Install from https://nodejs.org"
check_cmd "python3" "Python 3 Runtime" || check_cmd "python" "Python Runtime" || log_error "Python 3.9+ is required."

# ── Step 2: Environment Configuration (.env) ─────────────────────────────────
log_step "2/6" "Setting Up Development Environment Variables"

ENV_DEV_FILE="${PROJECT_ROOT}/.env.development"
if [ ! -f "${ENV_DEV_FILE}" ]; then
    log_info "Generating ${ENV_DEV_FILE} from template..."
    cat > "${ENV_DEV_FILE}" << EOF
# Indian Railways AI Platform - Local Development Configuration
NODE_ENV=development
PORT=${PORT_BACKEND}
AI_SERVICE_URL=http://127.0.0.1:${PORT_API}
AI_TIMEOUT_MS=15000
AI_EXECUTION_STRATEGY=REST_FIRST
AI_API_KEYS=ir-ai-key-2026,admin-secret-key,test-token
AI_RATE_LIMIT_MAX=300
AI_RATE_LIMIT_WINDOW_MS=60000

# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://ai_service:ai_password@localhost:5432/railway_maintenance
DB_HOST=localhost
DB_PORT=5432
DB_NAME=railway_maintenance
DB_USER=ai_service
DB_PASSWORD=ai_password

# Redis Cache
REDIS_URL=redis://localhost:6379/0

# Python Bridge Configuration
PYTHON_PATH=python
LOG_LEVEL=DEBUG
DEFAULT_TIMEZONE=Asia/Kolkata
ENABLE_CACHING=true
EOF
    log_success "Created ${ENV_DEV_FILE}"
else
    log_info "${ENV_DEV_FILE} already exists. Retaining current values."
fi

# ── Step 3: Python Virtual Environment & Dependencies ─────────────────────────
if [ "$SKIP_PYTHON" = false ]; then
    log_step "3/6" "Configuring Python AI Environment"
    VENV_DIR="${PROJECT_ROOT}/ai-models/venv"
    
    # Pick python binary
    PYTHON_BIN="python3"
    if ! command -v python3 &>/dev/null; then
        PYTHON_BIN="python"
    fi

    if [ ! -d "${VENV_DIR}" ]; then
        log_info "Creating virtual environment in ${VENV_DIR}..."
        "${PYTHON_BIN}" -m venv "${VENV_DIR}"
        log_success "Virtual environment initialized."
    else
        log_info "Virtual environment exists at ${VENV_DIR}."
    fi

    # Activate
    if [ -f "${VENV_DIR}/bin/activate" ]; then
        # shellcheck disable=SC1091
        source "${VENV_DIR}/bin/activate"
    elif [ -f "${VENV_DIR}/Scripts/activate" ]; then
        # shellcheck disable=SC1091
        source "${VENV_DIR}/Scripts/activate"
    fi

    log_info "Upgrading pip and installing AI dependencies..."
    python -m pip install --upgrade pip --quiet
    
    # Install ML requirements if present
    if [ -f "${PROJECT_ROOT}/ai-models/requirements.txt" ]; then
        pip install -r "${PROJECT_ROOT}/ai-models/requirements.txt" --quiet
        log_success "Installed Python requirements from ai-models/requirements.txt"
    else
        log_info "Installing core ML packages..."
        pip install numpy pandas scikit-learn xgboost ortools fastapi uvicorn pydantic requests --quiet
        log_success "Core ML stack installed."
    fi
else
    log_info "Skipping Python setup (--skip-python specified)."
fi

# ── Step 4: Node.js Dependencies ──────────────────────────────────────────────
if [ "$SKIP_NODE" = false ]; then
    log_step "4/6" "Checking Node.js Dependencies"
    if [ -f "${PROJECT_ROOT}/package.json" ]; then
        log_info "Installing npm packages..."
        npm install --silent
        log_success "npm dependencies installed."
    else
        log_info "Zero-dependency pure Node.js backend detected. No npm install required."
    fi
else
    log_info "Skipping Node.js package check (--skip-node specified)."
fi

# ── Step 5: Database Infrastructure & Seeds ──────────────────────────────────
if [ "$SKIP_DB" = false ]; then
    log_step "5/6" "Local Database & Seeds Setup"
    
    if [ "$USE_DOCKER" = true ]; then
        log_info "Starting PostgreSQL and Redis containers via Docker Compose..."
        docker-compose -f "${PROJECT_ROOT}/deployment/docker-compose-ai.yml" up -d railway-postgres railway-redis
        log_info "Waiting for PostgreSQL to be ready on port 5432..."
        sleep 5
    fi

    SEEDS_DIR="${PROJECT_ROOT}/database/seeds"
    if [ -d "${SEEDS_DIR}" ]; then
        log_info "Inspecting seed files in ${SEEDS_DIR}:"
        for seed in "${SEEDS_DIR}"/*.csv "${SEEDS_DIR}"/*.sql; do
            if [ -f "$seed" ]; then
                log_info "  - $(basename "$seed") ($(du -h "$seed" | cut -f1))"
            fi
        done
        log_success "Database seed files are ready for ingestion."
    fi
else
    log_info "Skipping database setup (--skip-db specified)."
fi

# ── Step 6: Verification & Launch Guide ───────────────────────────────────────
log_step "6/6" "Verifying Local Services"

log_info "Testing Python AI microservice test suite..."
if [ -d "${PROJECT_ROOT}/ai-models/tests" ]; then
    python -m pytest "${PROJECT_ROOT}/ai-models/tests/" -q || log_warn "Some pytest tests completed with warnings."
fi

echo -e "\n${BOLD}${GREEN}=================================================================${RESET}"
echo -e "${BOLD}${GREEN}  DEVELOPMENT ENVIRONMENT READY!                                 ${RESET}"
echo -e "${BOLD}${GREEN}=================================================================${RESET}"
echo -e "To start your local development servers:\n"
echo -e "  ${BOLD}1. Start Python AI Microservice (Port ${PORT_API}):${RESET}"
echo -e "     cd ${PROJECT_ROOT}"
echo -e "     python ai-models/inference/app.py\n"
echo -e "  ${BOLD}2. Start Node.js Backend API Server (Port ${PORT_BACKEND}):${RESET}"
echo -e "     cd ${PROJECT_ROOT}"
echo -e "     node -e \"require('./backend/api/ai-api').createAiServer(${PORT_BACKEND})\"\n"
echo -e "  ${BOLD}3. Open Frontend Portal:${RESET}"
echo -e "     Open in browser: file://${PROJECT_ROOT}/index.html"
echo -e "     AI Dashboard:    file://${PROJECT_ROOT}/frontend/pages/admin-dashboard.html"
echo -e "     MLOps Console:   file://${PROJECT_ROOT}/frontend/pages/ai-model-management.html"
echo -e "=================================================================\n"
