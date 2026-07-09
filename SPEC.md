# SPEC: OpenManus Containerized Agent Swarm

## Architecture
6 agent VMs running in isolated Docker containers, each executing OpenManus with OpenRouter free-tier LLM APIs. Plus a fleet API for orchestration and a dashboard for live monitoring.

## Agents (FLEET constant)
| ID | Name | Role | OpenRouter Model (free) |
|---|---|---|---|
| prospector | PROSPECTOR | Lead research & discovery | meta-llama/llama-4-maverick:free |
| forge | FORGE | Code generation & building | google/gemini-2.5-pro-exp-03-25:free |
| lens | LENS | Review, audit & QA | deepseek/deepseek-chat-v3-0324:free |
| copywriter | COPYWRITER | Content & copy generation | qwen/qwen3-235b-a22b:free |
| herald | HERALD | Outreach & communication | nvidia/nemotron-4-340b-instruct:free |
| ledger | LEDGER | Logging, tracking & analytics | moonshotai/kimi-k2:free |

## File Structure
```
openmanus-swarm/
├── generate_fleet.py          # Fleet config generator
├── docker-compose.yml         # 8 services (6 agents + fleet-api + dashboard)
├── .env.example               # Environment variable template
├── fleet-api/                 # FastAPI fleet management
│   ├── fleet_api.py           # Main API server
│   ├── requirements.txt       # Python deps
│   └── Dockerfile             # API container
├── dashboard/                 # React webapp (EDGE terminal aesthetic)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── types.ts
│   │   ├── components/
│   │   │   ├── AgentGrid.tsx
│   │   │   ├── AgentCard.tsx
│   │   │   ├── TerminalFeed.tsx
│   │   │   ├── ControlPanel.tsx
│   │   │   ├── AgentDetail.tsx
│   │   │   └── Layout.tsx
│   │   └── hooks/
│   │       ├── useFleet.ts
│   │       └── useLogs.ts
│   └── Dockerfile
├── agents/                    # Per-agent container files (generated)
│   ├── prospector/config.toml
│   ├── forge/config.toml
│   ├── lens/config.toml
│   ├── copywriter/config.toml
│   ├── herald/config.toml
│   ├── ledger/config.toml
│   ├── Dockerfile
│   └── run.sh
├── dashboard-preview/         # Static preview
│   └── index.html
└── README.md
```

## OpenRouter Free Models Reference
All agents use OpenRouter with free-tier models. The API key is shared via OPENROUTER_API_KEY env var. Each agent gets its model assigned in generate_fleet.py.

## Fleet API Spec (fleet_api.py)
FastAPI app, port 8800, SQLite storage.

### Endpoints
- `GET /agents` — List all agents with current status
- `GET /agents/{agent_id}` — Single agent details
- `GET /agents/{agent_id}/logs` — Recent log entries
- `POST /agents/{agent_id}/task` — Submit a task to an agent
- `POST /heartbeat` — Receive agent heartbeats
- `GET /health` — API health check
- `GET /metrics` — Fleet-wide metrics summary

## Dashboard Spec (React + Tailwind + Vite)
Single-page app, port 8080 (nginx), polls fleet API every 5s.

### Design: EDGE Terminal Aesthetic
- Background: near-black (#0a0a0f), subtle grid pattern
- Cards: dark surface (#13131f), 1px border (#1e1e2e), rounded-lg
- Accents per agent: unique neon color per agent ID
- Typography: monospace for data (JetBrains Mono), sans for labels (Inter)
- Status indicators: pulsing dots (green=active, yellow=busy, red=error, gray=offline)
- Terminal panel: scrollable log feed with timestamped entries
- Control panel: Start/Stop/Restart buttons per agent, Fleet-wide actions
