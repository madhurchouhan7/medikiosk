import React, { useState, useEffect } from 'react';
import {
  Settings, Server, Database, Cpu, ShieldCheck, Activity,
  BarChart3, ChevronDown, ChevronUp
} from 'lucide-react';
import { OperationalMetrics } from '../../types';
import { ApiService, ApiError } from '../../services/api';

const JUDGE_QA = [
  { q: "Isn't this just a kiosk?", a: "No. The kiosk is only the patient interface. The product is the orchestration: AI intake, confidence checks, exception routing, human verification, and a clinician-ready summary." },
  { q: "Why do we need humans if you have AI?", a: "Patients and handwritten documents are messy. Humans handle exceptions selectively instead of performing every routine intake by hand." },
  { q: "What if the AI gives the doctor wrong information?", a: "Uncertainty is labelled, low-confidence items are routed for verification, and the doctor remains the final authority. Deployment needs clinical validation." },
  { q: "What happens when a patient cannot use the kiosk?", a: "The flow is hybrid by design. The case is escalated to a floor navigator rather than forcing a failed digital path." },
  { q: "Can this be used in every hospital immediately?", a: "No. This prototype demonstrates the architecture. Real deployment needs workflow mapping, validation, privacy controls, and institutional approval." },
];

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'qa' | 'audit' | 'infra'>('metrics');
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [health, setHealth] = useState<{ ok: boolean; detail: string }>({ ok: true, detail: 'Checking…' });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [m, logs] = await Promise.all([
          ApiService.getOperationalMetrics(),
          ApiService.getAuditLogs(),
        ]);
        setMetrics(m);
        setAuditLogs(logs);
        setLoadError(null);
        setHealth({ ok: true, detail: 'Service running' });
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Admin data could not be loaded.';
        setLoadError(msg);
        setHealth({ ok: false, detail: 'Server unreachable' });
      }
    };
    loadData();
    const t = setInterval(loadData, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
              <Settings className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Administration</h1>
              <p className="text-[13px] text-slate-500">Operations, audit trail, and system status</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold w-fit ${
            health.ok
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`} role="status">
            <Activity className="w-3.5 h-3.5" /> {health.detail}
          </span>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-0 flex gap-2 overflow-x-auto" role="tablist" aria-label="Admin sections">
          {([
            { id: 'metrics', label: 'Operations', icon: BarChart3 },
            { id: 'audit', label: 'Audit trail', icon: ShieldCheck },
            { id: 'infra', label: 'Infrastructure', icon: Server },
            { id: 'qa', label: 'Evaluation Q&A', icon: Settings },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-teal-700 text-teal-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loadError && (
          <div className="mb-4 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-sm" role="alert">
            <span className="font-medium text-amber-900">Live data unavailable: </span>
            <span className="text-slate-600">{loadError}</span>
          </div>
        )}
        {activeTab === 'metrics' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {[
                { v: metrics ? `${Math.round(metrics.intake_completion_rate * 100)}%` : '—', l: 'Intake completion', s: 'Completed / started' },
                { v: metrics ? `${metrics.median_intake_time_seconds}s` : '—', l: 'Median intake time', s: 'Start to summary ready' },
                { v: metrics ? `${Math.round(metrics.exception_rate * 100)}%` : '—', l: 'Exception rate', s: 'Needed human help' },
                { v: metrics ? `${metrics.avg_resolution_time_seconds}s` : '—', l: 'Avg. resolution', s: 'Per exception' },
              ].map(c => (
                <div key={c.l} className="clinical-card p-4">
                  <div className="text-2xl font-semibold text-slate-900">{c.v}</div>
                  <div className="text-sm font-medium text-slate-800 mt-0.5">{c.l}</div>
                  <div className="text-xs text-slate-500">{c.s}</div>
                </div>
              ))}
            </div>

            <div className="clinical-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 font-semibold text-sm">What we measure, and why</div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    <th className="px-5 py-3 font-semibold">Metric</th>
                    <th className="px-5 py-3 font-semibold hidden sm:table-cell">Definition</th>
                    <th className="px-5 py-3 font-semibold text-right">Pilot target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {[
                    ['Intake completion rate', 'Completed / started sessions', '> 90%'],
                    ['Median intake time', 'Start to summary ready', '< 90 s'],
                    ['Exception rate', 'Sessions needing human help / total', '10–15%'],
                    ['Resolution time', 'Task created → resolved', '< 45 s'],
                    ['OCR correction rate', 'Fields corrected / reviewed', '< 10%'],
                  ].map(([m, d, t]) => (
                    <tr key={m}>
                      <td className="px-5 py-3 font-medium text-slate-900">{m}<span className="block sm:hidden text-xs font-normal text-slate-500">{d}</span></td>
                      <td className="px-5 py-3 hidden sm:table-cell text-slate-600">{d}</td>
                      <td className="px-5 py-3 text-right font-mono text-[13px] text-teal-800">{t}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-slate-500">Targets are pilot guides, not outcome claims. Throughput gains must be measured on site.</p>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="clinical-card p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" /> Event log — who did what
              </h3>
              <span className="text-xs text-slate-500">Every AI and human action is recorded</span>
            </div>
            <div className="space-y-2">
              {auditLogs.map((log, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap justify-between items-center gap-2 text-[13px]">
                  <div>
                    <span className="text-slate-500 font-mono text-xs">[{log.timestamp}]</span>{' '}
                    <strong className="text-slate-900 font-medium">{log.action}</strong>{' '}
                    <span className="text-slate-500">({log.details})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded border bg-white text-slate-600 border-slate-200">{log.provenance}</span>
                    <span className="text-xs text-slate-600">{log.actor}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'infra' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {[
              { icon: Cpu, t: 'Local language processing', d: 'On-premise models keep transcripts inside the hospital network. No patient audio leaves the site in local mode.' },
              { icon: Server, t: 'Speech and documents', d: 'Speech-to-text and OCR run locally or via configured providers, with confidence scores on every extraction.' },
              { icon: Database, t: 'Storage and sessions', d: 'Relational records plus session cache for instant handoff between kiosk, navigator, and doctor views.' },
            ].map(c => (
              <div key={c.t} className="clinical-card p-5">
                <c.icon className="w-5 h-5 text-teal-700 mb-2.5" />
                <div className="font-semibold text-slate-900 mb-1">{c.t}</div>
                <p className="text-sm text-slate-600 leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'qa' && (
          <div className="space-y-3 max-w-3xl">
            <p className="text-sm text-slate-600">Short answers for evaluation discussions. Plain language, no throughput claims without a pilot.</p>
            {JUDGE_QA.map((item, idx) => (
              <div key={idx} className="clinical-card overflow-hidden">
                <button
                  onClick={() => setExpandedQ(expandedQ === idx ? null : idx)}
                  aria-expanded={expandedQ === idx}
                  className="w-full p-4 text-left flex items-center justify-between gap-3 min-h-[56px] hover:bg-slate-50"
                >
                  <span className="font-medium text-[15px] text-slate-900">“{item.q}”</span>
                  {expandedQ === idx ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                </button>
                {expandedQ === idx && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 text-sm text-slate-700 leading-relaxed">{item.a}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
