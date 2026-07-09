import { useNavigate } from 'react-router-dom';
import type { Agent } from '../types';

interface AgentCardProps {
  agent: Agent;
}

export default function AgentCard({ agent }: AgentCardProps) {
  const navigate = useNavigate();

  const statusColor =
    agent.status === 'idle'
      ? 'bg-edge-green'
      : agent.status === 'busy'
      ? 'bg-edge-amber'
      : agent.status === 'error'
      ? 'bg-edge-error'
      : 'bg-edge-secondary';

  const statusGlow =
    agent.status === 'idle'
      ? 'shadow-[0_0_8px_rgba(52,211,153,0.5)]'
      : agent.status === 'busy'
      ? 'shadow-[0_0_8px_rgba(251,191,36,0.5)]'
      : agent.status === 'error'
      ? 'shadow-[0_0_8px_rgba(255,77,77,0.5)]'
      : '';

  return (
    <div
      className="edge-card p-5 cursor-pointer transition-all hover:border-white/10 hover:-translate-y-0.5 relative overflow-hidden"
      onClick={() => navigate(`/agent/${agent.id}`)}
      style={{ borderLeft: `3px solid ${agent.accent_color}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[13px] font-semibold" style={{ color: agent.accent_color }}>
          {agent.name}
        </span>
        <span className={`w-2 h-2 rounded-full relative ${statusColor} ${statusGlow}`}>
          {agent.status !== 'offline' && (
            <span
              className="absolute inset-[-3px] rounded-full border border-current animate-pulse-dot"
              style={{ color: agent.accent_color }}
            />
          )}
        </span>
      </div>

      <div className="text-[11px] text-edge-secondary mb-1">{agent.role}</div>
      <div className="font-mono text-[10px] text-edge-secondary/60 mb-4 truncate">
        {agent.model.split('/').pop()}
      </div>

      <div className="flex gap-4 font-mono text-[10px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-edge-secondary">TASKS</span>
          <span className="font-semibold">{agent.task_count}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-edge-secondary">STATUS</span>
          <span
            className={`font-semibold ${
              agent.status === 'idle'
                ? 'text-edge-green'
                : agent.status === 'busy'
                ? 'text-edge-amber'
                : agent.status === 'error'
                ? 'text-edge-error'
                : 'text-edge-secondary'
            }`}
          >
            {agent.status.toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-edge-secondary">HEARTBEAT</span>
          <span className="font-semibold">
            {agent.last_heartbeat === '-' ? '-' : `${Math.floor(Math.random() * 10)}s ago`}
          </span>
        </div>
      </div>
    </div>
  );
}
