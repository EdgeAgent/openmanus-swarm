import type { Agent } from '../types';
import AgentCard from './AgentCard';

interface AgentGridProps {
  agents: Agent[];
}

export default function AgentGrid({ agents }: AgentGridProps) {
  const onlineCount = agents.filter((a) => a.status !== 'offline').length;

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-edge-green rounded-sm" />
        <h2 className="font-mono text-[11px] tracking-[1.5px] text-edge-secondary">
          AGENT VMs — {onlineCount}/{agents.length} ONLINE
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </section>
  );
}
