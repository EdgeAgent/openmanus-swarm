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

import atexit
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from croniter import croniter
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ── Configuration ─────────────────────────────────────────────────────────────

DATABASE_PATH: Path = Path("./fleet.db").resolve()
FLEET_API_PORT: int = 8800
DASHBOARD_ORIGIN: str = "http://localhost:8080"
OPENROUTER_API_KEY: str = os.environ.get("OPENROUTER_API_KEY", "")

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


class ChatMessagePayload(BaseModel):
    """Payload for sending a chat message to an agent via OpenRouter."""

    agent_id: str = Field(..., description="Unique agent identifier")
    message: str = Field(..., description="User message to send to the agent")


class ChatMessageResponse(BaseModel):
    """Response model for a chat message exchange."""

    agent_id: str = Field(..., description="Unique agent identifier")
    role: str = Field(..., description="Message role: user or agent")
    message: str = Field(..., description="Message content")
    timestamp: str = Field(..., description="ISO 8601 timestamp of the message")


class CronJobPayload(BaseModel):
    """Payload for creating a new cron job."""

    agent_id: str = Field(..., description="Unique agent identifier")
    name: str = Field(..., description="Human-readable job name")
    cron_expr: str = Field(..., description="Cron expression (e.g. '0 * * * *')")
    task: str = Field(..., description="Task description to send to the agent")


