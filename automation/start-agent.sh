#!/bin/bash
# =============================================================================
# ForgeCadNeo Autonomous Marketing Agent — Startup Script
# =============================================================================
# Usage:
#   ./start-agent.sh              Start daemon in background
#   ./start-agent.sh --once       Single decision cycle
#   ./start-agent.sh --dry-run    Show decisions without executing
#   ./start-agent.sh --stop       Stop the running daemon
#   ./start-agent.sh --restart    Restart the daemon
#   ./start-agent.sh --status     Show agent status
#   ./start-agent.sh --logs       Tail the agent log
#   ./start-agent.sh --report     Generate daily report
#   ./start-agent.sh --fg         Run daemon in foreground (for debugging)

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_SCRIPT="${SCRIPT_DIR}/autonomous-agent.py"
PID_FILE="${SCRIPT_DIR}/agent.pid"
LOG_FILE="${SCRIPT_DIR}/agent.log"
ENV_FILE="${SCRIPT_DIR}/.env"
PYTHON="${PYTHON:-python3}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }

check_python() {
    if ! command -v "${PYTHON}" &>/dev/null; then
        err "Python3 not found. Install Python 3.10+ or set PYTHON env var."
        exit 1
    fi

    local version
    version=$("${PYTHON}" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    local major minor
    major=$(echo "${version}" | cut -d. -f1)
    minor=$(echo "${version}" | cut -d. -f2)

    if [[ "${major}" -lt 3 ]] || { [[ "${major}" -eq 3 ]] && [[ "${minor}" -lt 10 ]]; }; then
        err "Python 3.10+ required. Found: ${version}"
        exit 1
    fi
}

check_dependencies() {
    "${PYTHON}" -c "import anthropic" 2>/dev/null || {
        err "Missing dependency: anthropic. Run: pip install -r ${SCRIPT_DIR}/requirements.txt"
        exit 1
    }
    "${PYTHON}" -c "import praw" 2>/dev/null || {
        warn "Missing dependency: praw. Reddit features will be disabled."
        warn "Install with: pip install -r ${SCRIPT_DIR}/requirements.txt"
    }
    "${PYTHON}" -c "import dotenv" 2>/dev/null || {
        warn "Missing dependency: python-dotenv. .env file will not be loaded."
        warn "Install with: pip install python-dotenv"
    }
}

load_env() {
    if [[ -f "${ENV_FILE}" ]]; then
        info "Loading environment from ${ENV_FILE}"
        set -a
        # shellcheck source=/dev/null
        source "${ENV_FILE}"
        set +a
    fi
}

check_credentials() {
    local missing=0

    if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
        err "ANTHROPIC_API_KEY not set. This is required."
        missing=1
    fi

    if [[ -z "${REDDIT_CLIENT_ID:-}" ]]; then
        warn "REDDIT_CLIENT_ID not set. Reddit features will be disabled."
    fi

    if [[ "${missing}" -eq 1 ]]; then
        err "Set required credentials in ${ENV_FILE} or as environment variables."
        err "See .env.example for the template."
        exit 1
    fi
}

get_pid() {
    if [[ -f "${PID_FILE}" ]]; then
        cat "${PID_FILE}"
    else
        echo ""
    fi
}

is_running() {
    local pid
    pid=$(get_pid)
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
        return 0
    fi
    return 1
}

# =============================================================================
# Commands
# =============================================================================

cmd_start() {
    local foreground="${1:-false}"

    info "ForgeCadNeo Autonomous Marketing Agent"
    info "======================================="

    check_python
    load_env
    check_credentials
    check_dependencies

    if is_running; then
        local pid
        pid=$(get_pid)
        warn "Agent is already running (PID ${pid})."
        warn "Stop it first with: $0 --stop"
        exit 1
    fi

    # Clean up stale PID file
    rm -f "${PID_FILE}"

    if [[ "${foreground}" == "true" ]]; then
        info "Starting agent in foreground..."
        info "Press Ctrl+C to stop."
        "${PYTHON}" "${AGENT_SCRIPT}" --daemon "$@"
    else
        info "Starting agent as background daemon..."
        nohup "${PYTHON}" -u "${AGENT_SCRIPT}" --daemon >> "${LOG_FILE}" 2>&1 &
        local daemon_pid=$!
        echo "${daemon_pid}" > "${PID_FILE}"
        sleep 2

        if kill -0 "${daemon_pid}" 2>/dev/null; then
            ok "Agent started successfully (PID ${daemon_pid})"
            ok "Log file: ${LOG_FILE}"
            ok "PID file: ${PID_FILE}"
            info "Stop with: $0 --stop"
            info "View logs: $0 --logs"
        else
            err "Agent failed to start. Check ${LOG_FILE} for errors."
            rm -f "${PID_FILE}"
            exit 1
        fi
    fi
}

cmd_stop() {
    if ! is_running; then
        warn "Agent is not running."
        rm -f "${PID_FILE}"
        return 0
    fi

    local pid
    pid=$(get_pid)
    info "Stopping agent (PID ${pid})..."

    # Send SIGTERM for graceful shutdown
    kill "${pid}" 2>/dev/null

    # Wait up to 30 seconds for graceful shutdown
    local waited=0
    while kill -0 "${pid}" 2>/dev/null && [[ "${waited}" -lt 30 ]]; do
        sleep 1
        waited=$((waited + 1))
    done

    if kill -0 "${pid}" 2>/dev/null; then
        warn "Agent did not stop gracefully. Sending SIGKILL..."
        kill -9 "${pid}" 2>/dev/null
        sleep 1
    fi

    rm -f "${PID_FILE}"
    ok "Agent stopped."
}

cmd_restart() {
    info "Restarting agent..."
    cmd_stop
    sleep 2
    cmd_start false
}

cmd_status() {
    load_env

    if is_running; then
        local pid
        pid=$(get_pid)
        ok "Agent is RUNNING (PID ${pid})"
    else
        warn "Agent is NOT RUNNING"
        if [[ -f "${PID_FILE}" ]]; then
            warn "Stale PID file found. Cleaning up."
            rm -f "${PID_FILE}"
        fi
    fi

    echo ""

    # Show detailed status from the agent state
    "${PYTHON}" "${AGENT_SCRIPT}" --status 2>/dev/null || {
        warn "Could not read agent state."
    }
}

cmd_once() {
    info "Running single decision cycle..."
    load_env
    check_credentials
    check_dependencies
    "${PYTHON}" "${AGENT_SCRIPT}" --once --no-pid "$@"
}

cmd_dry_run() {
    info "Running in dry-run mode (no write actions)..."
    load_env
    check_credentials
    check_dependencies
    "${PYTHON}" "${AGENT_SCRIPT}" --once --dry-run --no-pid "$@"
}

cmd_logs() {
    if [[ ! -f "${LOG_FILE}" ]]; then
        warn "No log file found at ${LOG_FILE}"
        exit 1
    fi

    info "Tailing agent log (Ctrl+C to stop)..."
    tail -f "${LOG_FILE}"
}

cmd_report() {
    load_env
    "${PYTHON}" "${AGENT_SCRIPT}" --report
}

# =============================================================================
# Main
# =============================================================================

case "${1:-}" in
    --stop|-s)
        cmd_stop
        ;;
    --restart|-r)
        cmd_restart
        ;;
    --status)
        cmd_status
        ;;
    --once|-1)
        shift
        cmd_once "$@"
        ;;
    --dry-run|-n)
        shift
        cmd_dry_run "$@"
        ;;
    --logs|-l)
        cmd_logs
        ;;
    --report)
        cmd_report
        ;;
    --fg|--foreground)
        shift
        cmd_start true "$@"
        ;;
    --daemon|--start|"")
        shift 2>/dev/null || true
        cmd_start false "$@"
        ;;
    --help|-h)
        echo ""
        echo "ForgeCadNeo Autonomous Marketing Agent"
        echo "======================================="
        echo ""
        echo "Usage: $0 [COMMAND] [OPTIONS]"
        echo ""
        echo "Commands:"
        echo "  (none), --start    Start the daemon in the background"
        echo "  --fg, --foreground Start in the foreground (for debugging)"
        echo "  --stop, -s         Stop the running daemon"
        echo "  --restart, -r      Restart the daemon"
        echo "  --status           Show agent status"
        echo "  --once, -1         Run a single decision cycle"
        echo "  --dry-run, -n      Single cycle, no write actions"
        echo "  --logs, -l         Tail the agent log file"
        echo "  --report           Generate daily activity report"
        echo "  --help, -h         Show this help message"
        echo ""
        echo "Environment:"
        echo "  ANTHROPIC_API_KEY  Required. Claude API key."
        echo "  REDDIT_CLIENT_ID   Required for Reddit features."
        echo "  REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD"
        echo "  PYTHON             Override Python interpreter (default: python3)"
        echo ""
        echo "Files:"
        echo "  .env               Auto-loaded credentials file"
        echo "  agent.pid          PID file for daemon management"
        echo "  agent.log          Log output from the daemon"
        echo "  agent-state.json   Persistent agent state"
        echo "  agent-log.json     Full action history log"
        echo "  agent-reports/     Daily markdown reports"
        echo ""
        ;;
    *)
        err "Unknown command: $1"
        echo "Run '$0 --help' for usage information."
        exit 1
        ;;
esac
