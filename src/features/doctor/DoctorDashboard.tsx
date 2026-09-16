import React, { useState, useEffect, useCallback } from 'react';
import {
  Stethoscope, AlertOctagon, CheckCircle2,
  Check, X, Loader2, Download,
  AlertTriangle, RefreshCw, Search
} from 'lucide-react';
import type { ClinicalSummary } from '../../types';
import { ApiService, ApiError } from '../../services/api';
import { useOnlineStatus } from '../../services/offline';

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
          <span className="flex-1 text-slate-800">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="text-slate-400 hover:text-slate-700" aria-label="Dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

const ProvenanceBadge = ({ prov }: { prov: string }) => {
  const styles: Record<string, string> = {
    'AI_EXTRACTED': 'bg-amber-50 text-amber-800 border-amber-200',
    'HUMAN_VERIFIED': 'bg-emerald-50 text-emerald-800 border-emerald-200',
    'PATIENT_REPORTED': 'bg-slate-100 text-slate-600 border-slate-200',
    'CLINICIAN_CONFIRMED': 'bg-teal-50 text-teal-800 border-teal-200',
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded border font-semibold whitespace-nowrap ${styles[prov] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {prov.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
};

const Section = ({ title, prov, children, urgent }: { title: string; prov?: string; children: React.ReactNode; urgent?: boolean }) => (
  <section className={`border-b border-slate-200 last:border-0 ${urgent ? 'bg-red-50/50' : ''}`}>
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-4 py-4 px-5">
      <div className="sm:col-span-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="sm:col-span-7 text-[15px] text-slate-800">{children}</div>
      <div className="sm:col-span-2 flex sm:justify-end items-start">
        {prov && <ProvenanceBadge prov={prov} />}
      </div>
    </div>
  </section>
);

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

  const [queueError, setQueueError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const { online } = useOnlineStatus();

  const loadQueue = useCallback(async () => {
    try {
      const data = await ApiService.listSummaries();
      setQueue(data as QueueItem[]);
      setQueueError(null);
    } catch (e) {
      setQueueError(e instanceof ApiError ? e.message : 'Patient list could not be loaded.');
    }
  }, []);

  const loadSummary = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    setSummary(null);
    setSummaryError(null);
    try {
      const data = await ApiService.getSummary(sessionId);
      setSummary(data);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Summary could not be loaded.';
      setSummaryError(msg);
      addToast('error', `${msg} Retry when connected.`);
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  useEffect(() => {
    if (selectedSessionId) loadSummary(selectedSessionId);
  }, [selectedSessionId, loadSummary]);

  const handleSignOff = async () => {
    if (!summary) return;
    setIsVerifying(true);
    try {
      await ApiService.verifySummary(summary.session_id, physicianNotes || 'Verified by consulting physician');
      setSummary(prev => prev ? { ...prev, physician_verified: true, physician_notes: physicianNotes } : prev);
      setShowSignOffModal(false);
      addToast('success', 'Summary signed off and marked clinician-confirmed.');
      loadQueue();
    } catch (e) {
      addToast('error', e instanceof ApiError ? e.message : 'Sign-off failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

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
            title: 'Clinical Intake Summary — Niramaya',
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
    addToast('success', 'FHIR R4 bundle downloaded.');
  };

  const filteredQueue = queue.filter(q =>
    !searchQuery ||
    q.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.abha_id?.includes(searchQuery)
  );

  const urgentFlags = summary?.red_flags?.filter(f => f.severity === 'URGENT') || [];
  const attentionFlags = summary?.red_flags?.filter(f => f.severity === 'ATTENTION') || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(p => p.filter(t => t.id !== id))} />

      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-700 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">Doctor — clinical intake</h1>
              <p className="text-xs text-slate-500">Review before consultation · verify, don&apos;t re-type</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!online && (
              <span className="text-xs px-2.5 py-1 rounded border font-semibold bg-amber-50 text-amber-800 border-amber-200" role="alert">
                Offline — showing last loaded data
              </span>
            )}
            {summary && !summary.physician_verified && (
              <button onClick={() => setShowSignOffModal(true)} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm">
                <Check className="w-4 h-4" /> Sign off
              </button>
            )}
            {summary?.physician_verified && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Clinician-confirmed
              </span>
            )}
            {summary && (
              <button onClick={handleFhirExport} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px]">
                <Download className="w-3.5 h-3.5" /> FHIR export
              </button>
            )}
            <button onClick={() => selectedSessionId && loadSummary(selectedSessionId)} className="btn-secondary p-2.5" aria-label="Reload summary">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-65px)]">
        {/* Queue */}
        <aside className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white flex flex-col">
          <div className="p-3.5 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search name or ABHA…"
                aria-label="Search patients"
                className="clinical-input pl-9 pr-3 py-2.5 text-sm"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">{filteredQueue.length} waiting · urgent first</p>
          </div>
          <div className="flex-1 overflow-y-auto thin-scroll p-3 space-y-2 max-h-72 lg:max-h-none">
            {queueError && (
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-sm" role="alert">
                <p className="font-medium text-amber-900">Patient list unavailable</p>
                <p className="text-[13px] text-slate-600 mt-0.5">{queueError}</p>
                <button onClick={loadQueue} className="btn-secondary mt-2.5 px-4 py-2 min-h-[44px] text-[13px] w-full">Retry</button>
              </div>
            )}
            {filteredQueue.length === 0 && !queueError && (
              <div className="text-center py-10 text-slate-500 text-sm">No patients match this search.</div>
            )}
            {filteredQueue.map(item => {
              const urgent = item.chief_complaint.toLowerCase().includes('chest') || item.assistance_score < 0.5;
              return (
                <button
                  key={item.session_id}
                  onClick={() => setSelectedSessionId(item.session_id)}
                  aria-pressed={selectedSessionId === item.session_id}
                  className={`w-full text-left p-3.5 rounded-lg border transition-colors ${
                    selectedSessionId === item.session_id
                      ? 'bg-teal-50 border-teal-700'
                      : 'bg-white border-slate-200 hover:border-slate-400'
                  } ${urgent ? 'border-l-4 border-l-red-600' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-semibold text-slate-900 text-[15px] truncate">{item.patient_name}</span>
                    <span className={`text-xs font-semibold whitespace-nowrap ${
                      item.assistance_score < 0.65 ? 'text-red-700' :
                      item.assistance_score < 0.85 ? 'text-amber-700' : 'text-emerald-700'
                    }`}>{Math.round(item.assistance_score * 100)}%</span>
                  </div>
                  <p className="text-[13px] text-slate-600 truncate">{item.chief_complaint}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded border font-medium ${
                      item.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                      item.status === 'NEED_ASSISTANCE' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {item.status?.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    {item.physician_verified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" aria-label="Verified" />}
                    <span className="text-[11px] text-slate-400 ml-auto">{item.age}y · {item.gender}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Summary */}
        <main className="flex-1 overflow-y-auto thin-scroll">
          {isLoading ? (
            <div className="h-full flex items-center justify-center py-20" role="status">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-teal-700 animate-spin mx-auto" />
                <p className="text-sm text-slate-500 mt-3">Loading patient summary…</p>
              </div>
            </div>
          ) : summaryError ? (
            <div className="h-full flex items-center justify-center py-20 text-sm px-4">
              <div className="text-center max-w-sm">
                <AlertTriangle className="w-10 h-10 mx-auto text-amber-600" />
                <p className="font-medium text-slate-900 mt-2">Summary unavailable</p>
                <p className="text-slate-500 mt-1">{summaryError}</p>
                <button onClick={() => selectedSessionId && loadSummary(selectedSessionId)} className="btn-secondary mt-4 px-4 py-2.5 min-h-[48px] text-sm">Retry</button>
              </div>
            </div>
          ) : !summary ? (
            <div className="h-full flex items-center justify-center py-20 text-slate-500 text-sm">
              <div className="text-center">
                <Stethoscope className="w-10 h-10 mx-auto text-slate-300" />
                <p className="mt-2">Select a patient to view their intake summary.</p>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
              {/* Patient strip */}
              <div className="clinical-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-lg font-semibold shrink-0" aria-hidden>
                  {summary.patient.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900">{summary.patient.name}</h2>
                  <p className="text-[13px] text-slate-500">
                    {summary.patient.age} yrs · {summary.patient.gender} · <span className="font-mono">ABHA {summary.patient.abha_id}</span>
                    {summary.patient.phone && <span> · {summary.patient.phone}</span>}
                  </p>
                </div>
                {summary.physician_verified && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Verified
                  </span>
                )}
              </div>

              {/* Red flags first */}
              {urgentFlags.length > 0 && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200" role="alert">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertOctagon className="w-4 h-4 text-red-700" />
                    <span className="text-sm font-semibold text-red-800">Urgent — review before anything else</span>
                  </div>
                  {urgentFlags.map((f, i) => (
                    <div key={i} className="py-1.5 border-t border-red-100 first:border-0">
                      <p className="text-[15px] font-semibold text-slate-900">{f.symptom}</p>
                      <p className="text-sm text-slate-700">{f.message}</p>
                      <p className="text-sm text-red-800 font-medium mt-0.5">Action: {f.action_required}</p>
                    </div>
                  ))}
                </div>
              )}
              {attentionFlags.length > 0 && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span className="text-sm font-semibold text-amber-900">Attention — risk factors</span>
                  </div>
                  {attentionFlags.map((f, i) => (
                    <div key={i} className="py-1">
                      <span className="text-sm font-medium text-slate-900">{f.symptom}: </span>
                      <span className="text-sm text-slate-700">{f.message}</span>
                      <p className="text-[13px] text-amber-800 mt-0.5">Action: {f.action_required}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 60-second brief */}
              <div className="clinical-card p-5 border-l-4 border-l-teal-700">
                <p className="label-micro mb-1.5">60-second brief</p>
                <p className="text-base font-semibold text-slate-900 leading-snug">{summary.chief_complaint}</p>
                <p className="text-[15px] text-slate-700 leading-relaxed mt-1.5">{summary.hpi_summary}</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[13px] text-slate-600">
                  <span><strong className="text-slate-900">Medicines:</strong> {summary.medications.length ? summary.medications.map(m => `${m.entity_name}${m.dosage ? ' ' + m.dosage : ''}`).join(', ') : 'none reported'}</span>
                  <span><strong className="text-slate-900">Allergies:</strong> {summary.allergies.join(', ')}</span>
                </div>
                {summary.missing_or_uncertain_info.length > 0 && (
                  <p className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mt-3">
                    Still uncertain: {summary.missing_or_uncertain_info.join(' · ')}
                  </p>
                )}
              </div>

              <p className="text-[13px] text-slate-500 border border-slate-200 bg-white rounded-lg px-3.5 py-2.5">{summary.disclaimer}</p>

              {/* Full structured record */}
              <details className="clinical-card overflow-hidden" open>
                <summary className="px-5 py-3.5 text-sm font-semibold text-slate-800 cursor-pointer hover:bg-slate-50 min-h-[48px]">
                  Full structured record — 13 clinical sections
                </summary>
                <div>
                  <Section title="1 · Chief complaint" prov="PATIENT_REPORTED">
                    <span className="font-semibold text-slate-900 text-base">{summary.chief_complaint}</span>
                  </Section>
                  <Section title="2 · History of present illness" prov="PATIENT_REPORTED">
                    <p className="leading-relaxed">{summary.hpi_summary}</p>
                    {summary.socrates_breakdown && Object.keys(summary.socrates_breakdown).length > 0 && (
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm">
                        {Object.entries(summary.socrates_breakdown).map(([dim, val]) => (
                          <div key={dim}>
                            <dt className="text-xs text-teal-800 font-semibold uppercase">{dim}</dt>
                            <dd className="text-slate-700">{val}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </Section>
                  {summary.previous_treatment && summary.previous_treatment.length > 0 && (
                    <Section title="3 · Previous treatment (this episode)" prov="PATIENT_REPORTED">
                      <ul className="list-disc pl-5 space-y-1">{summary.previous_treatment.map((t, i) => <li key={i}>{t}</li>)}</ul>
                    </Section>
                  )}
                  <Section title="4 · Past medical history" prov="PATIENT_REPORTED">
                    <ul className="list-disc pl-5 space-y-1">{summary.past_medical_history.map((h, i) => <li key={i}>{h}</li>)}</ul>
                  </Section>
                  {summary.past_surgical_history && summary.past_surgical_history.length > 0 && (
                    <Section title="5 · Surgical / hospitalisation" prov="PATIENT_REPORTED">
                      <ul className="list-disc pl-5 space-y-1">{summary.past_surgical_history.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </Section>
                  )}
                  <Section title="6 · Current medicines" prov={summary.medications[0]?.provenance || 'PATIENT_REPORTED'}>
                    {summary.medications.length === 0 ? (
                      <span className="text-slate-500 italic">No regular medicines reported or extracted.</span>
                    ) : (
                      <div className="space-y-2">
                        {summary.medications.map((m, i) => (
                          <div key={i} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
                            <div>
                              <span className="font-semibold text-slate-900">{m.entity_name}</span>
                              {m.dosage && <span className="text-slate-600"> {m.dosage}</span>}
                              {m.frequency && <p className="text-[13px] text-slate-500 mt-0.5">{m.frequency}</p>}
                              <p className="text-xs text-slate-400 mt-0.5 font-mono">{m.source_ref} · {Math.round(m.confidence * 100)}%</p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <ProvenanceBadge prov={m.provenance} />
                              {m.verified_by && <span className="text-[11px] text-slate-500">{m.verified_by}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Section>
                  <Section title="7 · Allergies" prov="PATIENT_REPORTED">
                    <span className={summary.allergies[0]?.toLowerCase().includes('allerg') && !summary.allergies[0]?.toLowerCase().includes('no known') ? 'text-red-800 font-semibold' : ''}>
                      {summary.allergies.join(', ')}
                    </span>
                  </Section>
                  {summary.family_history && summary.family_history.length > 0 && (
                    <Section title="8 · Family history" prov="PATIENT_REPORTED">
                      <ul className="list-disc pl-5 space-y-1">{summary.family_history.map((f, i) => <li key={i}>{f}</li>)}</ul>
                    </Section>
                  )}
                  {summary.personal_social_history && summary.personal_social_history.length > 0 && (
                    <Section title="9 · Personal / social" prov="PATIENT_REPORTED">
                      <ul className="list-disc pl-5 space-y-1">{summary.personal_social_history.map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </Section>
                  )}
                  <Section title="10 · Review of systems" prov="PATIENT_REPORTED">
                    <ul className="list-disc pl-5 space-y-1">{summary.review_of_systems.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </Section>
                  {summary.previous_investigations && summary.previous_investigations.length > 0 && (
                    <Section title="11 · Previous investigations" prov="PATIENT_REPORTED">
                      <ul className="list-disc pl-5 space-y-1">{summary.previous_investigations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                    </Section>
                  )}
                  {summary.missing_or_uncertain_info.length > 0 && (
                    <Section title="12 · Gaps / uncertainty" prov="HUMAN_VERIFIED" urgent>
                      <ul className="list-disc pl-5 space-y-1 text-amber-900">{summary.missing_or_uncertain_info.map((item, i) => <li key={i}>{item}</li>)}</ul>
                    </Section>
                  )}
                  {summary.physician_notes && (
                    <Section title="13 · Doctor notes" prov="CLINICIAN_CONFIRMED">
                      <span className="italic text-teal-900">{summary.physician_notes}</span>
                    </Section>
                  )}
                </div>
              </details>
            </div>
          )}
        </main>
      </div>

      {showSignOffModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Sign off summary">
          <div className="bg-white border border-slate-200 rounded-lg p-6 w-full max-w-md space-y-4 shadow-raised">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Sign off this summary</h3>
              <button onClick={() => setShowSignOffModal(false)} className="text-slate-400 hover:text-slate-700" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Signing off records your clinical acceptance. The summary becomes <span className="font-medium text-teal-800">clinician-confirmed</span> in the audit trail.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="phys-notes" className="label-micro">Physician notes (optional)</label>
              <textarea
                id="phys-notes"
                value={physicianNotes}
                onChange={e => setPhysicianNotes(e.target.value)}
                placeholder="e.g. Reviewed. Refer for knee X-ray, check BP."
                rows={3}
                className="clinical-input px-3 py-2.5 text-sm resize-none"
              />
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setShowSignOffModal(false)} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
              <button onClick={handleSignOff} disabled={isVerifying} className="btn-primary flex-1 py-2.5 text-sm inline-flex items-center justify-center gap-2">
                {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isVerifying ? 'Saving…' : 'Confirm sign-off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
