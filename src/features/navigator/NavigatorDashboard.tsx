import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCheck, AlertTriangle, CheckCircle2, FileText,
  Edit3, Search, RefreshCw, Check, ShieldCheck,
  AlertOctagon, X, Loader2, User, Activity
} from 'lucide-react';
import type { AssistanceTask, ExtractedEntity } from '../../types';
import { ApiService, ApiError } from '../../services/api';
import { enqueueOp, newIdempotencyKey, useOnlineStatus } from '../../services/offline';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-raised border text-sm bg-white max-w-sm
          ${t.type === 'success' ? 'border-slate-200 border-l-4 border-l-emerald-600' :
            t.type === 'error' ? 'border-slate-200 border-l-4 border-l-red-600' :
            t.type === 'warning' ? 'border-slate-200 border-l-4 border-l-amber-500' :
            'border-slate-200 border-l-4 border-l-teal-700'}`}>
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />}
          {t.type === 'error' && <X className="w-4 h-4 text-red-700 shrink-0" />}
          {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
          {t.type === 'info' && <Activity className="w-4 h-4 text-teal-700 shrink-0" />}
          <span className="flex-1 text-slate-800">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="text-slate-400 hover:text-slate-700" aria-label="Dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

const PriorityBadge = ({ priority }: { priority: string }) => {
  const classes =
    priority === 'URGENT' ? 'bg-red-50 text-red-800 border-red-200' :
    priority === 'HIGH' ? 'bg-amber-50 text-amber-800 border-amber-200' :
    'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${classes}`}>
      {priority.toLowerCase()}
    </span>
  );
};

