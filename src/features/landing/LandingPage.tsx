import React from 'react';
import { Link } from 'react-router-dom';
import {
  Mic, FileText, ShieldCheck, Stethoscope, UserCheck,
  ArrowRight, ClipboardList, ScanLine, BellRing, CheckCircle2
} from 'lucide-react';

const steps = [
  { n: '01', title: 'Register & consent', text: 'ABHA lookup or walk-in registration, language choice, and recorded consent. One task per screen.' },
  { n: '02', title: 'Guided history', text: 'Voice or touch intake using a fixed clinical-history structure with adaptive follow-up questions.' },
  { n: '03', title: 'Documents', text: 'Prescriptions and reports are scanned. OCR extracts medicines, doses, and dates with confidence scores.' },
  { n: '04', title: 'Confidence check', text: 'High confidence continues automatically. Low confidence creates a navigator task — never a silent guess.' },
  { n: '05', title: 'Human verification', text: 'A navigator confirms or corrects uncertain items. Every fix is labelled human-verified.' },
  { n: '06', title: 'Doctor review', text: 'A concise summary — complaint first, then key history, medicines, allergies, gaps, and red flags.' },
];

export const LandingPage: React.FC = () => {
  return (
    <div className="bg-white text-slate-900">
      {/* Hero — restrained, no gradient */}
      <section className="border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-3">
              Hospital OPD · Clinical intake prototype
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight leading-tight mb-4">
              A calm, structured intake before the consultation begins.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-3">
              MediKiosk collects the patient&apos;s story — complaints, history, medicines,
              allergies, and old records — and prepares a short, verifiable summary
              so the doctor can focus on examination and decisions.
            </p>
            <p className="text-sm text-slate-600 border-l-2 border-teal-700 pl-4 mb-8">
              Automate the routine. Escalate the uncertain. Verify the important.
              Keep the clinician in control. The system does not diagnose or prescribe.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/kiosk"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold bg-teal-700 text-white hover:bg-teal-800"
              >
                <Mic className="w-4 h-4" aria-hidden />
                Start patient kiosk
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                to="/doctor"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <Stethoscope className="w-4 h-4" aria-hidden />
                View doctor summary
              </Link>
              <Link
                to="/navigator"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <UserCheck className="w-4 h-4" aria-hidden />
                View navigator queue
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" aria-hidden /> Consent-first workflow</span>
              <span className="inline-flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" aria-hidden /> Fixed 13-section clinical structure</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> AI-extracted vs human-verified</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problems */}
      <section className="bg-slate-50 border-b border-slate-200" id="how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2">The pre-consultation bottleneck</h2>
          <p className="text-slate-600 text-sm sm:text-base max-w-2xl mb-8">
            Doctors have minutes per patient. The intake — not another long document — must arrive organised and compressed.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: 'Lost prescriptions', text: 'Old treatment, medicine names, and doses are forgotten or carried as loose paper. Retrieval is manual and slow.' },
              { title: 'Only the main complaint', text: '“My knee hurts” may hide hypertension, diabetes, or other medicines. The system asks “is there any other problem?” systematically.' },
              { title: 'Limited consultation time', text: 'The goal is a quick, reviewable summary — not a wall of text. Details stay one click away.' },
            ].map(c => (
              <div key={c.title} className="clinical-card p-5">
                <h3 className="font-semibold text-slate-900 mb-1.5">{c.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="border-b border-slate-200" id="capabilities">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2">How a case moves through the system</h2>
          <p className="text-slate-600 text-sm sm:text-base max-w-2xl mb-8">
            Patient → AI intake → OCR → confidence check → navigator verification → doctor summary.
          </p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {steps.map(s => (
              <li key={s.n} className="clinical-card p-5">
                <p className="text-xs font-semibold text-slate-400 mb-1">{s.n}</p>
                <h3 className="font-semibold text-slate-900 mb-1.5">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="clinical-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <ScanLine className="w-4 h-4 text-teal-700" aria-hidden />
                <h3 className="font-semibold">Confidence, not guesswork</h3>
              </div>
              <p className="text-sm text-slate-600">High confidence (≥85%) continues. Medium asks the patient to confirm. Low (&lt;65%) routes to a navigator. Unknown stays UNKNOWN.</p>
            </div>
            <div className="clinical-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <BellRing className="w-4 h-4 text-teal-700" aria-hidden />
                <h3 className="font-semibold">Red flags stay visible</h3>
              </div>
              <p className="text-sm text-slate-600">Chest pain, breathlessness, and similar signals are flagged urgently and surfaced first — for the clinician to judge.</p>
            </div>
            <div className="clinical-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-teal-700" aria-hidden />
                <h3 className="font-semibold">Provenance on everything</h3>
              </div>
              <p className="text-sm text-slate-600">Patient-reported, AI-extracted, human-verified, and clinician-confirmed items are labelled separately, with source references.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Safety */}
      <section className="bg-slate-50" id="safety">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2">Safety boundaries</h2>
              <p className="text-slate-600 text-sm sm:text-base mb-6">
                MediKiosk is a history-taking assistant. It is not an autonomous doctor.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="clinical-card p-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">The system may</h3>
                  <ul className="text-sm text-slate-700 space-y-1.5">
                    <li>· Collect and organise information</li>
                    <li>· Ask clarifying questions</li>
                    <li>· Extract document content</li>
                    <li>· Flag missing information</li>
                    <li>· Surface possible red flags</li>
                  </ul>
                </div>
                <div className="clinical-card p-5 border-l-2 border-l-red-600">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">The system must not</h3>
                  <ul className="text-sm text-slate-700 space-y-1.5">
                    <li>· Diagnose or prescribe</li>
                    <li>· Change dosages</li>
                    <li>· Invent history</li>
                    <li>· Present guesses as facts</li>
                    <li>· Replace physician judgment</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="clinical-card p-6">
              <h3 className="font-semibold mb-1">Try the full demo path</h3>
              <p className="text-sm text-slate-600 mb-4">Kiosk → exception → navigator fix → doctor review. Use ABHA <span className="font-mono text-[13px]">91-8823-9912-4012</span> for a returning patient with records.</p>
              <div className="flex flex-col gap-2.5">
                <Link to="/kiosk" className="inline-flex justify-center px-4 py-3 rounded-lg text-sm font-semibold bg-teal-700 text-white hover:bg-teal-800">Open patient kiosk</Link>
                <div className="grid grid-cols-2 gap-2.5">
                  <Link to="/navigator" className="inline-flex justify-center px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-300 hover:bg-slate-50">Navigator</Link>
                  <Link to="/doctor" className="inline-flex justify-center px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-300 hover:bg-slate-50">Doctor</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