class CronJobTogglePayload(BaseModel):
    """Payload for toggling a cron job's active state."""

    is_active: bool = Field(..., description="Whether the job should be active")


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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chats (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id    TEXT NOT NULL,
                role        TEXT NOT NULL,
                message     TEXT NOT NULL,
                model       TEXT,
                timestamp   TEXT NOT NULL,
                FOREIGN KEY (agent_id) REFERENCES agents(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cron_jobs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id    TEXT NOT NULL,
                name        TEXT NOT NULL,
                cron_expr   TEXT NOT NULL,
                task        TEXT NOT NULL,
                is_active   INTEGER NOT NULL DEFAULT 1,
                last_run    TEXT,
                next_run    TEXT,
                run_count   INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cron_job_runs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id      INTEGER NOT NULL,
                status      TEXT NOT NULL DEFAULT 'pending',
                output      TEXT,
                started_at  TEXT NOT NULL,
                completed_at TEXT,
                FOREIGN KEY (job_id) REFERENCES cron_jobs(id)
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


# ── Background Scheduler ──────────────────────────────────────────────────────

scheduler = BackgroundScheduler()


def execute_cron_job(job_id: int) -> None:
    """Execute a cron job by dispatching its task to the agent via chat.

    Parameters
    ----------
    job_id:
        The primary key of the cron job to execute.
    """
    try:
        with get_db() as conn:
            job = conn.execute(
                "SELECT * FROM cron_jobs WHERE id = ?", (job_id,)
            ).fetchone()
            if not job:
                print(f"[cron] Job {job_id} not found")
                return
            job_dict = dict(job)
            if not job_dict["is_active"]:
                print(f"[cron] Job {job_id} is inactive, skipping")
                return

            # Create a run record
            cur = conn.execute(
                """
                INSERT INTO cron_job_runs (job_id, status, started_at)
                VALUES (?, 'running', ?)
                """,
                (job_id, now_iso()),
            )
            run_id = cur.lastrowid

        # Use the chat proxy to send the task to the agent
        agent_id = job_dict["agent_id"]
        task = job_dict["task"]

        # Build the chat payload and call the internal chat logic
        chat_payload = ChatMessagePayload(agent_id=agent_id, message=task)
        response = _chat_with_agent(chat_payload)

        # Update run record and job stats
        with get_db() as conn:
            conn.execute(
                """
                UPDATE cron_job_runs
                SET status = 'completed', output = ?, completed_at = ?
                WHERE id = ?
                """,
                (response["message"], now_iso(), run_id),
            )
            # Calculate next run time
            next_run_ts = ""
            try:
                next_dt = croniter(job_dict["cron_expr"], datetime.now(timezone.utc)).get_next(datetime)
                next_run_ts = next_dt.isoformat()
            except Exception:
                next_run_ts = ""

            conn.execute(
                """
                UPDATE cron_jobs
                SET last_run = ?, next_run = ?, run_count = run_count + 1
                WHERE id = ?
                """,
                (now_iso(), next_run_ts, job_id),
            )

        print(f"[cron] Job {job_id} executed successfully, run_id={run_id}")

    except Exception as exc:
        print(f"[cron] Job {job_id} execution failed: {exc}")
        # Attempt to mark the run as failed
        try:
            with get_db() as conn:
                # Find the most recent run for this job
                run_row = conn.execute(
                    """
                    SELECT id FROM cron_job_runs
                    WHERE job_id = ? AND status = 'running'
                    ORDER BY started_at DESC LIMIT 1
                    """,
                    (job_id,),
                ).fetchone()
                if run_row:
                    conn.execute(
                        """
                        UPDATE cron_job_runs
                        SET status = 'failed', output = ?, completed_at = ?
                        WHERE id = ?
                        """,
                        (str(exc), now_iso(), run_row["id"]),
                    )
        except Exception as inner_exc:
            print(f"[cron] Failed to record job failure: {inner_exc}")


def schedule_all_jobs() -> None:
    """Schedule all active cron jobs in the background scheduler."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM cron_jobs WHERE is_active = 1"
        ).fetchall()

    for row in rows:
        job = dict(row)
        job_id = job["id"]
        cron_expr = job["cron_expr"]
        try:
            # Validate cron expression
            parts = cron_expr.split()
            if len(parts) != 5:
                print(f"[cron] Invalid cron expression for job {job_id}: {cron_expr}")
                continue
            minute, hour, day, month, day_of_week = parts
            trigger = CronTrigger(
                minute=minute,
                hour=hour,
                day=day,
                month=month,
                day_of_week=day_of_week,
            )
            scheduler.add_job(
                func=execute_cron_job,
                trigger=trigger,
                id=f"cron_job_{job_id}",
                args=[job_id],
                replace_existing=True,
            )
            print(f"[cron] Scheduled job {job_id} with expression '{cron_expr}'")
        except Exception as exc:
            print(f"[cron] Failed to schedule job {job_id}: {exc}")


@app.on_event("startup")
def on_startup() -> None:
    """Initialize the SQLite database and start the background scheduler."""
    init_db()
    schedule_all_jobs()
    scheduler.start()
    print("[scheduler] Background scheduler started")


# Register scheduler shutdown on application exit
atexit.register(lambda: scheduler.shutdown(wait=False))


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


# ── Chat Proxy ────────────────────────────────────────────────────────────────


def _chat_with_agent(payload: ChatMessagePayload) -> dict[str, Any]:
    """Send a message to an agent via OpenRouter and persist the exchange.

    This internal function is reused by both the HTTP endpoint and the
    cron scheduler so that scheduled tasks go through the same LLM path.

    Parameters
    ----------
    payload:
        ChatMessagePayload containing agent_id and message.

    Returns
    -------
    dict:
        A dictionary with the agent's response fields (agent_id, role,
        message, timestamp).
    """
    agent_id = payload.agent_id
    message = payload.message

    with get_db() as conn:
        agent = conn.execute(
            "SELECT * FROM agents WHERE id = ?", (agent_id,)
        ).fetchone()
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    agent_dict = dict(agent)
    agent_name = agent_dict["name"]
    agent_role = agent_dict["role"]
    agent_model = agent_dict["model"]
    ts = now_iso()

    # Persist the user message
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO chats (agent_id, role, message, model, timestamp)
            VALUES (?, 'user', ?, ?, ?)
            """,
            (agent_id, message, agent_model, ts),
        )

    if not OPENROUTER_API_KEY:
        # Return a mock response when no API key is configured
        mock_response = (
            f"[MOCK] {agent_name} received: '{message}'. "
            f"(No OPENROUTER_API_KEY set -- configure the environment variable "
            f"to enable live LLM responses.)"
        )
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO chats (agent_id, role, message, model, timestamp)
                VALUES (?, 'agent', ?, ?, ?)
                """,
                (agent_id, mock_response, agent_model, now_iso()),
            )
        return {
            "agent_id": agent_id,
            "role": "agent",
            "message": mock_response,
            "timestamp": now_iso(),
        }

    # Call OpenRouter
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": DASHBOARD_ORIGIN,
        "X-Title": "OpenManus Swarm Chat",
    }
    body = {
        "model": agent_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    f"You are {agent_name}, a specialized AI agent. "
                    f"Your role: {agent_role}. Respond concisely."
                ),
            },
            {"role": "user", "content": message},
        ],
    }

    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=body,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        choices = data.get("choices", [])
        if choices:
            assistant_message = choices[0].get("message", {}).get("content", "")
        else:
            assistant_message = "(No response from model)"
    except Exception as exc:
        assistant_message = f"[Error contacting OpenRouter: {exc}]"

    # Persist the agent response
    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO chats (agent_id, role, message, model, timestamp)
            VALUES (?, 'agent', ?, ?, ?)
            """,
            (agent_id, assistant_message, agent_model, now_iso()),
        )

    return {
        "agent_id": agent_id,
        "role": "agent",
        "message": assistant_message,
        "timestamp": now_iso(),
    }


