import React from 'react';
import { Activity, ShieldCheck, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <Activity className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg text-white">MediKiosk</span>
            </div>
            <p className="text-slate-400 max-w-sm text-xs leading-relaxed">
              AI-Powered Multilingual Clinical Patient Intake Platform for Ayushman Bharat public healthcare facilities. Purpose-built to reduce OPD waiting times and capture high-accuracy structured clinical history.
            </p>
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>100% Local-First / Air-gapped Deployment Option</span>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Application Portals</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/kiosk" className="hover:text-teal-400 transition-colors">Patient Kiosk (/kiosk)</Link></li>
              <li><Link to="/navigator" className="hover:text-teal-400 transition-colors">Navigator Dashboard (/navigator)</Link></li>
              <li><Link to="/doctor" className="hover:text-teal-400 transition-colors">Doctor Dashboard (/doctor)</Link></li>
              <li><Link to="/admin" className="hover:text-teal-400 transition-colors">Admin & System Health (/admin)</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Tech Architecture</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>• Sarvam AI / Whisper STT</li>
              <li>• Local LLM (Ollama/Llama/Gemma)</li>
              <li>• FastAPI & PostgreSQL pgvector</li>
              <li>• FHIR R4 & ABDM Adapter</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-900 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>© {new Date().getFullYear()} MediKiosk · Smart India Hackathon Prototype</p>
          <p className="flex items-center space-x-1 mt-2 sm:mt-0">
            <span>Made with</span>
            <Heart className="w-3.5 h-3.5 text-red-500 fill-current" />
            <span>for Indian Healthcare</span>
          </p>
        </div>
      </div>
    </footer>
  );
};
