import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import type { LogEntry } from '../types';

const API_BASE = 'http://localhost:8800';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
});

const MOCK_LOGS: LogEntry[] = [
  { id: 1, agent_id: 'prospector', timestamp: new Date().toISOString(), level: 'info', message: 'Scanning for leads in target market...' },
  { id: 2, agent_id: 'forge', timestamp: new Date().toISOString(), level: 'info', message: 'Building React component scaffold...' },
  { id: 3, agent_id: 'lens', timestamp: new Date().toISOString(), level: 'info', message: 'Code review passed: 0 issues found' },
  { id: 4, agent_id: 'copywriter', timestamp: new Date().toISOString(), level: 'error', message: 'API rate limit exceeded, backing off...' },
  { id: 5, agent_id: 'ledger', timestamp: new Date().toISOString(), level: 'info', message: 'Aggregating task metrics...' },
  { id: 6, agent_id: 'forge', timestamp: new Date().toISOString(), level: 'warn', message: 'Deprecation warning: old API endpoint' },
  { id: 7, agent_id: 'prospector', timestamp: new Date().toISOString(), level: 'info', message: 'Discovered 23 new prospects' },
  { id: 8, agent_id: 'lens', timestamp: new Date().toISOString(), level: 'info', message: 'Running security audit on dependencies' },
];

function generateMockLogs(): LogEntry[] {
  return MOCK_LOGS.map((log, i) => ({
    ...log,
    id: Date.now() + i,
    timestamp: new Date(Date.now() - i * 2000).toISOString(),
  })).reverse();
}

export function useLogs(agentId?: string) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const mockModeRef = useRef(false);

  const fetchLogs = useCallback(async () => {
    try {
      const url = agentId ? `/agents/${agentId}/logs` : '/agents/prospector/logs';
      const { data } = await api.get<LogEntry[]>(url);
      if (mockModeRef.current) mockModeRef.current = false;
      setLogs(data);
    } catch {
      if (!mockModeRef.current) mockModeRef.current = true;
      setLogs(generateMockLogs());
    }
  }, [agentId]);

  useEffect(() => {
    let isMounted = true;

    const initialFetch = async () => {
      setLoading(true);
      await fetchLogs();
      if (isMounted) setLoading(false);
    };

    initialFetch();

    const interval = setInterval(() => {
      if (mockModeRef.current) {
        setLogs((prev) => {
          const newLog: LogEntry = {
            id: Date.now(),
            agent_id: ['prospector', 'forge', 'lens', 'copywriter', 'ledger'][Math.floor(Math.random() * 5)],
            timestamp: new Date().toISOString(),
            level: ['info', 'warn', 'error'][Math.floor(Math.random() * 3)] as LogEntry['level'],
            message: ['Processing task...', 'Heartbeat received', 'Task completed', 'Retrying connection'][Math.floor(Math.random() * 4)],
          };
          return [...prev.slice(-49), newLog];
        });
      } else {
        fetchLogs();
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchLogs]);

  return { logs, loading };
}

export default useLogs;
