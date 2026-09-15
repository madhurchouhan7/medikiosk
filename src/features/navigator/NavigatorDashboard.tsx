import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck, AlertTriangle, CheckCircle2, FileText,
  Edit3, Search, RefreshCw, Check, ShieldCheck, ShieldAlert,
  AlertOctagon, X, Loader2, Clock, User, ChevronRight,
  ExternalLink, Activity
} from 'lucide-react';
import type { AssistanceTask, ExtractedEntity } from '../../types';
import { ApiService } from '../../services/api';

// ─── Toast ─────────────────────────────────────────────────────────────────────
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium pointer-events-auto max-w-sm
          ${t.type === 'success' ? 'bg-emerald-600 text-white' :
            t.type === 'error' ? 'bg-red-600 text-white' :
            t.type === 'warning' ? 'bg-amber-500 text-slate-900' :
            'bg-slate-700 text-white'}`}>
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {t.type === 'error' && <X className="w-4 h-4 shrink-0" />}
          {t.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
          {t.type === 'info' && <Activity className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="opacity-60 hover:opacity-100 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Priority badge ─────────────────────────────────────────────────────────────
const PriorityBadge = ({ priority }: { priority: string }) => {
  const classes =
    priority === 'URGENT' ? 'bg-red-500/15 text-red-400 border-red-500/20 animate-pulse' :
    priority === 'HIGH' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' :
    'bg-slate-700 text-slate-300 border-slate-600';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${classes}`}>
      {priority}
    </span>
  );
};

