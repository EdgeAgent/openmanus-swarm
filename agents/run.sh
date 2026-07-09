#!/usr/bin/env bash
# Agent startup script for OpenManus Containerized Agent Swarm.
# Each agent container runs this script to start OpenManus and begin
# heartbeating status back to the fleet API.

set -euo pipefail

# ── Validate required environment ─────────────────────────────────────────────

: "${AGENT_ID:?AGENT_ID env var is required}"
: "${AGENT_NAME:?AGENT_NAME env var is required}"
: "${HEARTBEAT_URL:?HEARTBEAT_URL env var is required}"
: "${OPENROUTER_API_KEY:?OPENROUTER_API_KEY env var is required}"

AGENT_ROLE="${AGENT_ROLE:-unknown}"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting agent: $AGENT_NAME ($AGENT_ID)"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Role: $AGENT_ROLE"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Heartbeat URL: $HEARTBEAT_URL"

# ── Start OpenManus (or simulation fallback) ──────────────────────────────────

start_openmanus() {
    if command -v openmanus &>/dev/null; then
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting OpenManus CLI..."
        # Run OpenManus in background with config
        openmanus --config /app/config.toml &
        OPENMANUS_PID=$!
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] OpenManus PID: $OPENMANUS_PID"
    elif [ -f /app/main.py ]; then
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting OpenManus main.py..."
        python /app/main.py --config /app/config.toml &
        OPENMANUS_PID=$!
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] OpenManus PID: $OPENMANUS_PID"
    else
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] OpenManus not found, running in simulation mode"
        # Simulation: keepalive loop
        (
            while true; do
                sleep 60
                echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Simulation keepalive"
            done
        ) &
        OPENMANUS_PID=$!
    fi
}

# ── Heartbeat loop ────────────────────────────────────────────────────────────

heartbeat() {
    local status="${1:-idle}"
    local task_count="${2:-0}"
    local current_task="${3:-}"
    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    local payload
    payload=$(cat <<EOF
{
    "agent_id": "$AGENT_ID",
    "status": "$status",
    "timestamp": "$timestamp",
    "task_count": $task_count,
    "current_task": "$current_task"
}
EOF
)

    curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$HEARTBEAT_URL" 2>/dev/null || echo "000"
}

# ── Cleanup on exit ───────────────────────────────────────────────────────────

cleanup() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Shutting down agent: $AGENT_ID"
    heartbeat "offline" 0 "" &>/dev/null || true
    if [ -n "${OPENMANUS_PID:-}" ]; then
        kill "$OPENMANUS_PID" 2>/dev/null || true
        wait "$OPENMANUS_PID" 2>/dev/null || true
    fi
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Agent $AGENT_ID stopped"
}
trap cleanup EXIT

# ── Main loop ─────────────────────────────────────────────────────────────────

start_openmanus

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting heartbeat loop (every 15s)"

TASK_COUNT=0
STATUS="idle"

while true; do
    # Check if OpenManus is still running
    if [ -n "${OPENMANUS_PID:-}" ] && ! kill -0 "$OPENMANUS_PID" 2>/dev/null; then
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] WARNING: OpenManus process exited"
        STATUS="error"
        heartbeat "$STATUS" "$TASK_COUNT" "Process crashed" || true
        sleep 15
        continue
    fi

    # Post heartbeat
    HTTP_CODE=$(heartbeat "$STATUS" "$TASK_COUNT" "")

    if [ "$HTTP_CODE" = "200" ]; then
        STATUS="idle"
    elif [ "$HTTP_CODE" = "000" ]; then
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] WARNING: Fleet API unreachable"
    fi

    # Randomly simulate task activity
    if [ "$(( RANDOM % 10 ))" -lt 2 ]; then
        TASK_COUNT=$((TASK_COUNT + 1))
        STATUS="busy"
    fi

    sleep 15
done
