#!/usr/bin/env python3
"""
Fleet Management API for OpenManus Containerized Agent Swarm.

A lightweight FastAPI service that tracks agent health via heartbeats,
stores agent state in SQLite, and exposes REST endpoints for the
monitoring dashboard.

Run with::

    uvicorn fleet_api:app --host 0.0.0.0 --port 8800
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Configuration ─────────────────────────────────────────────────────────────

DATABASE_PATH: Path = Path("./fleet.db").resolve()
FLEET_API_PORT: int = 8800
DASHBOARD_ORIGIN: str = "http://localhost:8080"

# ── Pydantic Models ───────────────────────────────────────────────────────────


class HeartbeatPayload(BaseModel):
    """Payload sent by agents when posting a heartbeat."""

    agent_id: str = Field(..., description="Unique agent identifier")
    status: str = Field(..., description="Current agent status: idle|busy|error")
    timestamp: str = Field(..., description="ISO 8601 timestamp of the heartbeat")
    task_count: int = Field(0, description="Total tasks processed so far")
    current_task: str = Field("", description="Description of the current task")


class TaskPayload(BaseModel):
    """Payload for submitting a task to an agent."""

    task: str = Field(..., description="Task description to assign to the agent")


# ── Fleet Constant (mirrors generate_fleet.py) ───────────────────────────────

FLEET_DATA: list[dict[str, str]] = [
    {
        "id": "prospector",
        "name": "PROSPECTOR",
        "role": "Lead research & discovery",
        "model": "meta-llama/llama-4-maverick:free",
    },
    {
        "id": "forge",
        "name": "FORGE",
        "role": "Code generation & building",
        "model": "google/gemini-2.5-pro-exp-03-25:free",
    },
    {
        "id": "lens",
        "name": "LENS",
        "role": "Review, audit & QA",
        "model": "deepseek/deepseek-chat-v3-0324:free",
    },
    {
        "id": "copywriter",
        "name": "COPYWRITER",
        "role": "Content & copy generation",
        "model": "qwen/qwen3-235b-a22b:free",
    },
    {
        "id": "herald",
        "name": "HERALD",
        "role": "Outreach & communication",
        "model": "nvidia/nemotron-4-340b-instruct:free",
    },
    {
        "id": "ledger",
        "name": "LEDGER",
        "role": "Logging, tracking & analytics",
        "model": "moonshotai/kimi-k2:free",
    },
]


# ── SQLite Helpers ────────────────────────────────────────────────────────────


@contextmanager
def get_db():
    """Yield a SQLite connection with row factory enabled.

    Automatically commits on normal exit and rolls back on exception.
    """
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create tables if they do not already exist and seed the fleet."""
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS agents (
                id              TEXT PRIMARY KEY,
                name            TEXT NOT NULL,
                role            TEXT NOT NULL,
                model           TEXT NOT NULL,
                status          TEXT NOT NULL DEFAULT 'offline',
                last_heartbeat  TEXT,
                task_count      INTEGER NOT NULL DEFAULT 0,
                error_count     INTEGER NOT NULL DEFAULT 0,
                container_status TEXT DEFAULT 'unknown',
                created_at      TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS agent_logs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id    TEXT NOT NULL,
                level       TEXT NOT NULL DEFAULT 'info',
                message     TEXT NOT NULL,
                timestamp   TEXT NOT NULL,
                FOREIGN KEY (agent_id) REFERENCES agents(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id    TEXT NOT NULL,
                task        TEXT NOT NULL,
                status      TEXT NOT NULL DEFAULT 'pending',
                created_at  TEXT NOT NULL,
                completed_at TEXT,
                FOREIGN KEY (agent_id) REFERENCES agents(id)
            )
            """
        )

        # Seed agents from FLEET_DATA if they do not already exist
        for agent in FLEET_DATA:
            conn.execute(
                """
                INSERT OR IGNORE INTO agents
                    (id, name, role, model, status, created_at)
                VALUES (?, ?, ?, ?, 'offline', ?)
                """,
                (
                    agent["id"],
                    agent["name"],
                    agent["role"],
                    agent["model"],
                    now_iso(),
                ),
            )


def now_iso() -> str:
    """Return the current UTC timestamp as an ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()


# ── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Fleet Management API",
    description="REST API for the OpenManus Containerized Agent Swarm",
    version="1.0.0",
)

# Enable CORS for the dashboard origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[DASHBOARD_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    """Initialize the SQLite database on application startup."""
    init_db()


# ── Endpoints ─────────────────────────────────────────────────────────────────


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    """Return API health status."""
    return {"status": "ok", "service": "fleet-api"}


