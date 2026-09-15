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
              <div className="text-center space-y