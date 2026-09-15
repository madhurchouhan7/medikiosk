import React, { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope, AlertOctagon, CheckCircle2, FileText,
  User, Check, X, Loader2, ChevronRight, Download,
  AlertTriangle, Activity, RefreshCw, Search
} from 'lucide-react';
import type { ClinicalSummary } from '../../types';
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
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Provenance badge ──────────────────────────────────────────────────────────
const ProvenanceBadge = ({ prov }: { prov: string }) => {
  const styles: Record<string, string> = {
    'AI_EXTRACTED': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'HUMAN_VERIFIED': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'PATIENT_REPORTED': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'CLINICIAN_CONFIRMED': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  };
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wide ${styles[prov] || 'bg-slate-700 text-slate-400'}`}>
      {prov.replace(/_/g, ' ')}
    </span>
  );
};

// ─── Row component for summary table ──────────────────────────────────────────
const SummaryRow = ({
  label, children, prov, urgent
}: {
  label: string;
  children: React.ReactNode;
  prov?: string;
  urgent?: boolean;
}) => (
  <div className={`grid grid-cols-12 gap-4 py-4 px-5 border-b border-white/5 ${urgent ? 'bg-red-500/5' : ''}`}>
    <div className="col-span-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider pt-0.5">
      {label}
    </div>
    <div className="col-span-7 text-sm text-slate-200">{children}</div>
    <div className="col-span-2 flex justify-end">
      {prov && <ProvenanceBadge prov={prov} />}
    </div>
  </div>
);

// ─── Patient Queue Item ────────────────────────────────────────────────────────
interface QueueItem {
  session_id: string;
  patient_name: string;
  age: number;
  gender: string;
  abha_id: string;
  chief_complaint: string;
  status: string;
  assistance_score: number;
  physician_verified: boolean;
}

// ─── DoctorDashboard ──────────────────────────────────────────────────────────
export const DoctorDashboard: React.FC = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('session-scen-b');
  const [summary, setSummary] = useState<ClinicalSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showSignOffModal, setShowSignOffModal] = useState(false);
  const [physicianNotes, setPhysicianNotes] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = `t-${Date.now()}`;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  // Load patient queue
  const loadQueue = useCallback(async () => {
    try {
      const data = await ApiService.listSummaries();
      setQueue(data as QueueItem[]);
    } catch {
      // silent fail — use fallback in ApiService
    }
  }, []);

  // Load summary for selected session
  const loadSummary = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    setSummary(null);
    try {
      const data = await ApiService.getSummary(sessionId);
      setSummary(data);
    } catch {
      addToast('error', 'Failed to load summary');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadQueue();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      loadSummary(selectedSessionId);
    }
  }, [selectedSessionId]);

  // Sign-off handler
  const handleSignOff = async () => {
    if (!summary) return;
    setIsVerifying(true);
    try {
      await ApiService.verifySummary(summary.session_id, physicianNotes || 'Verified by consulting physician');
      setSummary(prev => prev ? { ...prev, physician_verified: true, physician_notes: physicianNotes } : prev);
      setShowSignOffModal(false);
      addToast('success', 'Summary signed off — added to EHR with CLINICIAN_CONFIRMED provenance');
      loadQueue();
    } catch {
      addToast('error', 'Sign-off failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // FHIR export (download JSON)
  const handleFhirExport = () => {
    if (!summary) return;
    const fhir = {
      resourceType: 'Bundle',
      type: 'document',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: summary.patient.id,
            name: [{ text: summary.patient.name }],
            gender: summary.patient.gender.toLowerCase(),
            birthDate: `${new Date().getFullYear() - summary.patient.age}-01-01`,
            identifier: [{ system: 'https://ndhm.gov.in/abha', value: summary.patient.abha_id }],
          }
        },
        {
          resource: {
            resourceType: 'Composition',
            status: 'final',
            type: { coding: [{ system: 'http://loinc.org', code: '34133-9', display: 'Summary of episode note' }] },
            subject: { reference: `Patient/${summary.patient.id}` },
            title: 'Clinical Intake Summary — MediKiosk',
            section: [
              { title: 'Chief Complaint', text: { div: summary.chief_complaint } },
              { title: 'History of Present Illness', text: { div: summary.hpi_summary } },
              { title: 'Past Medical History', text: { div: summary.past_medical_history.join('; ') } },
              {
                title: 'Medications', entry: summary.medications.map(m => ({
                  reference: `Medication/${m.id}`,
                  display: `${m.entity_name} ${m.dosage || ''} — ${m.frequency || ''}`
                }))
              }
            ]
          }
        }
      ]
    };
    const blob = new Blob([JSON.stringify(fhir, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fhir-${summary.patient.abha_id}-${summary.session_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'FHIR R4 Bundle downloaded');
  };

  const filteredQueue = queue.filter(q =>
    !searchQuery ||
    q.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.abha_id?.includes(searchQuery)
  );

  const urgentFlags = summary?.red_flags?.filter(f => f.severity === 'URGENT') || [];
  const attentionFlags = summary?.red_flags?.filter(f => f.severity === 'ATTENTION') || [];

  return (
    <div className="min-h-screen bg-[#0f1117] text-white font-sans">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(p => p.filter(t => t.id !== id))} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-[#151820] border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Doctor — Clinical Intake</h1>
            <p className="text-[10px] text-slate-500">Pre-consultation summary portal</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {summary && !summary.physician_verified && (
            <button
              onClick={() => setShowSignOffModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-sm font-bold transition-colors"
            >
              <Check className="w-4 h-4" />
              Sign Off
            </button>
          )}
          {summary?.physician_verified && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Clinician Confirmed
            </span>
          )}
          {summary && (
            <button
              onClick={handleFhirExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              FHIR Export
            </button>
          )}
          <button
            onClick={() => selectedSessionId && loadSummary(selectedSessionId)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">

        {/* ── Left: Patient Queue ──────────────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-r border-white/5 flex flex-col bg-[#151820]">
          <div className="p-4 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search patients..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/40"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {filteredQueue.length === 0 && (
              <div className="text-center py-12 text-slate-600 text-sm">No patients in queue</div>
            )}
            {filteredQueue.map(item => (
              <button
                key={item.session_id}
                onClick={() => setSelectedSessionId(item.session_id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                  selectedSessionId === item.session_id
                    ? 'bg-teal-500/10 border-teal-500/30'
                    : 'bg-white/3 border-white/5 hover:bg-white/6'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white text-sm truncate">{item.patient_name}</span>
                  <span className={`text-[10px] font-bold ${
                    item.assistance_score < 0.5 ? 'text-red-400' :
                    item.assistance_score < 0.85 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>{Math.round(item.assistance_score * 100)}%</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">{item.chief_complaint}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    item.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                    item.status === 'NEED_ASSISTANCE' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {item.status?.replace(/_/g, ' ')}
                  </span>
                  {item.physician_verified && (
                    <CheckCircle2 className="w-3 h-3 text-teal-400" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Right: Summary Viewer ────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-3">
                <Loader2 className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
                <p className="text-sm text-slate-500">Loading patient summary...</p>
              </div>
            </div>
          ) : !summary ? (
            <div className="h-full flex items-center justify-center text-slate-600 text-sm">
              <div className="text-center space-y-2">
                <Stethoscope className="w-10 h-10 mx-auto opacity-30" />
                <p>Select a patient to view their intake summary</p>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto p-6 space-y-5">

              {/* Patient demographics */}
              <div className="p-4 rounded-xl bg-[#151820] border border-white/5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold text-white shrink-0">
                  {summary.patient.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-white">{summary.patient.name}</h2>
                  <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                    <span>{summary.patient.age} yrs · {summary.patient.gender}</span>
                    <span>·</span>
                    <span className="font-mono text-teal-400">ABHA: {summary.patient.abha_id}</span>
                    <span>·</span>
                    <span>{summary.patient.language_preference?.toUpperCase()}</span>
                    {summary.patient.phone && <span>· {summary.patient.phone}</span>}
                  </div>
                </div>
                {summary.physician_verified && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-medium">Verified</span>
                  </div>
                )}
              </div>

              {/* Red Flags */}
              {urgentFlags.length > 0 && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-bold text-red-400">URGENT — Clinical Red Flags</span>
                  </div>
                  {urgentFlags.map((f, i) => (
                    <div key={i} className="pl-6 space-y-0.5">
                      <p className="text-sm font-medium text-white">{f.symptom}</p>
                      <p className="text-xs text-slate-400">{f.message}</p>
                      <p className="text-xs text-red-300 font-medium">→ {f.action_required}</p>
                    </div>
                  ))}
                </div>
              )}
              {attentionFlags.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-amber-400">Attention — Risk Factors</span>
                  </div>
                  {attentionFlags.map((f, i) => (
                    <div key={i} className="pl-6">
                      <span className="text-sm font-medium text-white">{f.symptom}: </span>
                      <span className="text-sm text-slate-400">{f.message}</span>
                      <p className="text-xs text-amber-300 mt-0.5">→ {f.action_required}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* AI disclaimer */}
              <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-white/3 border border-white/5 text-[11px] text-slate-500">
                <Activity className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>{summary.disclaimer}</span>
              </div>

              {/* Summary Table */}
              <div className="rounded-xl bg-[#151820] border border-white/5 overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">Clinical Intake — SOAP Format</span>
                  <span className="text-[10px] text-slate-600">Full provenance enabled</span>
                </div>

                {/* 1. Chief Complaint */}
                <SummaryRow label="Chief Complaint" prov="PATIENT_REPORTED">
                  <span className="font-bold text-white text-base">{summary.chief_complaint}</span>
                </SummaryRow>

                {/* 2. HPI / SOCRATES Narrative & Breakdown */}
                <SummaryRow label="HPI (SOCRATES)" prov="PATIENT_REPORTED">
                  <div className="space-y-3">
                    <p className="text-slate-200 leading-relaxed font-medium">{summary.hpi_summary}</p>
                    {summary.socrates_breakdown && Object.keys(summary.socrates_breakdown).length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-white/3 border border-white/5 text-xs">
                        {Object.entries(summary.socrates_breakdown).map(([dim, val]) => (
                          <div key={dim} className="space-y-0.5">
                            <span className="text-[10px] text-teal-400 font-bold uppercase">{dim}:</span>
                            <p className="text-slate-300">{val}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SummaryRow>

                {/* 3. Previous Treatment for this Episode */}
                {summary.previous_treatment && summary.previous_treatment.length > 0 && (
                  <SummaryRow label="Prior Treatment" prov="PATIENT_REPORTED">
                    <ul className="space-y-1">
                      {summary.previous_treatment.map((t, i) => (
                        <li key={i} className="text-slate-300">• {t}</li>
                      ))}
                    </ul>
                  </SummaryRow>
                )}

                {/* 4. Past Medical History */}
                <SummaryRow label="Past Medical" prov="PATIENT_REPORTED">
                  <ul className="space-y-1">
                    {summary.past_medical_history.map((h, i) => (
                      <li key={i} className="text-slate-300">• {h}</li>
                    ))}
                  </ul>
                </SummaryRow>

                {/* 5. Past Surgical & Hospitalization */}
                {summary.past_surgical_history && summary.past_surgical_history.length > 0 && (
                  <SummaryRow label="Past Surgical" prov="PATIENT_REPORTED">
                    <ul className="space-y-1">
                      {summary.past_surgical_history.map((s, i) => (
                        <li key={i} className="text-slate-300">• {s}</li>
                      ))}
                    </ul>
                  </SummaryRow>
                )}

                {/* 6. Current Medications (OCR + Reported) */}
                <SummaryRow label="Medications" prov={summary.medications[0]?.provenance || "PATIENT_REPORTED"}>
                  <div className="space-y-2">
                    {summary.medications.length === 0 ? (
                      <span className="text-slate-500 italic">No regular medications extracted or reported</span>
                    ) : summary.medications.map((m, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-white/3 border border-white/5 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-white">{m.entity_name}</span>
                          {m.dosage && <span className="text-slate-400"> {m.dosage}</span>}
                          {m.frequency && <p className="text-[11px] text-slate-500 mt-0.5">{m.frequency}</p>}
                          <p className="text-[10px] text-slate-600 mt-0.5 font-mono">{m.source_ref}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <ProvenanceBadge prov={m.provenance} />
                          {m.verified_by && (
                            <span className="text-[9px] text-slate-600">{m.verified_by}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </SummaryRow>

                {/* 7. Allergies */}
                <SummaryRow label="Allergies" prov="PATIENT_REPORTED">
                  <span className={summary.allergies[0]?.includes('Allergic') ? 'text-red-400 font-bold' : 'text-slate-300'}>
                    {summary.allergies.join(', ')}
                  </span>
                </SummaryRow>

                {/* 8. Family History */}
                {summary.family_history && summary.family_history.length > 0 && (
                  <SummaryRow label="Family History" prov="PATIENT_REPORTED">
                    <ul className="space-y-1">
                      {summary.family_history.map((f, i) => (
                        <li key={i} className="text-slate-300">• {f}</li>
                      ))}
                    </ul>
                  </SummaryRow>
                )}

                {/* 9. Personal & Social History */}
                {summary.personal_social_history && summary.personal_social_history.length > 0 && (
                  <SummaryRow label="Personal/Social" prov="PATIENT_REPORTED">
                    <ul className="space-y-1">
                      {summary.personal_social_history.map((p, i) => (
                        <li key={i} className="text-slate-300">• {p}</li>
                      ))}
                    </ul>
                  </SummaryRow>
                )}

                {/* 10. Review of Systems */}
                <SummaryRow label="System Review" prov="PATIENT_REPORTED">
                  <ul className="space-y-1">
                    {summary.review_of_systems.map((s, i) => (
                      <li key={i} className="text-slate-300">• {s}</li>
                    ))}
                  </ul>
                </SummaryRow>

                {/* 11. Previous Investigations / Records */}
                {summary.previous_investigations && summary.previous_investigations.length > 0 && (
                  <SummaryRow label="Prior Reports" prov="PATIENT_REPORTED">
                    <ul className="space-y-1">
                      {summary.previous_investigations.map((r, i) => (
                        <li key={i} className="text-slate-300">• {r}</li>
                      ))}
                    </ul>
                  </SummaryRow>
                )}

                {/* 12. Gaps / Uncertain Items */}
                {summary.missing_or_uncertain_info.length > 0 && (
                  <SummaryRow label="Gaps / Uncertainty" prov="HUMAN_VERIFIED">
                    <ul className="space-y-1">
                      {summary.missing_or_uncertain_info.map((item, i) => (
                        <li key={i} className="text-amber-300">• {item}</li>
                      ))}
                    </ul>
                  </SummaryRow>
                )}

                {summary.physician_notes && (
                  <SummaryRow label="Doctor Notes" prov="CLINICIAN_CONFIRMED">
                    <span className="text-teal-300 italic">{summary.physician_notes}</span>
                  </SummaryRow>
                )}
              </div>

            </div>
          )}
        </main>
      </div>

      {/* ── Sign-Off Modal ───────────────────────────────────────────────────── */}
      {showSignOffModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#151820] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Sign Off Clinical Summary</h3>
              <button onClick={() => setShowSignOffModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-400">
              Signing off confirms this summary is clinically accurate. It will be marked as <span className="text-teal-400 font-medium">CLINICIAN_CONFIRMED</span> in the audit trail.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-500">Physician Notes (optional)</label>
              <textarea
                value={physicianNotes}
                onChange={e => setPhysicianNotes(e.target.value)}
                placeholder="e.g., Reviewed and accepted. Refer for knee X-ray."
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-[#0f1117] border border-white/10 text-white text-sm focus:border-teal-500/60 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSignOffModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOff}
                disabled={isVerifying}
                className="flex-1 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isVerifying ? 'Saving...' : 'Confirm Sign-Off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
