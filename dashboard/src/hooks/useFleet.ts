import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import type { Agent, FleetMetrics } from '../types';
import { DEFAULT_AGENTS } from '../types';

const API_BASE = 'http://localhost:8800';

const DEFAULT_METRICS: FleetMetrics = {
  total_agents: 6,
  active: 0,
  busy: 0,
  errors: 0,
  total_tasks: 0,
};

const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
});

export interface UseFleetReturn {
  agents: Agent[];
  metrics: FleetMetrics;
  loading: boolean;
  error: string | null;
}

function getRandomStatus(): Agent['status'] {
  const statuses: Agent['status'][] = ['idle', 'busy', 'error', 'offline'];
  const weights = [0.3, 0.35, 0.1, 0.25];
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < statuses.length; i++) {
    cum += weights[i];
    if (r < cum) return statuses[i];
  }
  return 'offline';
}

function generateMockAgents(): Agent[] {
  return DEFAULT_AGENTS.map((agent) => ({
    ...agent,
    status: getRandomStatus(),
    last_heartbeat: new Date().toISOString(),
    task_count: Math.floor(Math.random() * 20),
    error_count: Math.floor(Math.random() * 3),
  }));
}

function generateMockMetrics(agents: Agent[]): FleetMetrics {
  return {
    total_agents: agents.length,
    active: agents.filter((a) => a.status === 'idle').length,
    busy: agents.filter((a) => a.status === 'busy').length,
    errors: agents.filter((a) => a.status === 'error').length,
    total_tasks: agents.reduce((sum, a) => sum + a.task_count, 0),
  };
}

export function useFleet(): UseFleetReturn {
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [metrics, setMetrics] = useState<FleetMetrics>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mockModeRef = useRef(false);

  const fetchAgents = useCallback(async () => {
    try {
      const { data } = await api.get<Agent[]>('/agents');
      if (mockModeRef.current) {
        mockModeRef.current = false;
        setError(null);
      }
      setAgents(data);
      return data;
    } catch {
      if (!mockModeRef.current) {
        mockModeRef.current = true;
        setError('Fleet API unreachable — mock mode active');
      }
      const mock = generateMockAgents();
      setAgents(mock);
      return mock;
    }
  }, []);

  const fetchMetrics = useCallback(async (currentAgents?: Agent[]) => {
    try {
      const { data } = await api.get<FleetMetrics>('/metrics');
      setMetrics(data);
    } catch {
      const agentsToUse = currentAgents || generateMockAgents();
      setMetrics(generateMockMetrics(agentsToUse));
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initialFetch = async () => {
      setLoading(true);
      const fetchedAgents = await fetchAgents();
      await fetchMetrics(fetchedAgents);
      if (isMounted) setLoading(false);
    };

    initialFetch();

    const agentsInterval = setInterval(() => {
      fetchAgents().then((fetchedAgents) => {
        if (mockModeRef.current && isMounted) {
          setMetrics(generateMockMetrics(fetchedAgents));
        }
      });
    }, 5000);

    const metricsInterval = setInterval(() => {
      fetchMetrics(agents);
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(agentsInterval);
      clearInterval(metricsInterval);
    };
  }, [fetchAgents, fetchMetrics, agents]);

  return { agents, metrics, loading, error };
}

export default useFleet;
