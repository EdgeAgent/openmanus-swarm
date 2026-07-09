export interface Agent {
  id: string;
  name: string;
  role: string;
  model: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  last_heartbeat: string;
  task_count: number;
  error_count: number;
  accent_color: string;
}

export interface LogEntry {
  id: number;
  agent_id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface FleetMetrics {
  total_agents: number;
  active: number;
  busy: number;
  errors: number;
  total_tasks: number;
}

export const DEFAULT_AGENTS: Agent[] = [
  { id: 'prospector', name: 'PROSPECTOR', role: 'Lead Research', model: 'meta-llama/llama-4-maverick:free', status: 'offline', last_heartbeat: '-', task_count: 0, error_count: 0, accent_color: '#00f0ff' },
  { id: 'forge', name: 'FORGE', role: 'Code Generation', model: 'google/gemini-2.5-pro-exp-03-25:free', status: 'offline', last_heartbeat: '-', task_count: 0, error_count: 0, accent_color: '#ff6b35' },
  { id: 'lens', name: 'LENS', role: 'Review & QA', model: 'deepseek/deepseek-chat-v3-0324:free', status: 'offline', last_heartbeat: '-', task_count: 0, error_count: 0, accent_color: '#a78bfa' },
  { id: 'copywriter', name: 'COPYWRITER', role: 'Content Creation', model: 'qwen/qwen3-235b-a22b:free', status: 'offline', last_heartbeat: '-', task_count: 0, error_count: 0, accent_color: '#34d399' },
  { id: 'herald', name: 'HERALD', role: 'Outreach', model: 'nvidia/nemotron-4-340b-instruct:free', status: 'offline', last_heartbeat: '-', task_count: 0, error_count: 0, accent_color: '#fbbf24' },
  { id: 'ledger', name: 'LEDGER', role: 'Analytics', model: 'moonshotai/kimi-k2:free', status: 'offline', last_heartbeat: '-', task_count: 0, error_count: 0, accent_color: '#f472b6' },
];
