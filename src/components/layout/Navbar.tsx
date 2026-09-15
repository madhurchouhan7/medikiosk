import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Shield, UserCheck, Stethoscope, Settings, Play } from 'lucide-react';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const isKiosk = location.pathname.startsWith('/kiosk');

  if (isKiosk) return null; // Kiosk mode has dedicated full-screen header

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      {/* Tricolor Strip */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-white to-emerald-500" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo Section */}
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:bg-teal-500/20 transition-all">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xl text-white tracking-tight">MediKiosk</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                ABDM Enabled
              </span>
            </div>
            <p className="text-xs text-slate-400">Ayushman Bharat · AI Patient Intake</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-300">
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a>
          <a href="#technology" className="hover:text-white transition-colors">Tech Stack</a>
          <a href="#security" className="hover:text-white transition-colors">Security</a>
        </nav>

        {/* Portal Action CTAs */}
        <div className="flex items-center space-x-3">
          <Link
            to="/navigator"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all"
          >
            <UserCheck className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Navigator Portal</span>
          </Link>

          <Link
            to="/doctor"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all"
          >
            <Stethoscope className="w-4 h-4 text-teal-400" />
            <span className="hidden sm:inline">Doctor Portal</span>
          </Link>

          <Link
            to="/kiosk"
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 shadow-lg shadow-teal-500/20 transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Launch Kiosk</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
