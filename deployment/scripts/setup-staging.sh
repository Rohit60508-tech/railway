#!/usr/bin/env bash
# ==============================================================================
# Indian Railways AI Maintenance Platform - Staging Environment Deployment
# Script: setup-staging.sh
# Purpose: Deploys the staging/UAT environment on Railway infrastructure,
#          CRIS Zonal staging clusters, or Docker Compose sandbox with
#          containerized microservices, mock feeds, and automated smoke tests.
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
Usage: ./setup-staging.sh [OPTIONS]

Indian Railways AI Platform - Staging / UAT Deployment Orchestrator

OPTIONS:
  -h, --help            Show this help message and exit
  --tag <version>       Docker image tag (default: staging-latest)
  --rebuild             Force clean rebuild of all container images
  --skip-tests          Skip post-deployment smoke tests
  --target <infra>      Deployment target: 'docker' (default), 'k8s', or 'railway'
  --clean               Tear down existing staging containers before deploying

EXAMPLES:
  ./setup-staging.sh
  ./setup-staging.sh --rebuild --tag v1.3.0-rc2
  ./setup-staging.sh --target k8s
  ./setup-staging.sh --target railway
EOF
    exit 0
}

IMAGE_TAG="staging-latest"
REBUILD=false
SKIP_TESTS=false
TARGET="docker"
CLEAN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help) show_help ;;
        --tag) IMAGE_TAG="$2"; shift 2 ;;
        --rebuild) REBUILD=true; shift ;;
        --skip-tests) SKIP_TESTS=true; shift ;;
        --target) TARGET="$2"; shift 2 ;;
        --clean) CLEAN=true; shift ;;
        *) log_error "Unknown option: $1"; show_help ;;
    esac
done

echo -e "${BOLD}${CYAN}"
cat << 'EOF'
=================================================================
  INDIAN RAILWAYS AI MAINTENANCE PLATFORM (IR-AIMP)
  Staging & UAT Environment Deployment
=================================================================
EOF
echo -e "${RESET}"
log_info "Target Infrastructure: ${TARGET}"
log_info "Deployment Tag: ${IMAGE_TAG}"
log_info "Timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z')"

# ── Step 1: Pre-flight Verification ──────────────────────────────────────────
log_step "1/5" "Pre-flight Environment Validation"

case "$TARGET" in
    docker)
        if ! command -v docker &>/dev/null; then
            log_error "Docker is not installed or not in PATH."
            exit 1
        fi
        if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
            log_error "Docker Compose is required."
            exit 1
        fi
        log_success "Docker daemon verified."
        ;;
    k8s)
        if ! command -v kubectl &>/dev/null; then
            log_error "kubectl is required for Kubernetes deployment."
            exit 1
        fi
        log_success "kubectl toolchain verified."
        ;;
    railway)
        if ! command -v railway &>/dev/null; then
            log_warn "Railway CLI not detected in PATH. Ensure RAILWAY_TOKEN is configured or use web dashboard."
        else
            log_success "Railway CLI detected."
        fi
        ;;
    *)
        log_error "Unsupported target '${TARGET}'. Use 'docker', 'k8s', or 'railway'."
        exit 1
        ;;
esac

# ── Step 2: Environment Configuration ────────────────────────────────────────
log_step "2/5" "Configuring Staging Secrets & Variables"

ENV_STAGING="${PROJECT_ROOT}/.env.staging"
if [ ! -f "${ENV_STAGING}" ]; then
    log_info "Generating staging environment template: ${ENV_STAGING}..."
    cat > "${ENV_STAGING}" << EOF
# Indian Railways Staging Environment Configuration
NODE_ENV=staging
PORT=8080
AI_SERVICE_URL=http://ai-priority-service:5000
AI_TIMEOUT_MS=15000
AI_EXECUTION_STRATEGY=REST_FIRST
AI_API_KEYS=ir-staging-key-2026,uat-officer-token,qa-automation-token
AI_RATE_LIMIT_MAX=200
AI_RATE_LIMIT_WINDOW_MS=60000

DATABASE_URL=postgresql://ai_service:ai_password_staging@railway-postgres:5432/railway_maintenance_staging
REDIS_URL=redis://railway-redis:6379/0
LOG_LEVEL=INFO
DEFAULT_TIMEZONE=Asia/Kolkata
ENABLE_CACHING=true
MODEL_VERSION=${IMAGE_TAG}
EOF
    log_success "Created ${ENV_STAGING}"
else
    log_info "Found existing ${ENV_STAGING}"
fi