const CategoryBadge = ({ cat }: { cat: string }) => (
  <span className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">
    {cat.replace(/_/g, ' ').toLowerCase()}
  </span>
);

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
      setLoadError(null);
      if (filtered.length > 0 && !selectedTask) {
        setSelectedTask(filtered[0]);
        setEditableEntities([...filtered[0].entities]);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Tasks could not be loaded.';
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTier, addToast]);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 30000);
    return () => clearInterval(interval);
  }, [activeTier, loadTasks]);

  const handleSelectTask = (task: AssistanceTask) => {
    setSelectedTask(task);
    setEditableEntities([...task.entities]);
  };

  const handleEntityChange = (id: string, field: keyof ExtractedEntity, val: string) => {
    setEditableEntities(prev => prev.map(e => e.id === id ? { ...e, [field]: val } : e));
  };

  const handleAddEntity = () => {
    if (!selectedTask) return;
    const fresh: ExtractedEntity = {
      id: `new-${Date.now()}`,
      session_id: selectedTask.session_id,
      category: 'MEDICATION',
      entity_name: '',
      dosage: '',
      frequency: '',
      confidence: 1.0,
      provenance: 'AI_EXTRACTED',
      source_ref: `manual-transcription:${selectedTask.id}`,
      verified: false,
    };
    setEditableEntities(prev => [...prev, fresh]);
  };

  const handleResolveTask = async () => {
    if (!selectedTask) return;
    const named = editableEntities.filter(e => e.entity_name.trim());
    if (editableEntities.length > 0 && named.length === 0) {
      addToast('warning', 'Enter at least a medicine name, or escalate if the scan is unreadable.');
      return;
    }
    setResolving(true);
    try {
      const corrections = named.map(e => ({
        entity_id: e.id,
        corrected_name: e.entity_name,
        corrected_dosage: e.dosage,
        corrected_frequency: e.frequency,
        verified: true,
      }));
      await ApiService.verifyTask(selectedTask.id, corrections, 'Staff Navigator');
      setResolvedCount(c => c + 1);
      addToast('success', `Resolved. ${selectedTask.patient_name}'s record is now human-verified.`);
      setSelectedTask(null);
      setEditableEntities([]);
      await loadTasks();
    } catch (e) {
      if (e instanceof ApiError && e.offline) {
        enqueueOp({
          kind: 'verify-task', key: newIdempotencyKey(), taskId: selectedTask.id,
          corrections: named.map(x => ({
            entity_id: x.id, corrected_name: x.entity_name,
            corrected_dosage: x.dosage, corrected_frequency: x.frequency, verified: true,
          })),
          navigatorName: 'Staff Navigator',
        });
        addToast('warning', 'Saved on this device. It will sync to the server automatically.');
        setSelectedTask(null);
        setEditableEntities([]);
      } else {
        addToast('error', e instanceof ApiError ? e.message : 'Could not save. Please try again.');
      }
    } finally {
      setResolving(false);
    }
  };

  const handleEscalateTask = async () => {
    if (!selectedTask) return;
    try {
      await ApiService.escalateTask(selectedTask.id, 'Escalated to attending physician by Navigator');
      addToast('warning', 'Escalated to urgent. The clinician has been notified.');
      await loadTasks();
    } catch (e) {
      addToast('error', e instanceof ApiError ? e.message : 'Escalation failed. Please try again.');
    }
  };

  const filteredTasks = tasks.filter(t =>
    !searchQuery ||
    t.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.exception_category.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const pendingCount = filteredTasks.filter(t => t.status === 'PENDING').length;
  const { online, pending: outboxPending } = useOnlineStatus();
  const [loadError, setLoadError] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(p => p.filter(t => t.id !== id))} />

      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-700 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Navigator workbench</h1>
              <p className="text-xs text-slate-500">Resolve one exception at a time · oldest urgent first</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {!online && (
              <span className="text-xs px-2.5 py-1 rounded border font-semibold bg-amber-50 text-amber-800 border-amber-200" role="alert">
                Offline{outboxPending > 0 && ` · ${outboxPending} queued`}
              </span>
            )}
            {resolvedCount > 0 && (
              <span className="text-xs text-emerald-700 font-medium">{resolvedCount} resolved this session</span>
            )}
            <span className={`text-xs px-2.5 py-1 rounded border font-semibold ${
              pendingCount > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              {pendingCount} pending
            </span>
            <button onClick={loadTasks} disabled={isLoading} className="btn-secondary p-2.5" aria-label="Refresh queue">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-65px)]">
        <aside className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white flex flex-col">
          <div className="p-3.5 border-b border-slate-200 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search patient or reason…"
                aria-label="Search tasks"
                className="clinical-input pl-9 pr-3 py-2.5 text-sm"
              />
            </div>
            <div className="flex gap-1.5" role="tablist" aria-label="Team filter">
              {(['ALL', 'TIER_1_OPD_FLOOR', 'TIER_2_REMOTE_HUB'] as const).map(tier => (
                <button
                  key={tier}
                  onClick={() => setActiveTier(tier)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    activeTier === tier
                      ? 'bg-teal-700 border-teal-700 text-white'
                      : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {tier === 'ALL' ? 'All' : tier === 'TIER_1_OPD_FLOOR' ? 'Tier 1 · floor' : 'Tier 2 · review'}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2 bg-slate-50">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <p className="text-xs text-slate-600 leading-snug">
              {activeTier === 'TIER_2_REMOTE_HUB'
                ? 'Scope: verify documents and doses only. No diagnosis.'
                : 'Scope: kiosk help, language, document positioning. Non-clinical.'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto thin-scroll p-3 space-y-2 max-h-72 lg:max-h-none">
            {isLoading ? (
              <div className="space-y-2" role="status" aria-label="Loading tasks">
                {[0, 1, 2].map(i => <div key={i} className="h-24 rounded-lg bg-slate-100 animate-pulse" />)}
              </div>
            ) : filteredTasks.length === 0 ? (
              loadError ? (
                <div className="text-center py-10 px-4" role="alert">
                  <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-900 mt-2">Queue unavailable</p>
                  <p className="text-[13px] text-slate-500 mt-1">{loadError}</p>
                  <button onClick={loadTasks} className="btn-secondary mt-3 px-4 py-2.5 min-h-[48px] text-sm">Retry</button>
                </div>
              ) : (
                <div className="text-center py-10">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-900 mt-2">Queue clear</p>
                  <p className="text-[13px] text-slate-500">No pending exceptions.</p>
                </div>
              )
            ) : (
              filteredTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => handleSelectTask(task)}
                  aria-pressed={selectedTask?.id === task.id}
                  className={`w-full text-left p-3.5 rounded-lg border transition-colors ${
                    selectedTask?.id === task.id
                      ? 'bg-teal-50 border-teal-700'
                      : 'bg-white border-slate-200 hover:border-slate-400'
                  } ${task.priority === 'URGENT' ? 'border-l-4 border-l-red-600' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-slate-900 text-[15px] truncate">{task.patient_name}</span>
                    <PriorityBadge priority={task.priority} />
                  </div>
                  <CategoryBadge cat={task.exception_category} />
                  <p className="text-[13px] text-slate-600 mt-1.5 leading-snug">{task.reason}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span>{task.failed_step.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className={`font-semibold ${
                      task.assistance_score < 0.5 ? 'text-red-700' :
                      task.assistance_score < 0.7 ? 'text-amber-700' : 'text-slate-500'
                    }`}>confidence {Math.round(task.assistance_score * 100)}%</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto thin-scroll p-4 sm:p-6">
          {!selectedTask ? (
            <div className="h-full flex items-center justify-center py-16 text-slate-500 text-sm">
              <div className="text-center">
                <UserCheck className="w-10 h-10 mx-auto text-slate-300" />
                <p className="mt-2">Select a task on the left to verify it.</p>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-slate-900">{selectedTask.patient_name}</h2>
                    <PriorityBadge priority={selectedTask.priority} />
                    <CategoryBadge cat={selectedTask.exception_category} />
                  </div>
                  <p className="text-[15px] text-slate-700 mt-1">{selectedTask.reason}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Session <span className="font-mono">{selectedTask.session_id}</span> · failed at {selectedTask.failed_step.replace(/_/g, ' ').toLowerCase()} · confidence {Math.round(selectedTask.assistance_score * 100)}%
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedTask(null); setEditableEntities([]); }}
                  className="btn-secondary p-2 shrink-0" aria-label="Close task"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedTask.exception_category === 'RULE_BASED_SAFETY_FLAG' && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3" role="alert">
                  <AlertOctagon className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800">Safety flag — act in person first</p>
                    <p className="text-sm text-slate-700 mt-1">Go to the patient at the kiosk now. Do not try to resolve an emergency from this screen alone.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2.5">
                  <h3 className="label-micro flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" /> What the system saw
                  </h3>
                  <div className="clinical-card p-4 space-y-3">
                    {(() => {
                      const docId = ApiService.docIdFromSourceRef(selectedTask.entities[0]?.source_ref);
                      return docId ? (
                        <figure className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                          <img
                            src={ApiService.documentFileUrl(docId)}
                            alt={`Original scan for ${selectedTask.patient_name}`}
                            className="w-full max-h-80 object-contain bg-slate-50"
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <figcaption className="px-3 py-2 text-xs text-slate-500 flex items-center justify-between gap-2">
                            <span className="font-mono truncate">{selectedTask.entities[0]?.source_ref}</span>
                            <a href={ApiService.documentFileUrl(docId)} target="_blank" rel="noreferrer" className="text-teal-700 font-medium shrink-0 hover:underline">Open full size</a>
                          </figcaption>
                        </figure>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                          <FileText className="w-7 h-7 text-slate-400 mx-auto" />
                          <p className="text-xs text-slate-500 font-mono mt-1.5 break-words">
                            {selectedTask.entities[0]?.source_ref || 'No document attached — kiosk assistance needed'}
                          </p>
                        </div>
                      );
                    })()}
                    {selectedTask.entities[0]?.confidence != null && (
                      <span className="inline-block text-xs px-2 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200 font-medium">
                        OCR confidence {Math.round(selectedTask.entities[0].confidence * 100)}% — below the 65% threshold
                      </span>
                    )}
                    {selectedTask.entities.length > 0 && (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[13px] text-slate-700 space-y-1">
                        <p className="text-xs font-sans font-semibold text-slate-500 uppercase tracking-wide">AI reading (unverified)</p>
                        {selectedTask.entities.map((e, i) => (
                          <div key={i}>Rx: {e.entity_name} {e.dosage ? `[${e.dosage}]` : '[dose unclear]'} {e.frequency || ''}</div>
                        ))}
                      </div>
                    )}
                    <p className="text-[13px] text-slate-500">Compare the reading above against the original paper before correcting.</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <h3 className="label-micro flex items-center gap-2">
                    <Edit3 className="w-3.5 h-3.5" /> Your correction
                  </h3>
                  {editableEntities.length > 0 ? (
                    <div className="space-y-3">
                      {editableEntities.map(e => (
                        <div key={e.id} className="clinical-card p-4 space-y-3">
                          <div className="space-y-1.5">
                            <label htmlFor={`med-${e.id}`} className="label-micro">Medicine name</label>
                            <input
                              id={`med-${e.id}`}
                              type="text"
                              value={e.entity_name}
                              onChange={ev => handleEntityChange(e.id, 'entity_name', ev.target.value)}
                              className="clinical-input px-3 py-2.5 text-[15px] font-medium"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1.5">
                              <label htmlFor={`dose-${e.id}`} className="label-micro">Confirmed dose</label>
                              <input
                                id={`dose-${e.id}`}
                                type="text"
                                value={e.dosage || ''}
                                onChange={ev => handleEntityChange(e.id, 'dosage', ev.target.value)}
                                placeholder="e.g. 5 mg"
                                className="clinical-input px-3 py-2.5 font-mono text-sm"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label htmlFor={`freq-${e.id}`} className="label-micro">Frequency</label>
                              <input
                                id={`freq-${e.id}`}
                                type="text"
                                value={e.frequency || ''}
                                onChange={ev => handleEntityChange(e.id, 'frequency', ev.target.value)}
                                placeholder="e.g. Once daily"
                                className="clinical-input px-3 py-2.5 text-sm"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-slate-500">Saving changes the label from <span className="font-medium">AI-extracted</span> to <span className="font-medium text-emerald-700">human-verified</span>.</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="clinical-card p-5 text-sm text-slate-600">
                      <User className="w-7 h-7 text-slate-300 mb-2" />
                      <p className="font-medium text-slate-800">Nothing extracted — transcribe from the scan</p>
                      <p className="text-[13px] mt-1">The system could not read this document, so nothing is pre-filled. Read the original image on the left and add each medicine yourself. Nothing is guessed.</p>
                      <button onClick={handleAddEntity} className="btn-secondary mt-3 px-4 py-2.5 min-h-[48px] text-sm">
                        + Add medicine from scan
                      </button>
                    </div>
                  )}
                  {editableEntities.length > 0 && (
                    <button onClick={handleAddEntity} className="btn-secondary w-full py-2.5 min-h-[48px] text-sm">
                      + Add another medicine
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">Confirm only what you personally checked. When unsure, escalate.</p>
                <div className="flex items-center gap-2">
                  <button onClick={handleEscalateTask} className="btn-secondary px-4 py-2.5 min-h-[48px] text-sm">
                    Escalate
                  </button>
                  <button
                    onClick={handleResolveTask}
                    disabled={resolving}
                    className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 min-h-[48px] text-sm font-semibold"
                  >
                    {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {resolving ? 'Saving…' : 'Confirm and resolve'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
