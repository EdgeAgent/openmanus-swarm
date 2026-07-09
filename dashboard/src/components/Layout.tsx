import { Link, useLocation } from 'react-router-dom';
import type { Agent, FleetMetrics } from '../types';
import { STATUS_COLORS } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  agents: Agent[];
  metrics: FleetMetrics;
}

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6e6e80';
  return (
    <span
      className="w-2 h-2 rounded-full inline-block flex-shrink-0"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 6px ${color}80`,
      }}
    />
  );
}

export default function Layout({ children, agents, metrics }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-edge-bg grid-bg flex">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 border-r border-edge-border bg-edge-bg/80 backdrop-blur-sm flex flex-col">
        {/* Title */}
        <div className="px-5 py-5 border-b border-edge-border">
          <h1 className="font-mono text-sm font-bold tracking-wider text-edge-cyan text-glow-cyan">
            EDGE SWARM
          </h1>
          <p className="font-mono text-[10px] text-edge-secondary mt-1 tracking-widest">
            CONTROL PANEL v2.0
          </p>
        </div>

        {/* Agent List */}
        <nav className="flex-1 overflow-y-auto py-3">
          <p className="px-5 py-2 font-mono text-[10px] text-edge-secondary uppercase tracking-widest">
            Fleet ({agents.filter((a) => a.status !== 'offline').length}/{agents.length} online)
          </p>
          {agents.map((agent) => (
            <Link
              key={agent.id}
              to={`/agent/${agent.id}`}
              className={`flex items-center gap-3 px-5 py-2.5 transition-colors duration-150 ${
                location.pathname === `/agent/${agent.id}`
                  ? 'bg-edge-border/60 border-l-2'
                  : 'hover:bg-edge-border/30 border-l-2 border-transparent'
              }`}
              style={
                location.pathname === `/agent/${agent.id}`
                  ? { borderLeftColor: agent.accent_color }
                  : undefined
              }
            >
              <StatusDot status={agent.status} />
              <div className="min-w-0">
                <p
                  className="font-mono text-xs font-semibold truncate"
                  style={{ color: agent.accent_color }}
                >
                  {agent.name}
                </p>
                <p className="font-mono text-[10px] text-edge-secondary truncate">{agent.role}</p>
              </div>
            </Link>
          ))}
        </nav>

        {/* Navigation Links */}
        <div className="px-5 py-3 border-t border-edge-border">
          <p className="px-5 py-2 font-mono text-[10px] text-edge-secondary uppercase tracking-widest">
            Tools
          </p>
          <nav className="space-y-1">
            <Link
              to="/chat"
              className={`flex items-center gap-3 px-5 py-2.5 font-mono text-xs transition-colors ${
                location.pathname === '/chat'
                  ? 'bg-edge-border/60 text-edge-cyan'
                  : 'text-edge-secondary hover:text-edge-primary hover:bg-edge-border/30'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-edge-cyan" />
              CHAT
            </Link>
            <Link
              to="/scheduler"
              className={`flex items-center gap-3 px-5 py-2.5 font-mono text-xs transition-colors ${
                location.pathname === '/scheduler'
                  ? 'bg-edge-border/60 text-edge-amber'
                  : 'text-edge-secondary hover:text-edge-primary hover:bg-edge-border/30'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-edge-amber" />
              SCHEDULER
            </Link>
          </nav>
        </div>

        {/* Footer metrics */}
        <div className="px-5 py-4 border-t border-edge-border">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="font-mono text-xs font-bold text-edge-green">{metrics.active}</p>
              <p className="font-mono text-[9px] text-edge-secondary uppercase">Idle</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-xs font-bold text-edge-amber">{metrics.busy}</p>
              <p className="font-mono text-[9px] text-edge-secondary uppercase">Busy</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-xs font-bold text-edge-error">{metrics.errors}</p>
              <p className="font-mono text-[9px] text-edge-secondary uppercase">Errors</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-xs font-bold text-edge-primary">{metrics.total_tasks}</p>
              <p className="font-mono text-[9px] text-edge-secondary uppercase">Tasks</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-edge-border bg-edge-bg/80 backdrop-blur-sm flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-mono text-xs font-bold text-edge-primary hover:text-edge-cyan transition-colors">
              DASHBOARD
            </Link>
            <span className="text-edge-border">|</span>
            <Link to="/chat" className="font-mono text-xs font-bold text-edge-primary hover:text-edge-cyan transition-colors">
              CHAT
            </Link>
            <span className="text-edge-border">|</span>
            <Link to="/scheduler" className="font-mono text-xs font-bold text-edge-primary hover:text-edge-cyan transition-colors">
              SCHEDULER
            </Link>
            <span className="text-edge-border">|</span>
            <span className="font-mono text-[10px] text-edge-secondary">
              {metrics.total_agents} AGENTS
            </span>
            <span className="text-edge-border">|</span>
            <span className="font-mono text-[10px] text-edge-secondary">
              {metrics.total_tasks} TASKS
            </span>
          </div>
          <div className="flex items-center gap-3">
            {metrics.errors > 0 && (
              <span className="font-mono text-[10px] text-edge-error bg-edge-error/10 px-2 py-1 rounded">
                {metrics.errors} ERROR{metrics.errors > 1 ? 'S' : ''}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-edge-green animate-pulse-green" />
              <span className="font-mono text-[10px] text-edge-secondary">LIVE</span>
            </span>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
