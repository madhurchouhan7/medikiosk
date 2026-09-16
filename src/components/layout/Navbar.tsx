import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, UserCheck, Stethoscope } from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const isKiosk = location.pathname.startsWith('/kiosk');
  const isPortal = location.pathname.startsWith('/navigator') || location.pathname.startsWith('/doctor') || location.pathname.startsWith('/admin');

  // Portal pages have their own headers
  if (isKiosk || isPortal) return null;

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-700 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" aria-hidden />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg text-slate-900 tracking-tight">Niramaya</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">
                ABDM Enabled
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-none mt-0.5">Clinical intake · Hospital OPD</p>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600" aria-label="Primary">
          <a href="#how-it-works" className="hover:text-slate-900">How it works</a>
          <a href="#capabilities" className="hover:text-slate-900">Capabilities</a>
          <a href="#safety" className="hover:text-slate-900">Safety</a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/navigator"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50"
          >
            <UserCheck className="w-4 h-4" aria-hidden />
            <span>Navigator</span>
          </Link>
          <Link
            to="/doctor"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50"
          >
            <Stethoscope className="w-4 h-4" aria-hidden />
            <span>Doctor</span>
          </Link>
          <Link
            to="/kiosk"
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-teal-700 text-white hover:bg-teal-800"
          >
            Start kiosk demo
          </Link>
        </div>
      </div>
    </header>
  );
};
