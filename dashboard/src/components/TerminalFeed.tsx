import { useRef, useEffect } from 'react';
import type { LogEntry, Agent } from '../types';

interface TerminalFeedProps {
  logs: LogEntry[];
  agents: Agent[];
}

export default function TerminalFeed({ logs, agents }: TerminalFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getAgentColor = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.accent_color || '#6e6e80';
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '--:--:--';
    }
  };

  return (
    <section className="bg-edge-terminal border border-edge-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge-border">
        <span className="font-mono text-[10px] tracking-[1.5px] text-edge-secondary">
          LIVE FEED
        </span>
        <span className="font-mono text-[10px] text-edge-green">● CONNECTED</span>
      </div>
      <div
        ref={scrollRef}
        className="px-4 py-3 max-h-[280px] overflow-y-auto font-mono text-[11px] leading-[1.8]"
      >
        {logs.length === 0 ? (
          <div className="text-edge-secondary/50 text-center py-8">No logs yet...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-3">
              <span className="text-edge-secondary/50 min-w-[60px] shrink-0">
                {formatTime(log.timestamp)}
              </span>
              <span
                className="min-w-[70px] shrink-0 font-semibold"
                style={{ color: getAgentColor(log.agent_id) }}
              >
                {log.agent_id.toUpperCase()}
              </span>
              <span
                className={
                  log.level === 'warn'
                    ? 'text-edge-amber'
                    : log.level === 'error'
                    ? 'text-edge-error'
                    : 'text-edge-primary'
                }
              >
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
