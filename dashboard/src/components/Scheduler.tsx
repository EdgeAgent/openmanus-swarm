import { useState, useCallback } from 'react';
import type { Agent, CronJob, CronJobRun } from '../types';
import { useCronJobs } from '../hooks/useCronJobs';

interface SchedulerProps {
  agents: Agent[];
}

interface JobFormData {
  agent_id: string;
  name: string;
  cron_expr: string;
  task: string;
}

const EMPTY_FORM: JobFormData = {
  agent_id: '',
  name: '',
  cron_expr: '',
  task: '',
};

function formatTime(ts: string | null): string {
  if (!ts) return '\u2014';
  try {
    const d = new Date(ts);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function CronJobCard({
  job,
  agents,
  onToggle,
  onTrigger,
  onEdit,
  onDelete,
}: {
  job: CronJob;
  agents: Agent[];
  onToggle: (id: number, isActive: boolean) => void;
  onTrigger: (id: number) => void;
  onEdit: (job: CronJob) => void;
  onDelete: (id: number) => void;
}) {
  const agent = agents.find((a) => a.id === job.agent_id);
  const agentName = job.agent_name || agent?.name || job.agent_id;
  const agentColor = job.agent_color || agent?.accent_color || '#6e6e80';

  return (
    <div className="edge-card p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-mono text-xs font-bold text-edge-primary truncate">
              {job.name}
            </h4>
            <span
              className={`font-mono text-[9px] px-1.5 py-0.5 rounded ${
                job.is_active
                  ? 'bg-edge-green/10 text-edge-green'
                  : 'bg-edge-secondary/10 text-edge-secondary'
              }`}
            >
              {job.is_active ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: agentColor }}
            />
            <span
              className="font-mono text-[10px] truncate"
              style={{ color: agentColor }}
            >
              {agentName}
            </span>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => onToggle(job.id, !job.is_active)}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            job.is_active ? 'bg-edge-green/30' : 'bg-edge-border'
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${
              job.is_active
                ? 'translate-x-4.5 bg-edge-green'
                : 'translate-x-0.5 bg-edge-secondary'
            }`}
            style={{
              transform: job.is_active ? 'translateX(18px)' : 'translateX(2px)',
            }}
          />
        </button>
      </div>

      {/* Cron Expression */}
      <div className="mb-3">
        <p className="font-mono text-[10px] text-edge-secondary mb-0.5">SCHEDULE</p>
        <p className="font-mono text-xs text-edge-amber font-bold">{job.cron_expr}</p>
      </div>

      {/* Task */}
      <div className="mb-3">
        <p className="font-mono text-[10px] text-edge-secondary mb-0.5">TASK</p>
        <p className="font-mono text-[11px] text-edge-primary line-clamp-2 leading-relaxed">
          {job.task}
        </p>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 mb-4 py-2 border-t border-b border-edge-border">
        <div>
          <p className="font-mono text-[9px] text-edge-secondary">RUNS</p>
          <p className="font-mono text-xs font-bold text-edge-primary">{job.run_count}</p>
        </div>
        <div>
          <p className="font-mono text-[9px] text-edge-secondary">LAST RUN</p>
          <p className="font-mono text-[10px] text-edge-primary">{formatTime(job.last_run)}</p>
        </div>
        <div>
          <p className="font-mono text-[9px] text-edge-secondary">NEXT RUN</p>
          <p className="font-mono text-[10px] text-edge-primary">
            {job.is_active ? formatTime(job.next_run) : '\u2014'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onTrigger(job.id)}
          className="btn-glow flex-1 font-mono text-[10px] px-3 py-2 rounded border border-edge-cyan/40 text-edge-cyan bg-edge-cyan/5 hover:bg-edge-cyan/15 flex items-center justify-center gap-1.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-edge-cyan" />
          TRIGGER
        </button>
        <button
          onClick={() => onEdit(job)}
          className="btn-glow font-mono text-[10px] px-3 py-2 rounded border border-edge-border text-edge-secondary hover:text-edge-primary hover:bg-edge-border/30 flex items-center gap-1.5"
        >
          EDIT
        </button>
        <button
          onClick={() => onDelete(job.id)}
          className="btn-glow font-mono text-[10px] px-3 py-2 rounded border border-edge-error/30 text-edge-error/70 hover:text-edge-error hover:bg-edge-error/10 flex items-center gap-1.5"
        >
          DEL
        </button>
      </div>
    </div>
  );
}

function JobModal({
  isOpen,
  isEdit,
  formData,
  agents,
  onChange,
  onSave,
  onCancel,
  loading,
}: {
  isOpen: boolean;
  isEdit: boolean;
  formData: JobFormData;
  agents: Agent[];
  onChange: (data: JobFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="edge-card w-full max-w-md mx-4 overflow-hidden animate-fade-in">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-edge-border flex items-center justify-between">
          <h3 className="font-mono text-xs font-bold text-edge-primary tracking-wide">
            {isEdit ? 'EDIT JOB' : 'NEW JOB'}
          </h3>
          <button
            onClick={onCancel}
            className="font-mono text-[10px] text-edge-secondary hover:text-edge-primary transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Agent Select */}
          <div>
            <label className="block font-mono text-[10px] text-edge-secondary mb-1.5 uppercase">
              Agent
            </label>
            <select
              value={formData.agent_id}
              onChange={(e) => onChange({ ...formData, agent_id: e.target.value })}
              className="w-full bg-edge-terminal border border-edge-border rounded px-3 py-2.5 font-mono text-xs text-edge-primary focus:outline-none focus:border-edge-cyan transition-colors appearance-none cursor-pointer"
            >
              <option value="">Select agent...</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} — {agent.role}
                </option>
              ))}
            </select>
          </div>

          {/* Job Name */}
          <div>
            <label className="block font-mono text-[10px] text-edge-secondary mb-1.5 uppercase">
              Job Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => onChange({ ...formData, name: e.target.value })}
              placeholder="e.g. Daily Report"
              className="w-full bg-edge-terminal border border-edge-border rounded px-3 py-2.5 font-mono text-xs text-edge-primary placeholder:text-edge-secondary/50 focus:outline-none focus:border-edge-cyan transition-colors"
            />
          </div>

          {/* Cron Expression */}
          <div>
            <label className="block font-mono text-[10px] text-edge-secondary mb-1.5 uppercase">
              Cron Expression
            </label>
            <input
              type="text"
              value={formData.cron_expr}
              onChange={(e) => onChange({ ...formData, cron_expr: e.target.value })}
              placeholder="*/5 * * * *"
              className="w-full bg-edge-terminal border border-edge-border rounded px-3 py-2.5 font-mono text-xs text-edge-amber placeholder:text-edge-secondary/50 focus:outline-none focus:border-edge-cyan transition-colors"
            />
            <p className="font-mono text-[9px] text-edge-secondary mt-1.5 leading-relaxed">
              e.g. */5 * * * * (every 5 min), 0 9 * * * (daily 9am)
            </p>
          </div>

          {/* Task Description */}
          <div>
            <label className="block font-mono text-[10px] text-edge-secondary mb-1.5 uppercase">
              Task Description
            </label>
            <textarea
              value={formData.task}
              onChange={(e) => onChange({ ...formData, task: e.target.value })}
              placeholder="Describe the task..."
              rows={3}
              className="w-full bg-edge-terminal border border-edge-border rounded px-3 py-2.5 font-mono text-xs text-edge-primary placeholder:text-edge-secondary/50 focus:outline-none focus:border-edge-cyan transition-colors resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-edge-border flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="font-mono text-[11px] px-4 py-2 rounded border border-edge-border text-edge-secondary hover:text-edge-primary hover:bg-edge-border/30 transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={onSave}
            disabled={
              loading ||
              !formData.agent_id ||
              !formData.name.trim() ||
              !formData.cron_expr.trim() ||
              !formData.task.trim()
            }
            className="btn-glow font-mono text-[11px] px-5 py-2 rounded border border-edge-cyan/40 text-edge-cyan bg-edge-cyan/5 hover:bg-edge-cyan/15 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-edge-cyan" />
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Scheduler({ agents }: SchedulerProps) {
  const { jobs, loading, createJob, updateJob, deleteJob, toggleJob, triggerJob } = useCronJobs();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [formData, setFormData] = useState<JobFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openNewModal = useCallback(() => {
    setEditingJob(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((job: CronJob) => {
    setEditingJob(job);
    setFormData({
      agent_id: job.agent_id,
      name: job.name,
      cron_expr: job.cron_expr,
      task: job.task,
    });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingJob(null);
    setFormData(EMPTY_FORM);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (editingJob) {
        await updateJob(editingJob.id, formData);
      } else {
        await createJob(formData);
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  }, [editingJob, formData, updateJob, createJob, closeModal]);

  const handleDelete = useCallback(
    async (id: number) => {
      if (window.confirm('Delete this job?')) {
        await deleteJob(id);
      }
    },
    [deleteJob]
  );

  const activeCount = jobs.filter((j) => j.is_active).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-mono text-sm font-bold text-edge-primary tracking-wide">
            TASK SCHEDULER
          </h2>
          <span className="font-mono text-[10px] text-edge-secondary">
            {jobs.length} JOBS / {activeCount} ACTIVE
          </span>
        </div>
        <button
          onClick={openNewModal}
          className="btn-glow font-mono text-xs px-5 py-2.5 rounded border border-edge-cyan/40 text-edge-cyan bg-edge-cyan/5 hover:bg-edge-cyan/15 flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-edge-cyan" />
          NEW JOB
        </button>
      </div>

      {/* Loading State */}
      {loading && jobs.length === 0 && (
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-edge-amber animate-pulse" />
            <p className="font-mono text-xs text-edge-secondary animate-pulse">
              LOADING JOBS...
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && jobs.length === 0 && (
        <div className="edge-card p-12 flex items-center justify-center">
          <div className="text-center">
            <p className="font-mono text-xs text-edge-secondary">
              No scheduled jobs
            </p>
            <p className="font-mono text-[10px] text-edge-secondary/50 mt-1">
              Click NEW JOB to create your first scheduled task
            </p>
          </div>
        </div>
      )}

      {/* Jobs Grid */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <CronJobCard
              key={job.id}
              job={job}
              agents={agents}
              onToggle={toggleJob}
              onTrigger={triggerJob}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <JobModal
        isOpen={modalOpen}
        isEdit={!!editingJob}
        formData={formData}
        agents={agents}
        onChange={setFormData}
        onSave={handleSave}
        onCancel={closeModal}
        loading={saving}
      />
    </div>
  );
}