@app.get("/agents", tags=["agents"])
def list_agents() -> list[dict[str, Any]]:
    """List all agents with their current status."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM agents ORDER BY created_at"
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/agents/{agent_id}", tags=["agents"])
def get_agent(agent_id: str) -> dict[str, Any]:
    """Get details for a single agent."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM agents WHERE id = ?", (agent_id,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    return dict(row)


@app.get("/agents/{agent_id}/logs", tags=["agents"])
def get_agent_logs(agent_id: str, limit: int = 100) -> list[dict[str, Any]]:
    """Get recent log entries for a single agent.

    Parameters
    ----------
    agent_id:
        Unique identifier of the agent.
    limit:
        Maximum number of log entries to return (default 100).
    """
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM agent_logs
            WHERE agent_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (agent_id, limit),
        ).fetchall()
    return [dict(row) for row in rows]


@app.post("/agents/{agent_id}/task", tags=["agents"])
def submit_task(agent_id: str, payload: TaskPayload) -> dict[str, Any]:
    """Submit a task to a specific agent.

    The task is stored in the database and the agent's status is updated to
    ``busy`` so the next heartbeat cycle will pick it up.
    """
    with get_db() as conn:
        agent = conn.execute(
            "SELECT 1 FROM agents WHERE id = ?", (agent_id,)
        ).fetchone()
        if not agent:
            raise HTTPException(
                status_code=404, detail=f"Agent '{agent_id}' not found"
            )

        conn.execute(
            """
            INSERT INTO tasks (agent_id, task, status, created_at)
            VALUES (?, ?, 'pending', ?)
            """,
            (agent_id, payload.task, now_iso()),
        )
        conn.execute(
            "UPDATE agents SET status = 'busy' WHERE id = ?",
            (agent_id,),
        )
        conn.execute(
            """
            INSERT INTO agent_logs (agent_id, level, message, timestamp)
            VALUES (?, 'info', ?, ?)
            """,
            (agent_id, f"Task submitted: {payload.task}", now_iso()),
        )

    return {
        "message": f"Task submitted to {agent_id}",
        "agent_id": agent_id,
        "task": payload.task,
    }


@app.post("/heartbeat", tags=["agents"])
def heartbeat(payload: HeartbeatPayload) -> dict[str, Any]:
    """Receive a heartbeat from an agent and update its status.

    Heartbeats are expected every ~15 seconds from each running agent.
    """
    with get_db() as conn:
        existing = conn.execute(
            "SELECT 1 FROM agents WHERE id = ?", (payload.agent_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(
                status_code=404, detail=f"Agent '{payload.agent_id}' not registered"
            )

        conn.execute(
            """
            UPDATE agents
            SET status = ?,
                last_heartbeat = ?,
                task_count = ?,
                container_status = 'running'
            WHERE id = ?
            """,
            (
                payload.status,
                payload.timestamp,
                payload.task_count,
                payload.agent_id,
            ),
        )

        if payload.current_task:
            conn.execute(
                """
                INSERT INTO agent_logs (agent_id, level, message, timestamp)
                VALUES (?, 'info', ?, ?)
                """,
                (
                    payload.agent_id,
                    f"Current task: {payload.current_task}",
                    payload.timestamp,
                ),
            )

    return {"message": "Heartbeat received", "agent_id": payload.agent_id}


@app.get("/metrics", tags=["system"])
def get_metrics() -> dict[str, Any]:
    """Return fleet-wide summary metrics."""
    with get_db() as conn:
        total = conn.execute(
            "SELECT COUNT(*) FROM agents"
        ).fetchone()[0]
        active = conn.execute(
            "SELECT COUNT(*) FROM agents WHERE status IN ('idle', 'busy')"
        ).fetchone()[0]
        busy = conn.execute(
            "SELECT COUNT(*) FROM agents WHERE status = 'busy'"
        ).fetchone()[0]
        errors = conn.execute(
            "SELECT COUNT(*) FROM agents WHERE status = 'error'"
        ).fetchone()[0]
        total_tasks = conn.execute(
            "SELECT COALESCE(SUM(task_count), 0) FROM agents"
        ).fetchone()[0]
        pending_tasks = conn.execute(
            "SELECT COUNT(*) FROM tasks WHERE status = 'pending'"
        ).fetchone()[0]

    return {
        "total_agents": total,
        "active_agents": active,
        "busy_agents": busy,
        "error_agents": errors,
        "offline_agents": total - active - errors,
        "total_tasks_completed": total_tasks,
        "pending_tasks": pending_tasks,
        "timestamp": now_iso(),
    }