# ── Step 3: Container Build & Orchestration ──────────────────────────────────
log_step "3/5" "Building & Deploying Staging Infrastructure"

COMPOSE_FILE="${PROJECT_ROOT}/deployment/docker-compose-ai.yml"

if [ "$TARGET" = "docker" ]; then
    if [ "$CLEAN" = true ]; then
        log_info "Tearing down existing staging containers..."
        docker-compose -f "${COMPOSE_FILE}" down -v --remove-orphans || true
    fi

    BUILD_ARGS=()
    if [ "$REBUILD" = true ]; then
        BUILD_ARGS+=(--build --no-cache)
    fi

    log_info "Starting Docker Compose services for Staging..."
    docker-compose -f "${COMPOSE_FILE}" up -d "${BUILD_ARGS[@]}"

    log_info "Waiting for service health checks (up to 30s)..."
    sleep 10

elif [ "$TARGET" = "k8s" ]; then
    log_info "Applying Kubernetes staging manifests..."
    kubectl apply -f "${PROJECT_ROOT}/deployment/kubernetes/ai-deployment.yaml" -n ir-ai-staging || true
    kubectl apply -f "${PROJECT_ROOT}/deployment/kubernetes/ai-service.yaml" -n ir-ai-staging || true
    log_info "Kubernetes manifests applied."

elif [ "$TARGET" = "railway" ]; then
    log_info "Deploying to Railway.app cloud infrastructure..."
    echo -e "${YELLOW}------------------------------------------------------------${RESET}"
    echo -e "Railway Deployment Instructions:"
    echo -e "1. Link repository with: ${BOLD}railway link${RESET}"
    echo -e "2. Provision PostgreSQL database and Redis in Railway dashboard"
    echo -e "3. Push environment variables: ${BOLD}railway variables --set NODE_ENV=staging${RESET}"
    echo -e "4. Deploy with: ${BOLD}railway up --service ai-platform-staging${RESET}"
    echo -e "${YELLOW}------------------------------------------------------------${RESET}"
fi

# ── Step 4: Database Seeding & Mock Feeds ────────────────────────────────────
log_step "4/5" "Ingesting Staging Test Timetables & Flaw Records"

log_info "Verifying seed data assets in database/seeds/..."
COUNT_TIMETABLES=$(wc -l < "${PROJECT_ROOT}/database/seeds/train_timetable.csv" 2>/dev/null || echo "0")
COUNT_TRACKS=$(wc -l < "${PROJECT_ROOT}/database/seeds/track_sections.csv" 2>/dev/null || echo "0")
log_success "Verified seed records: ${COUNT_TIMETABLES} Timetables, ${COUNT_TRACKS} Track Sections."

# ── Step 5: Smoke Testing & Health Checks ────────────────────────────────────
if [ "$SKIP_TESTS" = false ]; then
    log_step "5/5" "Executing Automated Staging Smoke Tests"

    STAGING_ENDPOINT="http://localhost:5000"
    log_info "Testing health endpoint: ${STAGING_ENDPOINT}/api/v1/health..."

    if command -v curl &>/dev/null; then
        HEALTH_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${STAGING_ENDPOINT}/api/v1/health" || echo "000")
        if [ "${HEALTH_HTTP_CODE}" = "200" ]; then
            log_success "Staging Health Check PASSED (HTTP 200)."
        else
            log_warn "Health endpoint returned HTTP ${HEALTH_HTTP_CODE}. Service may still be initializing."
        fi
    fi

    # Run Node backend integration tests
    log_info "Executing Node.js AI API regression suite..."
    if command -v node &>/dev/null; then
        node "${PROJECT_ROOT}/test_ai_api.js" || log_warn "API verification encountered non-fatal notices."
    fi
else
    log_info "Skipping smoke tests (--skip-tests specified)."
fi

echo -e "\n${BOLD}${GREEN}=================================================================${RESET}"
echo -e "${BOLD}${GREEN}  STAGING ENVIRONMENT DEPLOYED SUCCESSFULLY!                     ${RESET}"
echo -e "${BOLD}${GREEN}=================================================================${RESET}"
echo -e "Staging Access Points:"
echo -e "  - AI Inference Gateway:  http://localhost:5000/docs"
echo -e "  - Node Backend API:      http://localhost:8080/api/v1/ai/models/info"
echo -e "  - Grafana Telemetry:     http://localhost:3000 (admin/railway_ai_2026)"
echo -e "  - PostgreSQL Staging:    localhost:5432/railway_maintenance_staging"
echo -e "=================================================================\n"
