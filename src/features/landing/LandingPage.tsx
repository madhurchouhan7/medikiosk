import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Mic, Globe2, FileText, CheckCircle2, ShieldAlert, Cpu, 
  Stethoscope, UserCheck, ArrowRight, Activity, Zap, Lock, Database, Server, HelpCircle
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-teal-500 selection:text-white font-sans">
      
      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/10 via-slate-900 to-slate-900 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-semibold uppercase tracking-wider mb-5">
            <Activity className="w-4 h-4 animate-pulse" />
            <span>Smart India Hackathon 2026 · Problem Statement 26047</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight mb-4">
            Adaptive <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">AI–Human Clinical Intake</span> &amp; OPD Navigation Platform
          </h1>

          {/* Simple Pitch Line (Section 1 of Document) */}
          <div className="max-w-2xl mx-auto p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-300 text-sm italic mb-6">
            “MediKiosk prepares the patient’s story before the doctor has to ask for it—and brings a human into the workflow only when AI needs help.”
          </div>

          <p className="text-base sm:text-lg text-slate-400 max-w-3xl mx-auto mb-8 leading-relaxed font-normal">
            Automating routine history taking, prescription document OCR, and exception-driven human navigation — delivering concise, source-traceable clinical intake summaries before the consultation begins.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-14">
            <Link
              to="/kiosk"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm font-bold bg-teal-500 text-slate-950 hover:bg-teal-400 shadow-xl shadow-teal-500/25 flex items-center justify-center space-x-2 transition-all transform hover:-translate-y-0.5"
            >
              <Mic className="w-4 h-4" />
              <span>Launch Patient Kiosk Demo</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/navigator"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-semibold bg-slate-800 text-amber-300 hover:bg-slate-700 border border-slate-700 flex items-center justify-center space-x-2 transition-all"
            >
              <UserCheck className="w-4 h-4 text-amber-400" />
              <span>Navigator Workbench</span>
            </Link>

            <Link
              to="/doctor"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 flex items-center justify-center space-x-2 transition-all"
            >
              <Stethoscope className="w-4 h-4 text-teal-400" />
              <span>Doctor Portal</span>
            </Link>

            <Link
              to="/admin"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 flex items-center justify-center space-x-2 transition-all"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>SIH Pitch Defense</span>
            </Link>
          </div>

          {/* Central Message Callout (Section 25) */}
          <div className="inline-block p-4 rounded-2xl bg-teal-500/5 border border-teal-500/20 text-xs text-teal-300 font-semibold max-w-xl mx-auto">
            “Automate the routine. Escalate the uncertain. Verify the important. Keep the clinician in control.”
          </div>

        </div>
      </section>

      {/* Root-Cause & Problem Definition (Section 2) */}
      <section className="py-16 bg-slate-950 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-1">Operational Root-Cause Analysis</h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-white">Targeting the Pre-Consultation Information Bottleneck</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center font-bold">1</div>
              <h3 className="text-base font-bold text-white">Unstructured History</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Patients explain stories in disordered sequences during rushed OPD visits, leading to forgotten chronic conditions or missed red flags.
              </p>
              <div className="text-[11px] text-teal-400 font-semibold pt-1 border-t border-slate-800">
                &rarr; MediKiosk conducts guided, adaptive intake before the consultation.
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center font-bold">2</div>
              <h3 className="text-base font-bold text-white">Paper Record Fragmentation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Old prescriptions and lab reports are carried as loose papers, taking up precious doctor consultation time to decipher or locate.
              </p>
              <div className="text-[11px] text-teal-400 font-semibold pt-1 border-t border-slate-800">
                &rarr; High-speed camera OCR extracts medications and builds a chronological index.
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center font-bold">3</div>
              <h3 className="text-base font-bold text-white">Silent Kiosk Failure</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Standalone AI kiosks fail when encountering low literacy, dialects, or messy handwriting, stranding vulnerable patients.
              </p>
              <div className="text-[11px] text-amber-400 font-semibold pt-1 border-t border-slate-800">
                &rarr; Assistance Score routes exceptions to Tier 1 &amp; Tier 2 Navigators.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Tier Human Support Model (Section 8 of Document) */}
      <section className="py-16 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-1">Human-in-the-Loop Architecture</h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-white">3-Tier Workforce &amp; Scope of Practice</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Tier 1 Support</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">OPD Floor</span>
              </div>
              <h3 className="text-lg font-bold text-white">Patient Navigator</h3>
              <p className="text-xs text-slate-300">
                Assists with touchscreen navigation, document camera positioning, regional language support, and patient reassurance.
              </p>
              <div className="text-[11px] text-red-400 font-semibold bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                PROHIBITED: Independent diagnosis, prescribing, or clinical decisions.
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Tier 2 Support</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">Remote Hub</span>
              </div>
              <h3 className="text-lg font-bold text-white">Documentation Reviewer</h3>
              <p className="text-xs text-slate-300">
                Reviews blurry OCR prescriptions, reconciles conflicting medication doses, and resolves intake-quality exceptions in queue.
              </p>
              <div className="text-[11px] text-red-400 font-semibold bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                PROHIBITED: Autonomous prescribing or replacing treating clinician.
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-teal-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">Tier 3 Decision</span>
                <span className="text-[10px] bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded font-mono">Consult Room</span>
              </div>
              <h3 className="text-lg font-bold text-white">Licensed Clinician</h3>
              <p className="text-xs text-slate-300">
                Receives concise, pre-structured SOAP summary with full provenance. Evaluates patient, diagnoses, and prescribes.
              </p>
              <div className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                MANDATORY: Final clinical judgment and responsibility remains with the doctor.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 11-Stage Interactive Stepper Preview */}
      <section className="py-16 bg-slate-950 border-b border-slate-800 text-center">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-2">Live Demonstration Protocol</h2>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mb-6">Tested 11-Stage End-to-End Workflow</p>
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed text-left space-y-2 font-mono">
            <div>1. Patient Kiosk Opens &rarr; Guided intake starts</div>
            <div>2. Regional Language + Audio selection &rarr; Accessibility guaranteed</div>
            <div>3. AI Clinical Interview &rarr; Adaptive questioning (Chief Complaint, HPI, Past History)</div>
            <div>4. Document Scan &rarr; OCR extracts medications and builds chronological index</div>
            <div>5. Normal Case &rarr; High confidence (&gt;85%) proceeds automatically</div>
            <div>6. Low Confidence Case &rarr; AI detects uncertainty (Assistance Score &lt;65%)</div>
            <div>7. Task Router &rarr; Exception assigned to Tier 1 or Tier 2 Navigator</div>
            <div>8. Navigator Dashboard &rarr; Staff receives exact failed step and bounding box</div>
            <div>9. Screen Takeover &rarr; Human verifies/corrects dosage &rarr; Provenance updated</div>
            <div>10. Doctor Dashboard &rarr; Pre-consultation SOAP summary delivered</div>
            <div>11. Audit View &rarr; DISHA-compliant log showing AI vs Human actions</div>
          </div>
        </div>
      </section>

    </div>
  );
};
