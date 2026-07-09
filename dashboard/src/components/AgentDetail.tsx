import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { Agent, LogEntry } from '../types';

interface AgentDetailProps {
  agents: Agent[];
  logs: LogEntry[];
}

export default function AgentDetail({ agents, logs }: AgentDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [taskInput, setTaskInput] = useState('');

  const agent = agents.find((a) => a.id === id);
  const agentLogs = logs.filter((l) => l.agent_id === id);

  if (!agent) {
    return (
      <div className="edge-card p-8 text-center">
        <p className="text-edge-secondary font-mono text-sm">Agent not found</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 font-mono text-[11px] text-edge-cyan hover:underline"
        >
          ← BACK TO DASHBOARD
        </button>
      </div>
    );
  }

  const statusColor =
    agent.status === 'idle'
      ? 'text-edge-green'
      : agent.status === 'busy'
      ? 'text-edge-amber'
      : agent.status === 'error'
      ? 'text-edge-error'
      : 'text-edge-secondary';

  const handleSubmitTask = () => {
    if (!taskInput.trim()) return;
    console.log(`Submitting task to ${agent.id}: ${taskInput}`);
    setTaskInput('');
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="font-mono text-[11px] text-edge-cyan hover:underline"
      >
        ← BACK TO DASHBOARD
      </button>

      {/* Hero card */}
      <div
        className="edge-card p-6"
        style={{ borderLeft: `4px solid ${agent.accent_color}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-mono text-xl font-semibold" style={{ color: agent.accent_color }}>
              {agent.name}
            </h1>
            <p className="text-edge-secondary text-sm mt-1">{agent.role}</p>
          </div>
          <div className={`font-mono text-sm font-semibold ${statusColor}`}>
            {agent.status.toUpperCase()}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-[11px]">
          <div>
            <span className="text-edge-secondary block mb-1">MODEL</span>
            <span className="text-edge-primary">{agent.model.split('/').pop()}</span>
          </div>
          <div>
            <span className="text-edge-secondary block mb-1">TASKS</span>
            <span className="text-edge-primary">{agent.task_count}</span>
          </div>
          <div>
            <span className="text-edge-secondary block mb-1">ERRORS</span>
            <span className="text-edge-primary">{agent.error_count}</span>
          </div>
          <div>
            <span className="text-edge-secondary block mb-1">LAST HEARTBEAT</span>
            <span className="text-edge-primary">{agent.last_heartbeat}</span>
          </div>
        </div>
      </div>

      {/* Task submission */}
      <div className="edge-card p-5">
        <h3 className="font-mono text-[11px] tracking-[1.5px] text-edge-secondary mb-3">
          SUBMIT TASK
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitTask()}
            placeholder="Enter task description..."
            className="flex-1 bg-edge-terminal border border-edge-border rounded-md px-4 py-2.5 font-mono text-[12px] text-edge-primary placeholder:text-edge-secondary/40 focus:outline-none focus:border-edge-cyan transition-colors"
          />
          <button
            onClick={handleSubmitTask}
            className="font-mono text-[11px] tracking-[1px] px-5 py-2.5 rounded-md border border-edge-cyan bg-edge-cyan/10 text-edge-cyan hover:bg-edge-cyan/20 transition-all cursor-pointer"
          >
            SEND
          </button>
        </div>
      </div>

      {/* Recent logs */}
      <div className="edge-card p-5">
        <h3 className="font-mono text-[11px] tracking-[1.5px] text-edge-secondary mb-3">
          RECENT LOGS — {agent.name}
        </h3>
        <div className="font-mono text-[11px] leading-[1.8] max-h-[300px] overflow-y-auto space-y-1">
          {agentLogs.length === 0 ? (
            <div className="text-edge-secondary/50 text-center py-4">No logs for this agent</div>
          ) : (
            agentLogs.map((log) => (
              <div key={log.id} className="flex gap-3">
                <span className="text-edge-secondary/50 min-w-[60px]">
                  {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
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
      </div>
    </div>
  );
}
