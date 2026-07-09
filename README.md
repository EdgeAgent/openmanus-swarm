# OpenManus Containerized Agent Swarm

A production-ready, containerized multi-agent system built on [OpenManus](https://github.com/FoundationAgents/OpenManus). Six specialized AI agents run in isolated Docker containers, each powered by a different free-tier model via OpenRouter. A FastAPI fleet management service tracks agent health via heartbeats, and a React dashboard provides real-time monitoring with an EDGE terminal aesthetic.

```
                    OpenManus Containerized Agent Swarm
    ┌─────────────────────────────────────────────────────────────┐
    │                      DASHBOARD (:8080)                       │
    │            EDGE Terminal Swarm Control Panel                 │
    └─────────────────────────┬───────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   FLEET API (:8800) │
                    │   FastAPI + SQLite   │
                    └─────────┬──────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐  ┌──────────▼─────────┐  ┌────────▼─────┐
   │PROSPECTOR│  │      FORGE         │  │    LENS      │
   │  :free   │  │      :free         │  │   :free      │
   │Research  │  │Code Generation     │  │Review & QA   │
   │llama-4   │  │gemini-2.5          │  │deepseek-v3   │
   └──────────┘  └────────────────────┘  └──────────────┘
   ┌──────────┐  ┌────────────────────┐  ┌──────────────┐
   │COPYWRITER│  │      HERALD        │  │    LEDGER    │
   │  :free   │  │      :free         │  │   :free      │
   │Content   │  │Outreach            │  │Analytics     │
   │qwen3     │  │nemotron-4          │  │kimi-k2       │
   └──────────┘  └────────────────────┘  └──────────────┘
```

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/EdgeAgent/openmanus-swarm.git
cd openmanus-swarm

# 2. Set your OpenRouter API key
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY

# 3. Generate fleet configs and launch
python3 generate_fleet.py   # Creates agent configs + docker-compose

# 4. Deploy the full swarm
docker compose up -d --build

# 5. Open the dashboard
open http://localhost:8080
```

## Agent Roster

| Agent | Role | Model (Free Tier) |
|-------|------|-------------------|
| **PROSPECTOR** | Lead research & discovery | `meta-llama/llama-4-maverick:free` |
| **FORGE** | Code generation & building | `google/gemini-2.5-pro-exp-03-25:free` |
| **LENS** | Review, audit & QA | `deepseek/deepseek-chat-v3-0324:free` |
| **COPYWRITER** | Content & copy generation | `qwen/qwen3-235b-a22b:free` |
| **HERALD** | Outreach & communication | `nvidia/nemotron-4-340b-instruct:free` |
| **LEDGER** | Logging, tracking & analytics | `moonshotai/kimi-k2:free` |

## Architecture

### 8 Services (Docker Compose)

| Service | Port | Description |
|---------|------|-------------|
| `prospector` | — | Lead research agent |
| `forge` | — | Code generation agent |
| `lens` | — | QA & review agent |
| `copywriter` | — | Content creation agent |
| `herald` | — | Outreach agent |
| `ledger` | — | Analytics agent |
| `fleet-api` | `8800` | FastAPI fleet management |
| `dashboard` | `8080` | React monitoring UI |

### How It Works

1. **Fleet Generator** (`generate_fleet.py`) — Reads the `FLEET` constant, creates per-agent directories with `config.toml` files (OpenRouter model + API key + heartbeat URL), and generates the root `docker-compose.yml`
2. **Agent Containers** — Each agent is an isolated Docker container running `run.sh`, which starts OpenManus and posts a heartbeat to the fleet API every 15 seconds
3. **Fleet API** — FastAPI service with SQLite storage. Receives heartbeats, serves agent status, accepts task submissions. CORS-enabled for the dashboard
4. **Dashboard** — React SPA with EDGE terminal aesthetic. Polls the fleet API every 5s for agent status, displays a 2x3 VM grid with neon accent colors, live log feed, and fleet controls. Falls back to mock data when API is unreachable

## Fleet API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | API health check |
| `GET` | `/agents` | List all agents |
| `GET` | `/agents/{id}` | Single agent details |
| `GET` | `/agents/{id}/logs` | Agent log entries |
| `POST` | `/agents/{id}/task` | Submit task to agent |
| `POST` | `/heartbeat` | Receive agent heartbeat |
| `GET` | `/metrics` | Fleet-wide summary |

### Heartbeat Payload

```json
{
  "agent_id": "prospector",
  "status": "idle",
  "timestamp": "2025-01-01T12:00:00Z",
  "task_count": 12,
  "current_task": "Scanning for leads..."
}
```

## Dashboard Features

- **VM Grid** — 2x3 grid of agent cards with neon accent colors per agent
- **Status Indicators** — Pulsing dots (green=idle, amber=busy, red=error, gray=offline)
- **Live Terminal Feed** — Real-time log stream with color-coded entries per agent
- **Fleet Controls** — Start All / Stop All / Restart Fleet buttons
- **Agent Detail View** — Click any agent card for full details + task submission
- **Mock Fallback** — Dashboard works standalone with simulated data when fleet API is down

## Customization

### Adding an Agent

Edit `generate_fleet.py` and add to the `FLEET` list:

```python
{
    "id": "architect",
    "name": "ARCHITECT",
    "role": "System design & planning",
    "model": "anthropic/claude-sonnet-4-20250514:free",
},
```

Then rerun `python3 generate_fleet.py` and `docker compose up -d --build`.

### Changing Models

All agents use OpenRouter's free tier. Browse available free models at [openrouter.ai/models](https://openrouter.ai/models?order=pricing-low-to-high). Update the `model` field in `FLEET` and regenerate.

### n8n Integration

Each agent POSTs heartbeats to the fleet API every 15s. The fleet API stores this in SQLite. You can additionally forward heartbeats to an n8n webhook by setting `N8N_HEARTBEAT_WEBHOOK` in `.env` — the `run.sh` script includes a hook for this.

## File Structure

```
openmanus-swarm/
├── generate_fleet.py          # Fleet config generator
├── docker-compose.yml         # 8 services
├── .env.example               # Env template
├── fleet-api/                 # FastAPI service
│   ├── fleet_api.py
│   ├── requirements.txt
│   └── Dockerfile
├── dashboard/                 # React SPA
│   ├── src/
│   │   ├── components/        # AgentGrid, AgentCard, TerminalFeed, etc.
│   │   ├── hooks/             # useFleet, useLogs
│   │   └── types.ts
│   ├── package.json
│   ├── Dockerfile
│   └── ...
├── agents/                    # Per-agent configs
│   ├── Dockerfile
│   ├── run.sh                 # Agent startup + heartbeat
│   ├── prospector/config.toml
│   ├── forge/config.toml
│   └── ...
└── README.md
```

## Requirements

- Docker + Docker Compose
- Python 3.11+ (for fleet generator)
- OpenRouter API key (free tier works)

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Agents stuck "offline" | Check `fleet-api` is healthy: `curl http://localhost:8800/health` |
| Dashboard blank | Verify `fleet-api` is running; dashboard falls back to mock data after 5s |
| OpenManus not found | The agent Dockerfile falls back to simulation mode — OpenManus auto-installs from pip |
| Port conflicts | Change ports in `docker-compose.yml` (8080 for dashboard, 8800 for fleet-api) |

## License

MIT
