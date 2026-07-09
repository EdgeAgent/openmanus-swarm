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

export interface ChatMessage {
  id: number;
  agent_id: string;
  role: 'user' | 'agent';
  message: string;
  model?: string;
  timestamp: string;
}

export interface CronJob {
  id: number;
  agent_id: string;
  name: string;
  cron_expr: string;
  task: string;
  is_active: boolean;
  last_run: string | null;
  next_run: string | null;
  run_count: number;
  created_at: string;
  agent_name?: string;
  agent_color?: string;
}

export interface CronJobRun {
  id: number;
  job_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output: string | null;
  started_at: string;
  completed_at: string | null;
}

export const DEFAULT_AGENTS: Agent[] = [
  { id: 'prospector', name: 'PROSPECTOR', role: 'Lead Research', model: 'meta-llama/llama-4-maverick:free', status: 'offline', last_heartbeat: '-', task_count: 0, error_count: 0, accent_color: '#00f0ff' },
  { id: 'forge', name: 'FORGE', role: 'Code Generation', model: 'google/gemini-2.5-pro-exp-03-25:free', status: 'offline', last_heartbeat: '-', task_count: 0, error_count: 0, accent_color: '#ff6b35' },
  { id: 'lens', name: 'LENS', role: 'Review & QA', model: 'deepseek/deepseek-chat-v3-0324:free', status: 'offline', last_heartbeat: '-', task_count: 0, error_count: 0, accent_color: '#a78bfa' },
  { id: 'copywriter', name: 'COPYWRITER', role: 'Content Creation', model: 'qwen/qwen3-235b-a22b:free', status: 'offline', last_heartbeat: '-', task_count: 0, error_count: 0, accent_color: '#34d399' },
  { id: 'herald', name: 'HERALD', role: 'Outreach', model: 'nvidia/nemotron-4-340b-instruct:free', status: 'offline', last_heartbeat: '-', task_count: 0, error_count: 0, accent_color: '#fbbf24' },
  { id: 'ledger', name: 'LEDGER', role: 'Analytics', model: 'moonshotai/kimi-k2:free', status: 'offline', last_heartbeat: '-', task_count: 0, error_count: 0, accent_color: '#f472b6' },
];

export const STATUS_COLORS: Record<string, string> = {
  idle: '#34d399',
  busy: '#fbbf24',
  error: '#ff4d4d',
  offline: '#6e6e80',
};

export const STATUS_ANIMATIONS: Record<string, string> = {
  idle: 'animate-pulse-green',
  busy: 'animate-pulse-amber',
  error: 'animate-pulse-red',
  offline: 'animate-pulse-gray',
};

export const LEVEL_COLORS: Record<string, string> = {
  info: 'text-edge-primary',
  warn: 'text-edge-amber',
  error: 'text-edge-error',
};
