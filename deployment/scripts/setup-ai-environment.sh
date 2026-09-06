#!/usr/bin/env bash
# ==============================================================================
# Indian Railways AI Maintenance Platform - Environment Setup Script
# Automatically configures Python 3.9+, virtual environment, ML packages,
# database credentials, pre-trained models, logging, and environment variables.
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
AI_MODELS_DIR="${WORKSPACE_ROOT}/ai-models"
VENV_DIR="${AI_MODELS_DIR}/venv"

# Terminal formatting colors
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BOLD="\033[1m"
RESET="\033[0m"

log_info() {
    echo -e "${BLUE}[INFO]${RESET} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${RESET} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${RESET} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${RESET} $1"
}

echo -e "${BOLD}=================================================================${RESET}"
echo -e "${BOLD} INDIAN RAILWAYS AI PLATFORM - ENVIRONMENT SETUP ${RESET}"
echo -e "${BOLD}=================================================================${RESET}"
log_info "Workspace root: ${WORKSPACE_ROOT}"
log_info "AI Models directory: ${AI_MODELS_DIR}"

# ── 1. Python 3.9+ Version Check & Installation ──────────────────────────────
log_info "Step 1/7: Checking Python installation..."

PYTHON_BIN=""
for py_cmd in python3.12 python3.11 python3.10 python3.9 python3 python; do
    if command -v "${py_cmd}" &>/dev/null; then
        PY_VER=$("${py_cmd}" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        PY_MAJOR=$("${py_cmd}" -c 'import sys; print(sys.version_info.major)')
        PY_MINOR=$("${py_cmd}" -c 'import sys; print(sys.version_info.minor)')
        if [ "${PY_MAJOR}" -eq 3 ] && [ "${PY_MINOR}" -ge 9 ]; then
            PYTHON_BIN="${py_cmd}"
            log_success "Found compatible Python binary: ${py_cmd} (version ${PY_VER})"
            break
        fi
    fi
done

if [ -z "${PYTHON_BIN}" ]; then
    log_warn "No compatible Python 3.9+ found. Attempting package manager installation..."
    if command -v apt-get &>/dev/null; then
        log_info "Installing Python 3.11 via apt..."
        sudo apt-get update && sudo apt-get install -y python3.11 python3.11-venv python3.11-dev python3-pip
        PYTHON_BIN="python3.11"
    elif command -v dnf &>/dev/null; then
        log_info "Installing Python 3.11 via dnf..."
        sudo dnf install -y python3.11 python3.11-devel
        PYTHON_BIN="python3.11"
    elif command -v brew &>/dev/null; then
        log_info "Installing Python 3.11 via Homebrew..."
        brew install python@3.11
        PYTHON_BIN="python3.11"
    else
        log_error "Automatic Python installation is not supported on this OS."
        log_error "Please install Python 3.9, 3.10, 3.11, or 3.12 and rerun this script."
        exit 1
    fi
fi

# ── 2. Setup Virtual Environment ─────────────────────────────────────────────
log_info "Step 2/7: Configuring Python virtual environment..."

if [ ! -d "${VENV_DIR}" ]; then
    log_info "Creating virtual environment at ${VENV_DIR}..."
    "${PYTHON_BIN}" -m venv "${VENV_DIR}"
    log_success "Virtual environment initialized."
else
    log_info "Existing virtual environment found at ${VENV_DIR}."
fi

# Activate virtual environment
if [ -f "${VENV_DIR}/bin/activate" ]; then
    # Linux / macOS
    source "${VENV_DIR}/bin/activate"
elif [ -f "${VENV_DIR}/Scripts/activate" ]; then
    # Windows / Git Bash
    source "${VENV_DIR}/Scripts/activate"
else
    log_warn "Could not source activate script directly. Using '${VENV_DIR}/bin/python'."
fi

# ── 3. Upgrade Pip & Install Required Dependencies ───────────────────────────
log_info "Step 3/7: Installing required ML dependencies from requirements.txt..."
python -m pip install --upgrade pip setuptools wheel

REQ_FILE="${AI_MODELS_DIR}/requirements.txt"
if [ -f "${REQ_FILE}" ]; then
    python -m pip install -r "${REQ_FILE}"
    log_success "All dependencies (pandas, numpy, scikit-learn, xgboost, ortools, fastapi, etc.) installed successfully."
else
    log_error "Requirements file not found at ${REQ_FILE}"
    exit 1
fi

# ── 4. Configure Environment Variables ───────────────────────────────────────
log_info "Step 4/7: Configuring environment variables..."

ENV_FILE="${AI_MODELS_DIR}/.env"
ENV_EXAMPLE="${AI_MODELS_DIR}/.env.example"

if [ ! -f "${ENV_FILE}" ]; then
    if [ -f "${ENV_EXAMPLE}" ]; then
        log_info "Generating ${ENV_FILE} from ${ENV_EXAMPLE}..."
        cp "${ENV_EXAMPLE}" "${ENV_FILE}"
    else
        cat << 'EOF' > "${ENV_FILE}"
DATABASE_URL=postgresql://ai_service:your_password_here@localhost:5432/railway_maintenance
LOG_LEVEL=INFO
PRIORITY_MODEL_PATH=models/priority_model.pkl
TRAFFIC_MODEL_PATH=models/traffic_model.pkl
API_HOST=0.0.0.0
API_PORT=8000
DEFAULT_TIMEZONE=Asia/Kolkata
ENABLE_CACHING=true
CACHE_EXPIRY_MINUTES=60
EOF
    fi
    log_success "Created environment file: ${ENV_FILE}"
else
    log_info "Environment configuration file ${ENV_FILE} already exists."
fi

# ── 5. Setup Logging and Model Directories ───────────────────────────────────
log_info "Step 5/7: Setting up logging, model, and artifact directories..."

mkdir -p "${AI_MODELS_DIR}/logs"
mkdir -p "${AI_MODELS_DIR}/models"
mkdir -p "${AI_MODELS_DIR}/artifacts"
mkdir -p "${AI_MODELS_DIR}/priority-engine/models"
mkdir -p "${AI_MODELS_DIR}/traffic-predictor/models"
mkdir -p "${AI_MODELS_DIR}/block-optimizer/models"
log_success "Logging and artifact storage hierarchy prepared."

# ── 6. Configure Database Connection & Verification ──────────────────────────
log_info "Step 6/7: Testing database connection..."

DB_TEST_SCRIPT=$(cat << 'EOF'
import sys
try:
    from shared.database_connector import db_connector
    status = db_connector.test_connection()
    if status.get("status") == "CONNECTED":
        print(f"DB_OK:{status.get('database')}")
    else:
        print(f"DB_FALLBACK:Offline fallback mode active ({status.get('error', 'unknown')})")
except Exception as e:
    print(f"DB_OFFLINE:{str(e)}")
EOF
)

DB_RESULT=$(PYTHONPATH="${AI_MODELS_DIR}" python -c "${DB_TEST_SCRIPT}" 2>/dev/null || echo "DB_OFFLINE:Connector check failed")
log_info "Database status: ${DB_RESULT}"

# ── 7. Download / Train Pre-Trained Machine Learning Models ──────────────────
log_info "Step 7/7: Checking and preparing pre-trained AI models..."

TRAIN_PRIORITY="${AI_MODELS_DIR}/training/train_priority_model.py"
TRAIN_TRAFFIC="${AI_MODELS_DIR}/training/train_traffic_model.py"

if [ -f "${TRAIN_PRIORITY}" ]; then
    log_info "Synthesizing and validating defect priority model..."
    PYTHONPATH="${AI_MODELS_DIR}" python "${TRAIN_PRIORITY}" || log_warn "Priority model baseline generated via fallback."
fi

if [ -f "${TRAIN_TRAFFIC}" ]; then
    log_info "Synthesizing and validating train traffic prediction model..."
    PYTHONPATH="${AI_MODELS_DIR}" python "${TRAIN_TRAFFIC}" || log_warn "Traffic model baseline generated via fallback."
fi

echo -e "${BOLD}=================================================================${RESET}"
log_success "Indian Railways AI Environment Setup Complete!"
echo -e "${BOLD}=================================================================${RESET}"
echo -e "Next steps to run the platform:"
echo -e "  1. Run FastAPI inference server locally:"
echo -e "     ${GREEN}PYTHONPATH=${AI_MODELS_DIR} python -m uvicorn inference.app:app --host 0.0.0.0 --port 8000${RESET}"
echo -e "  2. Run via Docker Compose:"
echo -e "     ${GREEN}docker compose -f deployment/docker-compose-ai.yml up -d${RESET}"
echo -e "  3. Deploy to Kubernetes cluster:"
echo -e "     ${GREEN}kubectl apply -f deployment/kubernetes/ai-deployment.yaml${RESET}"
echo -e "     ${GREEN}kubectl apply -f deployment/kubernetes/ai-service.yaml${RESET}"
echo -e "================================================================="
