import React from 'react';
import { Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" aria-hidden />
              </div>
              <span className="font-semibold text-slate-900">MediKiosk</span>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed max-w-md">
              AI-assisted clinical intake for hospital OPDs. Structured history-taking,
              document digitisation, and human-verified summaries — with the
              physician in control.
            </p>
            <p className="text-xs text-slate-500 mt-3">
              Prototype for evaluation. Local-first deployment option. No diagnosis or prescribing by AI.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-xs uppercase tracking-wide">Portals</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><Link to="/kiosk" className="hover:text-teal-700">Patient kiosk</Link></li>
              <li><Link to="/navigator" className="hover:text-teal-700">Navigator workbench</Link></li>
              <li><Link to="/doctor" className="hover:text-teal-700">Doctor summary</Link></li>
              <li><Link to="/admin" className="hover:text-teal-700">Administration</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-xs uppercase tracking-wide">Assurance</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>Consent before intake</li>
              <li>AI-extracted vs human-verified labels</li>
              <li>Confidence-based escalation</li>
              <li>Audit trail for every action</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} MediKiosk · Clinical intake prototype</p>
          <p>For hospital evaluation use. Patient data handling per institutional policy.</p>
        </div>
      </div>
    </footer>
  );
};
