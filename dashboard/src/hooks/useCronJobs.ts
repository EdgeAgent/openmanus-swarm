import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { CronJob, CronJobRun } from '../types';

const API_BASE = 'http://localhost:8800';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

interface UseCronJobsReturn {
  jobs: CronJob[];
  runs: CronJobRun[];
  loading: boolean;
  error: string | null;
  createJob: (payload: Omit<CronJob, 'id' | 'created_at' | 'last_run' | 'next_run' | 'run_count'>) => Promise<void>;
  updateJob: (id: number, payload: Partial<CronJob>) => Promise<void>;
  deleteJob: (id: number) => Promise<void>;
  toggleJob: (id: number, isActive: boolean) => Promise<void>;
  triggerJob: (id: number) => Promise<void>;
  getRuns: (jobId: number) => Promise<void>;
}

const MOCK_JOBS: CronJob[] = [
  {
    id: 1,
    agent_id: 'prospector',
    name: 'Morning Prospecting',
    cron_expr: '0 9 * * *',
    task: 'Scan target market for new leads and compile a list of 20 prospects',
    is_active: true,
    last_run: new Date(Date.now() - 3600000).toISOString(),
    next_run: new Date(Date.now() + 82800000).toISOString(),
    run_count: 47,
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    agent_name: 'PROSPECTOR',
    agent_color: '#00f0ff',
  },
  {
    id: 2,
    agent_id: 'lens',
    name: 'Security Audit',
    cron_expr: '0 */6 * * *',
    task: 'Run security audit on all dependencies and check for vulnerabilities',
    is_active: true,
    last_run: new Date(Date.now() - 21600000).toISOString(),
    next_run: new Date(Date.now() + 21600000).toISOString(),
    run_count: 128,
    created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
    agent_name: 'LENS',
    agent_color: '#a78bfa',
  },
];

export function useCronJobs(): UseCronJobsReturn {
  const [jobs, setJobs] = useState<CronJob[]>(MOCK_JOBS);
  const [runs, setRuns] = useState<CronJobRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const { data } = await api.get<CronJob[]>('/cron-jobs');
      setJobs(data);
      setError(null);
    } catch {
      // keep mock data
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const createJob = useCallback(async (payload) => {
    try {
      await api.post('/cron-jobs', payload);
      await fetchJobs();
    } catch {
      const newJob: CronJob = {
        ...payload,
        id: Date.now(),
        last_run: null,
        next_run: null,
        run_count: 0,
        created_at: new Date().toISOString(),
      };
      setJobs((prev) => [...prev, newJob]);
    }
  }, [fetchJobs]);

  const updateJob = useCallback(async (id: number, payload: Partial<CronJob>) => {
    try {
      await api.put(`/cron-jobs/${id}`, payload);
      await fetchJobs();
    } catch {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...payload } : j)));
    }
  }, [fetchJobs]);

  const deleteJob = useCallback(async (id: number) => {
    try {
      await api.delete(`/cron-jobs/${id}`);
      await fetchJobs();
    } catch {
      setJobs((prev) => prev.filter((j) => j.id !== id));
    }
  }, [fetchJobs]);

  const toggleJob = useCallback(async (id: number, isActive: boolean) => {
    try {
      await api.post(`/cron-jobs/${id}/toggle`, { is_active: isActive });
      await fetchJobs();
    } catch {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, is_active: isActive } : j)));
    }
  }, [fetchJobs]);

  const triggerJob = useCallback(async (id: number) => {
    try {
      await api.post(`/cron-jobs/${id}/trigger`);
      await fetchJobs();
    } catch {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === id
            ? { ...j, last_run: new Date().toISOString(), run_count: j.run_count + 1 }
            : j
        )
      );
    }
  }, [fetchJobs]);

  const getRuns = useCallback(async (jobId: number) => {
    try {
      const { data } = await api.get<CronJobRun[]>(`/cron-jobs/${jobId}/runs`);
      setRuns(data);
    } catch {
      setRuns([]);
    }
  }, []);

  return { jobs, runs, loading, error, createJob, updateJob, deleteJob, toggleJob, triggerJob, getRuns };
}

export default useCronJobs;
