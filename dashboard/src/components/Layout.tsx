import { Link, useLocation } from 'react-router-dom';
import type { Agent, FleetMetrics } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  agents: Agent[];
  metrics: FleetMetrics;
}

export default function Layout({ children, agents, metrics }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-edge-bg text-edge-primary relative z-10">
      {/* Top bar */}
      <header className="border-b border-edge-border px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <Link to="/" className="font-mono text-sm font-semibold tracking-[2px] hover:opacity-80 transition-opacity">
            EDGE <span className="text-edge-cyan">SWARM</span> CONTROL
          </Link>
          <div className="flex items-center gap-6 font-mono text-[11px]">
            <div className="flex items-center gap-2">
              <span className="text-edge-secondary">AGENTS</span>
              <span className="font-semibold">{metrics.total_agents}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-edge-secondary">ACTIVE</span>
              <span className="font-semibold text-edge-green">{metrics.active}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-edge-secondary">BUSY</span>
              <span className="font-semibold text-edge-amber">{metrics.busy}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-edge-secondary">TASKS</span>
              <span className="font-semibold">{metrics.total_tasks}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="w-48 shrink-0">
          <div className="font-mono text-[10px] tracking-[1.5px] text-edge-secondary mb-3">
            AGENT LIST
          </div>
          <nav className="space-y-1">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                to={`/agent/${agent.id}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono transition-colors ${
                  location.pathname === `/agent/${agent.id}`
                    ? 'bg-edge-card border border-edge-border'
                    : 'hover:bg-edge-card/50'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: agent.accent_color,
                    boxShadow: `0 0 6px ${agent.accent_color}40`,
                  }}
                />
                <span className="truncate">{agent.name}</span>
                <span
                  className={`ml-auto w-1.5 h-1.5 rounded-full shrink-0 ${
                    agent.status === 'idle'
                      ? 'bg-edge-green'
                      : agent.status === 'busy'
                      ? 'bg-edge-amber'
                      : agent.status === 'error'
                      ? 'bg-edge-error'
                      : 'bg-edge-secondary'
                  }`}
                />
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
