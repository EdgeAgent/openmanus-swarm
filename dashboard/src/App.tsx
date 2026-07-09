import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useFleet } from './hooks/useFleet';
import { useLogs } from './hooks/useLogs';
import Layout from './components/Layout';
import AgentGrid from './components/AgentGrid';
import TerminalFeed from './components/TerminalFeed';
import ControlPanel from './components/ControlPanel';
import AgentDetail from './components/AgentDetail';

function Dashboard() {
  const { agents, metrics, loading, error } = useFleet();
  const { logs } = useLogs();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-edge-cyan animate-pulse" />
          <p className="font-mono text-xs text-edge-secondary animate-pulse">INITIALIZING FLEET...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout agents={agents} metrics={metrics}>
      <div className="space-y-6">
        {error && (
          <div className="edge-card p-3 border-l-2 border-l-edge-error bg-edge-error/5">
            <p className="font-mono text-[11px] text-edge-error">{error}</p>
          </div>
        )}
        <AgentGrid agents={agents} />
        <TerminalFeed logs={logs} agents={agents} />
        <ControlPanel />
      </div>
    </Layout>
  );
}

function AgentDetailPage() {
  const { agents, metrics } = useFleet();
  const { logs } = useLogs();

  return (
    <Layout agents={agents} metrics={metrics}>
      <AgentDetail agents={agents} logs={logs} />
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agent/:id" element={<AgentDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}