// ─── Category badge ─────────────────────────────────────────────────────────────
const CategoryBadge = ({ cat }: { cat: string }) => {
  const label = cat.replace(/_/g, ' ');
  const classes =
    cat === 'RULE_BASED_SAFETY_FLAG' ? 'bg-red-500/10 text-red-400' :
    cat === 'LOW_OCR_CONFIDENCE' ? 'bg-purple-500/10 text-purple-400' :
    cat === 'LOW_SPEECH_CONFIDENCE' ? 'bg-blue-500/10 text-blue-400' :
    'bg-slate-700 text-slate-400';
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${classes}`}>{label}</span>
  );
};

// ─── NavigatorDashboard ─────────────────────────────────────────────────────────
export const NavigatorDashboard: React.FC = () => {
  const [activeTier, setActiveTier] = useState<'ALL' | 'TIER_1_OPD_FLOOR' | 'TIER_2_REMOTE_HUB'>('ALL');
  const [tasks, setTasks] = useState<AssistanceTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AssistanceTask | null>(null);
  const [editableEntities, setEditableEntities] = useState<ExtractedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [resolvedCount, setResolvedCount] = useState(0);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = `t-${Date.now()}`;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const tier = activeTier === 'ALL' ? undefined : activeTier;
      const data = await ApiService.getAssistanceTasks(tier);
      const filtered = data.filter(t => t.status !== 'RESOLVED');
      setTasks(filtered);
      if (filtered.length > 0 && !selectedTask) {
        setSelectedTask(filtered[0]);
        setEditableEntities([...filtered[0].entities]);
      }
    } catch {
      addToast('error', 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [activeTier, selectedTask, addToast]);

  useEffect(() => {
    loadTasks();
    // Poll every 30s for new tasks
    const interval = setInterval(loadTasks, 30000);
    return () => clearInterval(interval);
  }, [activeTier]);

  const handleSelectTask = (task: AssistanceTask) => {
    setSelectedTask(task);
    setEditableEntities([...task.entities]);
  };

  const handleEntityChange = (id: string, field: keyof ExtractedEntity, val: string) => {
    setEditableEntities(prev => prev.map(e => e.id === id ? { ...e, [field]: val } : e));
  };

  const handleResolveTask = async () => {
    if (!selectedTask) return;
    setResolving(true);
    try {
      const corrections = editableEntities.map(e => ({
        entity_id: e.id,
        corrected_name: e.entity_name,
        corrected_dosage: e.dosage,
        corrected_frequency: e.frequency,
        verified: true,
      }));
      await ApiService.verifyTask(selectedTask.id, corrections, 'Staff Navigator');
      setResolvedCount(c => c + 1);
      addToast('success', `Task resolved — ${selectedTask.patient_name}'s record updated with HUMAN_VERIFIED provenance`);
      setSelectedTask(null);
      setEditableEntities([]);
      await loadTasks();
    } catch {
      addToast('error', 'Failed to resolve task. Please try again.');
    } finally {
      setResolving(false);
    }
  };

  const handleEscalateTask = async () => {
    if (!selectedTask) return;
    try {
      await ApiService.escalateTask(selectedTask.id, 'Escalated to attending physician by Navigator');
      addToast('warning', 'Task escalated to URGENT priority');
      await loadTasks();
    } catch {
      addToast('error', 'Escalation failed');
    }
  };

  const filteredTasks = tasks.filter(t =>
    !searchQuery ||
    t.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.exception_category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0f1117] text-white font-sans">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(p => p.filter(t => t.id !== id))} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-[#151820] border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Navigator Workbench</h1>
            <p className="text-[10px] text-slate-500">Exception Resolution · Human-in-the-Loop</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {resolvedCount > 0 && (
            <span className="text-[11px] text-emerald-400 font-medium">{resolvedCount} resolved today</span>
          )}
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${
            filteredTasks.filter(t => t.status === 'PENDING').length > 0
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}>
            {filteredTasks.filter(t => t.status === 'PENDING').length} pending
          </span>
          <button
            onClick={loadTasks}
            disabled={isLoading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">

        {/* ── Left: Task Queue ─────────────────────────────────────────────── */}
        <aside className="w-80 shrink-0 border-r border-white/5 flex flex-col bg-[#151820]">
          {/* Tier filter */}
          <div className="p-4 border-b border-white/5 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search patients..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40"
              />
            </div>

            <div className="flex gap-1.5">
              {(['ALL', 'TIER_1_OPD_FLOOR', 'TIER_2_REMOTE_HUB'] as const).map(tier => (
                <button
                  key={tier}
                  onClick={() => setActiveTier(tier)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    activeTier === tier
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-white/5 text-slate-500 hover:bg-white/10'
                  }`}
                >
                  {tier === 'ALL' ? 'All' : tier === 'TIER_1_OPD_FLOOR' ? 'Tier 1' : 'Tier 2'}
                </button>
              ))}
            </div>
          </div>

          {/* Scope banner */}
          <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <p className="text-[10px] text-slate-500 leading-tight">
              {activeTier === 'TIER_2_REMOTE_HUB'
                ? 'Scope: OCR/prescription verification only — no clinical decisions'
                : 'Scope: Touchscreen & language support, document positioning — non-clinical'}
            </p>
          </div>

          {/* Tasks */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-white/3 animate-pulse" />
              ))
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-white">All clear!</p>
                <p className="text-xs text-slate-500">No pending exceptions</p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => handleSelectTask(task)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    selectedTask?.id === task.id
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-white/3 border-white/5 hover:bg-white/6 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-white text-sm">{task.patient_name}</span>
                    <PriorityBadge priority={task.priority} />
                  </div>
                  <CategoryBadge cat={task.exception_category} />
                  <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2">{task.reason}</p>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-600">
                    <span>{task.failed_step.replace(/_/g, ' ')}</span>
                    <span className={`font-bold ${
                      task.assistance_score < 0.5 ? 'text-red-400' :
                      task.assistance_score < 0.7 ? 'text-amber-400' : 'text-slate-400'
                    }`}>{Math.round(task.assistance_score * 100)}%</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── Right: Workbench ────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6">
          {!selectedTask ? (
            <div className="h-full flex items-center justify-center text-slate-600 text-sm">
              <div className="text-center space-y-2">
                <UserCheck className="w-10 h-10 mx-auto opacity-30" />
                <p>Select a task to begin verification</p>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl space-y-6">

              {/* Task header */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-white">{selectedTask.patient_name}</h2>
                    <PriorityBadge priority={selectedTask.priority} />
                    <CategoryBadge cat={selectedTask.exception_category} />
                  </div>
                  <p className="text-sm text-slate-400">{selectedTask.reason}</p>
                  <p className="text-[11px] text-slate-600">
                    Session: <span className="font-mono text-slate-500">{selectedTask.session_id}</span> ·
                    Failed at: <span className="text-slate-400">{selectedTask.failed_step.replace(/_/g, ' ')}</span>
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedTask(null); setEditableEntities([]); }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Emergency banner */}
              {selectedTask.exception_category === 'RULE_BASED_SAFETY_FLAG' && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                  <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-400">Clinical Emergency — Immediate Action Required</p>
                    <p className="text-sm text-slate-400 mt-1">This is a clinical safety flag. Go to the patient at Kiosk immediately. Do not attempt remote resolution for emergency symptoms.</p>
                  </div>
                </div>
              )}

              {/* Workbench grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left: Source document */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-teal-400" />
                    Source Document
                  </h3>

                  <div className="p-4 rounded-xl bg-[#151820] border border-white/5 space-y-3">
                    <div className="aspect-video bg-[#0f1117] rounded-lg border border-dashed border-amber-500/20 flex flex-col items-center justify-center gap-2 text-center p-4">
                      <FileText className="w-8 h-8 text-amber-500/40" />
                      <p className="text-[11px] text-slate-600 font-mono">
                        {selectedTask.entities[0]?.source_ref || 'No source document attached'}
                      </p>
                      {selectedTask.entities[0]?.confidence && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          OCR Confidence: {Math.round(selectedTask.entities[0].confidence * 100)}%
                        </span>
                      )}
                    </div>

                    {selectedTask.entities.length > 0 && (