@app.post("/chat", tags=["chat"])
def chat(payload: ChatMessagePayload) -> dict[str, Any]:
    """Send a message to an agent and return the LLM response.

    The user's message and the agent's reply are both persisted to the
    ``chats`` table for full conversation history.

    If ``OPENROUTER_API_KEY`` is not set, a mock response is returned.
    """
    return _chat_with_agent(payload)


@app.get("/chat/{agent_id}/history", tags=["chat"])
def get_chat_history(agent_id: str) -> list[dict[str, Any]]:
    """Return the last 100 chat messages for an agent, oldest first.

    Parameters
    ----------
    agent_id:
        Unique identifier of the agent.
    """
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM chats
            WHERE agent_id = ?
            ORDER BY timestamp ASC
            LIMIT 100
            """,
            (agent_id,),
        ).fetchall()
    return [dict(row) for row in rows]


@app.delete("/chat/{agent_id}/history", tags=["chat"])
def clear_chat_history(agent_id: str) -> dict[str, str]:
    """Clear all chat history for an agent.

    Parameters
    ----------
    agent_id:
        Unique identifier of the agent.
    """
    with get_db() as conn:
        conn.execute("DELETE FROM chats WHERE agent_id = ?", (agent_id,))
    return {"message": f"Chat history cleared for agent '{agent_id}'"}


# ── Cron Task Scheduler ───────────────────────────────────────────────────────


@app.post("/cron-jobs", tags=["cron"])
def create_cron_job(payload: CronJobPayload) -> dict[str, Any]:
    """Create a new cron job.

    The job is inserted into the database and, if active, scheduled in
    the background scheduler.

    Parameters
    ----------
    payload:
        CronJobPayload containing agent_id, name, cron_expr, and task.
    """
    # Validate agent exists
    with get_db() as conn:
        agent = conn.execute(
            "SELECT 1 FROM agents WHERE id = ?", (payload.agent_id,)
        ).fetchone()
    if not agent:
        raise HTTPException(
            status_code=404, detail=f"Agent '{payload.agent_id}' not found"
        )

    # Calculate next run time
    try:
        next_dt = croniter(payload.cron_expr, datetime.now(timezone.utc)).get_next(datetime)
        next_run = next_dt.isoformat()
    except Exception:
        raise HTTPException(
            status_code=400, detail=f"Invalid cron expression: '{payload.cron_expr}'"
        )

    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO cron_jobs (agent_id, name, cron_expr, task, is_active, next_run, created_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
            """,
            (
                payload.agent_id,
                payload.name,
                payload.cron_expr,
                payload.task,
                next_run,
                now_iso(),
            ),
        )
        job_id = cur.lastrowid

    # Schedule the job in the background scheduler
    try:
        parts = payload.cron_expr.split()
        if len(parts) == 5:
            minute, hour, day, month, day_of_week = parts
            trigger = CronTrigger(
                minute=minute,
                hour=hour,
                day=day,
                month=month,
                day_of_week=day_of_week,
            )
            scheduler.add_job(
                func=execute_cron_job,
                trigger=trigger,
                id=f"cron_job_{job_id}",
                args=[job_id],
                replace_existing=True,
            )
    except Exception as exc:
        print(f"[cron] Failed to schedule new job {job_id}: {exc}")

    # Fetch the created job
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT c.*, a.name AS agent_name
            FROM cron_jobs c
            JOIN agents a ON c.agent_id = a.id
            WHERE c.id = ?
            """,
            (job_id,),
        ).fetchone()

    return dict(row)


@app.get("/cron-jobs", tags=["cron"])
def list_cron_jobs() -> list[dict[str, Any]]:
    """List all cron jobs with their associated agent names."""
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT c.*, a.name AS agent_name
            FROM cron_jobs c
            JOIN agents a ON c.agent_id = a.id
            ORDER BY c.created_at DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/cron-jobs/{job_id}", tags=["cron"])
def get_cron_job(job_id: int) -> dict[str, Any]:
    """Get a single cron job by ID.

    Parameters
    ----------
    job_id:
        Primary key of the cron job.
    """
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT c.*, a.name AS agent_name
            FROM cron_jobs c
            JOIN agents a ON c.agent_id = a.id
            WHERE c.id = ?
            """,
            (job_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Cron job '{job_id}' not found")
    return dict(row)


@app.put("/cron-jobs/{job_id}", tags=["cron"])
def update_cron_job(
    job_id: int, payload: CronJobPayload
) -> dict[str, Any]:
    """Update an existing cron job.

    Parameters
    ----------
    job_id:
        Primary key of the cron job to update.
    payload:
        CronJobPayload with new values for agent_id, name, cron_expr, and task.
    """
    # Validate agent exists
    with get_db() as conn:
        agent = conn.execute(
            "SELECT 1 FROM agents WHERE id = ?", (payload.agent_id,)
        ).fetchone()
    if not agent:
        raise HTTPException(
            status_code=404, detail=f"Agent '{payload.agent_id}' not found"
        )

    # Calculate next run time
    try:
        next_dt = croniter(payload.cron_expr, datetime.now(timezone.utc)).get_next(datetime)
        next_run = next_dt.isoformat()
    except Exception:
        raise HTTPException(
            status_code=400, detail=f"Invalid cron expression: '{payload.cron_expr}'"
        )

    with get_db() as conn:
        existing = conn.execute(
            "SELECT 1 FROM cron_jobs WHERE id = ?", (job_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(
                status_code=404, detail=f"Cron job '{job_id}' not found"
            )

        conn.execute(
            """
            UPDATE cron_jobs
            SET agent_id = ?,
                name = ?,
                cron_expr = ?,
                task = ?,
                next_run = ?
            WHERE id = ?
            """,
            (
                payload.agent_id,
                payload.name,
                payload.cron_expr,
                payload.task,
                next_run,
                job_id,
            ),
        )

    # Reschedule the job in the background scheduler
    try:
        parts = payload.cron_expr.split()
        if len(parts) == 5:
            minute, hour, day, month, day_of_week = parts
            trigger = CronTrigger(
                minute=minute,
                hour=hour,
                day=day,
                month=month,
                day_of_week=day_of_week,
            )
            scheduler.add_job(
                func=execute_cron_job,
                trigger=trigger,
                id=f"cron_job_{job_id}",
                args=[job_id],
                replace_existing=True,
            )
    except Exception as exc:
        print(f"[cron] Failed to reschedule job {job_id}: {exc}")

    with get_db() as conn:
        row = conn.execute(
            """
            SELECT c.*, a.name AS agent_name
            FROM cron_jobs c
            JOIN agents a ON c.agent_id = a.id
            WHERE c.id = ?
            """,
            (job_id,),
        ).fetchone()

    return dict(row)


@app.delete("/cron-jobs/{job_id}", tags=["cron"])
def delete_cron_job(job_id: int) -> dict[str, str]:
    """Delete a cron job and all of its run history.

    Parameters
    ----------
    job_id:
        Primary key of the cron job to delete.
    """
    with get_db() as conn:
        existing = conn.execute(
            "SELECT 1 FROM cron_jobs WHERE id = ?", (job_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(
                status_code=404, detail=f"Cron job '{job_id}' not found"
            )

        conn.execute("DELETE FROM cron_job_runs WHERE job_id = ?", (job_id,))
        conn.execute("DELETE FROM cron_jobs WHERE id = ?", (job_id,))

    # Remove from scheduler if present
    try:
        scheduler.remove_job(f"cron_job_{job_id}")
    except Exception:
        pass

    return {"message": f"Cron job '{job_id}' and its run history deleted"}


@app.post("/cron-jobs/{job_id}/toggle", tags=["cron"])
def toggle_cron_job(job_id: int, payload: CronJobTogglePayload) -> dict[str, Any]:
    """Toggle a cron job's active state and add or remove it from the scheduler.

    Parameters
    ----------
    job_id:
        Primary key of the cron job.
    payload:
        CronJobTogglePayload with the desired is_active state.
    """
    with get_db() as conn:
        existing = conn.execute(
            "SELECT * FROM cron_jobs WHERE id = ?", (job_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(
                status_code=404, detail=f"Cron job '{job_id}' not found"
            )

        job = dict(existing)
        is_active_int = 1 if payload.is_active else 0
        conn.execute(
            "UPDATE cron_jobs SET is_active = ? WHERE id = ?",
            (is_active_int, job_id),
        )

    if payload.is_active:
        # Add or reschedule the job
        try:
            cron_expr = job["cron_expr"]
            parts = cron_expr.split()
            if len(parts) == 5:
                minute, hour, day, month, day_of_week = parts
                trigger = CronTrigger(
                    minute=minute,
                    hour=hour,
                    day=day,
                    month=month,
                    day_of_week=day_of_week,
                )
                scheduler.add_job(
                    func=execute_cron_job,
                    trigger=trigger,
                    id=f"cron_job_{job_id}",
                    args=[job_id],
                    replace_existing=True,
                )
        except Exception as exc:
            print(f"[cron] Failed to schedule job {job_id} on toggle: {exc}")
    else:
        # Remove from scheduler
        try:
            scheduler.remove_job(f"cron_job_{job_id}")
        except Exception:
            pass

    with get_db() as conn:
        row = conn.execute(
            """
            SELECT c.*, a.name AS agent_name
            FROM cron_jobs c
            JOIN agents a ON c.agent_id = a.id
            WHERE c.id = ?
            """,
            (job_id,),
        ).fetchone()

    return dict(row)


@app.post("/cron-jobs/{job_id}/trigger", tags=["cron"])
def trigger_cron_job(job_id: int) -> dict[str, str]:
    """Trigger a cron job immediately, independent of its schedule.

    Parameters
    ----------
    job_id:
        Primary key of the cron job to trigger.
    """
    with get_db() as conn:
        existing = conn.execute(
            "SELECT 1 FROM cron_jobs WHERE id = ?", (job_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(
                status_code=404, detail=f"Cron job '{job_id}' not found"
            )

    # Execute in the background so the HTTP response returns immediately
    scheduler.add_job(
        func=execute_cron_job,
        trigger="date",
        args=[job_id],
        replace_existing=False,
    )

    return {"message": f"Cron job '{job_id}' triggered"}


@app.get("/cron-jobs/{job_id}/runs", tags=["cron"])
def get_cron_job_runs(job_id: int) -> list[dict[str, Any]]:
    """Get the run history for a cron job.

    Parameters
    ----------
    job_id:
        Primary key of the cron job.
    """
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM cron_job_runs
            WHERE job_id = ?
            ORDER BY started_at DESC
            """,
            (job_id,),
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/cron-jobs/{job_id}/runs/{run_id}", tags=["cron"])
def get_cron_job_run(job_id: int, run_id: int) -> dict[str, Any]:
    """Get details for a single cron job run.

    Parameters
    ----------
    job_id:
        Primary key of the parent cron job.
    run_id:
        Primary key of the specific run record.
    """
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT * FROM cron_job_runs
            WHERE job_id = ? AND id = ?
            """,
            (job_id, run_id),
        ).fetchone()
    if not row:
        raise HTTPException(
            status_code=404, detail=f"Run '{run_id}' for job '{job_id}' not found"
        )
    return dict(row)
