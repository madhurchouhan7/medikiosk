import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Globe2, Mic, MicOff, Volume2, Check, X, ArrowRight,
  HelpCircle, Camera, FileText, AlertTriangle, CheckCircle2,
  ShieldCheck, Activity, AlertOctagon, ChevronRight, Upload,
  Search, UserPlus, Heart, RefreshCw, VolumeX, Loader2,
  File as FileIcon, Eye, Trash2, Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LANGUAGES, UI_STRINGS } from '../../i18n/languages';
import type { LanguageCode, Question, ExtractedEntity, Patient } from '../../types';
import { ApiService } from '../../services/api';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { useTTS, useSTT } from '../../hooks/useSpeech';

// ─── Types ────────────────────────────────────────────────────────────────────
type KioskStep = 'language' | 'abha' | 'abha_create' | 'consent' | 'abha_records' | 'interview' | 'documents' | 'review' | 'complete';
type SpeechState = 'IDLE' | 'LISTENING' | 'TRANSCRIBING' | 'THINKING' | 'ASKING';

interface AbhaRecord {
  type: string;
  date: string;
  doctor: string;
  facility: string;
  summary: string;
  medications?: string[];
  tests?: string[];
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

// ─── Mini Toast Component ─────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium pointer-events-auto max-w-sm
            ${t.type === 'success' ? 'bg-emerald-600 text-white' :
              t.type === 'error' ? 'bg-red-600 text-white' :
              t.type === 'warning' ? 'bg-amber-500 text-slate-900' :
              'bg-slate-700 text-white'}`}
        >
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {t.type === 'error' && <X className="w-4 h-4 shrink-0" />}
          {t.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
          {t.type === 'info' && <Activity className="w-4 h-4 shrink-0" />}
          <span>{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="ml-auto opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── KioskContainer ───────────────────────────────────────────────────────────
export const KioskContainer: React.FC = () => {
  // ── Core State ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<KioskStep>('language');
  const [lang, setLang] = useState<LanguageCode>('hi');
  const [sessionId, setSessionId] = useState<string>('');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [assistanceScore, setAssistanceScore] = useState<number>(1.0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── ABHA State ──────────────────────────────────────────────────────────────
  const [abhaMode, setAbhaMode] = useState<'unknown' | 'have' | 'create'>('unknown');
  const [abhaInput, setAbhaInput] = useState('');
  const [abhaLookupLoading, setAbhaLookupLoading] = useState(false);
  const [abhaRecords, setAbhaRecords] = useState<AbhaRecord[]>([]);
  // ABHA Create form
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newGender, setNewGender] = useState('Male');
  const [newPhone, setNewPhone] = useState('');
  const [newDob, setNewDob] = useState('');

  // ── Interview State ─────────────────────────────────────────────────────────
  const [speechState, setSpeechState] = useState<SpeechState>('IDLE');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [interviewHistory, setInterviewHistory] = useState<Array<{ q: string; a: string; category: string; confidence?: number }>>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micSeconds, setMicSeconds] = useState(0);
  const micTimerRef = useRef<any>(null);
  const [ttsActive, setTtsActive] = useState(false);

  // ── Document State ──────────────────────────────────────────────────────────
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntity[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isLowConf, setIsLowConf] = useState(false);
  const [hasRedFlag, setHasRedFlag] = useState(false);
  const [ocrRawText, setOcrRawText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Complete State ──────────────────────────────────────────────────────────
  const [resetCountdown, setResetCountdown] = useState(15);

  // ── Hooks ───────────────────────────────────────────────────────────────────
  const recorder = useVoiceRecorder();
  const tts = useTTS();
  const stt = useSTT();
  const strings = UI_STRINGS[lang] || UI_STRINGS['en'];

  // ── Toast helpers ───────────────────────────────────────────────────────────
  const addToast = useCallback((type: Toast['type'], message: string, duration = 4000) => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── TTS helper: read question aloud ─────────────────────────────────────────
  const readQuestionAloud = useCallback((question: Question) => {
    const text = question.text[lang] || question.text['en'];
    setTtsActive(true);
    tts.speak(text, lang, () => setTtsActive(false));
  }, [lang, tts]);

  // ── Step 1: Language Selection ───────────────────────────────────────────────
  const handleSelectLanguage = (code: LanguageCode) => {
    setLang(code);
    setStep('abha');
  };

  // ── Step 2: ABHA Lookup ──────────────────────────────────────────────────────
  const handleAbhaLookup = async () => {
    if (!abhaInput.trim()) {
      addToast('warning', 'Please enter your ABHA ID');
      return;
    }
    setAbhaLookupLoading(true);
    try {
      const result = await ApiService.lookupABHA(abhaInput.trim());
      if (result.found && result.patient) {
        setPatient(result.patient as Patient);
        if (result.abha_health_records?.length) {
          setAbhaRecords(result.abha_health_records as AbhaRecord[]);
        }
        // Create session with found patient data
        const session = await ApiService.createSession(lang, result.patient.abha_id, result.patient.name, result.patient.age, result.patient.gender);
        setSessionId(session.id);
        addToast('success', `Welcome back, ${result.patient.name}!`);
        if (result.abha_health_records?.length) {
          setStep('abha_records');
        } else {
          setStep('consent');
        }
      } else {
        addToast('info', 'ABHA ID not found. You can create a new one or proceed as walk-in.');
      }
    } catch {
      addToast('error', 'Could not connect to ABHA portal. Please try again.');
    } finally {
      setAbhaLookupLoading(false);
    }
  };

  const handleSkipAbha = async () => {
    // Create a session without ABHA
    const session = await ApiService.createSession(lang);
    setSessionId(session.id);
    setPatient(session.patient);
    setStep('consent');
  };

  // ── Step 2b: Create ABHA ─────────────────────────────────────────────────────
  const handleCreateAbha = async () => {
    if (!newName || !newAge || !newPhone) {
      addToast('warning', 'Please fill in name, age, and phone number');
      return;
    }
    setAbhaLookupLoading(true);
    try {
      const result = await ApiService.createABHA(newName, parseInt(newAge), newGender, newPhone, newDob);
      setPatient(result.patient as Patient);
      const session = await ApiService.createSession(lang, result.abha_id, newName, parseInt(newAge), newGender);
      setSessionId(session.id);
      addToast('success', `ABHA ID created: ${result.abha_id}`);
      setStep('consent');
    } catch {
      addToast('error', 'Could not create ABHA ID. Please try again.');
    } finally {
      setAbhaLookupLoading(false);
    }
  };

  // ── Step 3: Consent → Start Interview ────────────────────────────────────────
  const handleConsent = async () => {
    setStep('interview');
    try {
      const res = await ApiService.startInterview(sessionId || 'session-demo');
      setCurrentQuestion(res.question);
      setSpeechState('ASKING');
      // Auto-read question after short delay
      setTimeout(() => readQuestionAloud(res.question), 500);
    } catch {
      addToast('error', 'Could not start interview. Please try again.');
    }
  };

  // Read consent text aloud
  const handleReadConsent = () => {
    const text = strings.consentText;
    setTtsActive(true);
    tts.speak(text, lang, () => setTtsActive(false));
  };

  // ── Step 4: Voice Interview ──────────────────────────────────────────────────
  const handleStartListening = () => {
    if (recorder.isRecording || speechState === 'LISTENING') return;
    setSpeechState('LISTENING');
    setLiveTranscript('');
    setMicSeconds(0);

    // Start mic timer
    micTimerRef.current = setInterval(() => {
      setMicSeconds(s => {
        if (s >= 15) {
          // Auto-stop after 15 seconds
          handleStopListening();
          return 15;
        }
        return s + 1;
      });
    }, 1000);

    // Try Web Speech API first for live transcript
    if (stt.isSupported) {
      stt.start(lang, (result) => {
        setLiveTranscript(result.transcript);
        if (result.isFinal) {
          handleStopListening(result.transcript, result.confidence);
        }
      }, () => {
        if (speechState === 'LISTENING') {
          handleStopListening(liveTranscript);
        }
      });
    } else {
      // Fallback: use MediaRecorder for audio capture
      recorder.startRecording();
    }
  };

  const handleStopListening = useCallback((finalTranscript?: string, confidence?: number) => {
    clearInterval(micTimerRef.current);
    stt.stop();
    if (recorder.isRecording) recorder.stopRecording();

    const text = finalTranscript || liveTranscript;
    if (text.trim()) {
      handleAnswerSubmit(text.trim(), confidence);
    } else {
      setSpeechState('ASKING');
      addToast('info', 'No speech detected. Please tap the mic and speak.');
    }
  }, [liveTranscript, recorder, stt]);

  const handleAnswerSubmit = async (answer: string, sttConf?: number) => {
    if (!currentQuestion) return;
    tts.cancel();
    setTtsActive(false);
    setSpeechState('THINKING');
    setLiveTranscript('');

    const isChestPain = /chest pain|seene mein dard|crushing|heart pain/i.test(answer);
    if (isChestPain) setHasRedFlag(true);

    try {
      const res = await ApiService.submitInterviewResponse(
        sessionId || 'session-demo',
        currentQuestion.question_id,
        currentQuestion.category,
        answer
      );

      setAssistanceScore(res.assistance_score);
      setInterviewHistory(prev => [...prev, {
        q: currentQuestion.text[lang] || currentQuestion.text['en'],
        a: answer,
        category: currentQuestion.category,
        confidence: sttConf,
      }]);

      if (res.next_question) {
        setCurrentQuestion(res.next_question);
        setSpeechState('ASKING');
        setTimeout(() => readQuestionAloud(res.next_question!), 400);
      } else {
        setSpeechState('IDLE');
        setStep('documents');
        addToast('success', 'Interview complete! Please scan or upload your documents.');
      }
    } catch {
      setSpeechState('ASKING');
      addToast('error', 'Error processing response. Please try again.');
    }
  };

  // ── Step 5: Document Scanner ─────────────────────────────────────────────────
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploadedFiles(prev => [...prev, file]);
    setOcrProcessing(true);
    addToast('info', 'Processing document...');

    try {
      const res = await ApiService.processDocument(sessionId || 'session-demo', 'PRESCRIPTION', file);
      setExtractedEntities(res.entities || []);
      setIsLowConf(res.requires_verification || false);
      setAssistanceScore(res.assistance_score || 1.0);
      setOcrRawText(res.raw_text || '');

      if (res.requires_verification) {
        addToast('warning', 'Low OCR confidence detected — task sent to human reviewer');
      } else {
        addToast('success', `Extracted ${res.entities?.length || 0} medication(s) with ${Math.round(res.overall_confidence * 100)}% confidence`);
      }
      setStep('review');
    } catch {
      addToast('error', 'Document processing failed. Please try again.');
    } finally {
      setOcrProcessing(false);
    }
  };

  const handleSkipDocuments = () => {
    addToast('info', 'Proceeding without document scan.');
    setStep('review');
  };

  // ── Step 6: Complete Session ──────────────────────────────────────────────────
  const handleCompleteSession = async () => {
    try {
      await ApiService.getSummary(sessionId || 'session-demo');
    } catch { /* summary will be generated on doctor view */ }
    setStep('complete');
    addToast('success', 'Your intake is complete! Please wait to be called.');
  };

  // ── Need Help ────────────────────────────────────────────────────────────────
  const handleNeedHelp = async () => {
    try {
      await ApiService.processDocument(sessionId || 'session-demo', 'HELP_REQUEST', 'patient_requested_help.jpg');
    } catch { /* ignore */ }
    setAssistanceScore(0.0);
    addToast('warning', 'Staff assistance requested — a navigator will assist you shortly at this kiosk.');
  };

  // ── Reset Countdown ──────────────────────────────────────────────────────────
  useEffect(() => {
    let timer: any;
    if (step === 'complete') {
      setResetCountdown(15);
      timer = setInterval(() => {
        setResetCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // Reset all state
            setStep('language');
            setInterviewHistory([]);
            setExtractedEntities([]);
            setLiveTranscript('');
            setAssistanceScore(1.0);
            setPatient(null);
            setSessionId('');
            setAbhaInput('');
            setAbhaMode('unknown');
            setAbhaRecords([]);
            setHasRedFlag(false);
            setIsLowConf(false);
            setUploadedFiles([]);
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(micTimerRef.current);
      tts.cancel();
      stt.stop();
    };
  }, []);

  // ─── Score color ─────────────────────────────────────────────────────────────
  const scoreColor = assistanceScore >= 0.85 ? 'text-emerald-400' : assistanceScore >= 0.65 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="fixed inset-0 bg-[#0f1117] text-white flex flex-col font-sans select-none overflow-hidden">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-[#151820] border-b border-white/5 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">MediKiosk</div>
            <div className="text-[10px] text-slate-500">OPD Terminal · {lang.toUpperCase()}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Assistance score */}
          {step !== 'language' && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-slate-500">Confidence</span>
              <span className={`font-bold ${scoreColor}`}>{Math.round(assistanceScore * 100)}%</span>
            </div>
          )}

          {/* TTS indicator */}
          {ttsActive && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20">
              <Volume2 className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
              <span className="text-[10px] text-teal-400 font-medium">Speaking</span>
            </div>
          )}

          <button
            onClick={handleNeedHelp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Need Help</span>
          </button>

          <button
            onClick={() => setStep('language')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-medium transition-colors"
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span className="uppercase">{lang}</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-2xl">

          {/* ══ STEP 1: LANGUAGE ══════════════════════════════════════════════ */}
          {step === 'language' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-teal-500 flex items-center justify-center mx-auto mb-3">
                  <Globe2 className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">Select Language</h1>
                <p className="text-sm text-slate-400">अपनी भाषा चुनें / Choose your preferred language</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => handleSelectLanguage(l.code)}
                    className="group p-4 rounded-2xl bg-[#1a1f2a] border border-white/5 hover:border-teal-500/50 hover:bg-[#1e2435] transition-all flex flex-col items-center gap-2 active:scale-95"
                  >
                    <span className="text-2xl">{l.flag}</span>
                    <span className="text-sm font-bold text-white group-hover:text-teal-400 transition-colors">{l.nativeName}</span>
                    <span className="text-[10px] text-slate-500">{l.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══ STEP 2: ABHA IDENTIFICATION ══════════════════════════════════ */}
          {step === 'abha' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-6 h-6 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-white">{strings.abhaTitle}</h2>
                <p className="text-sm text-slate-400">{strings.abhaSubtitle}</p>
              </div>

              {abhaMode === 'unknown' && (
                <div className="space-y-3">
                  <p className="text-center text-sm text-slate-400">Do you have an ABHA (Ayushman Bharat Health Account) ID?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setAbhaMode('have')}
                      className="p-5 rounded-2xl bg-[#1a1f2a] border border-white/5 hover:border-teal-500/40 hover:bg-[#1e2435] transition-all text-center space-y-2 active:scale-95"
                    >
                      <ShieldCheck className="w-8 h-8 text-teal-400 mx-auto" />
                      <div className="font-bold text-white text-sm">Yes, I have ABHA ID</div>
                      <div className="text-[11px] text-slate-500">हाँ, मेरे पास आभा आईडी है</div>
                    </button>
                    <button
                      onClick={() => setAbhaMode('create')}
                      className="p-5 rounded-2xl bg-[#1a1f2a] border border-white/5 hover:border-blue-500/40 hover:bg-[#1e2435] transition-all text-center space-y-2 active:scale-95"
                    >
                      <UserPlus className="w-8 h-8 text-blue-400 mx-auto" />
                      <div className="font-bold text-white text-sm">No, register new</div>
                      <div className="text-[11px] text-slate-500">नया पंजीकरण करें</div>
                    </button>
                  </div>
                  <button
                    onClick={handleSkipAbha}
                    className="w-full py-3 rounded-xl text-slate-500 hover:text-slate-300 text-sm transition-colors"
                  >
                    Skip — Proceed as Walk-in Patient →
                  </button>
                </div>
              )}

              {abhaMode === 'have' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-400">ABHA ID</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={abhaInput}
                        onChange={e => setAbhaInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAbhaLookup()}
                        placeholder="91-XXXX-XXXX-XXXX"
                        className="flex-1 px-4 py-3 rounded-xl bg-[#1a1f2a] border border-white/10 text-teal-400 font-mono text-lg font-bold placeholder:text-slate-600 focus:border-teal-500 focus:outline-none"
                      />
                      <button
                        onClick={handleAbhaLookup}
                        disabled={abhaLookupLoading}
                        className="px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold disabled:opacity-50 transition-colors flex items-center gap-2"
                      >
                        {abhaLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        <span className="hidden sm:inline">{abhaLookupLoading ? 'Looking up...' : 'Find'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">Try: 91-8823-9912-4012 or 91-1122-3344-5566</p>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setAbhaMode('unknown')} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-sm transition-colors">
                      ← Back
                    </button>
                    <button onClick={handleSkipAbha} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-sm transition-colors">
                      Skip → Walk-in
                    </button>
                  </div>
                </div>
              )}

              {abhaMode === 'create' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Full Name *</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="Rajesh Kumar"
                        className="w-full px-3 py-2.5 rounded-xl bg-[#1a1f2a] border border-white/10 text-white text-sm focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Age *</label>
                      <input
                        type="number"
                        value={newAge}
                        onChange={e => setNewAge(e.target.value)}
                        placeholder="45"
                        className="w-full px-3 py-2.5 rounded-xl bg-[#1a1f2a] border border-white/10 text-white text-sm focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Gender *</label>
                      <select
                        value={newGender}
                        onChange={e => setNewGender(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#1a1f2a] border border-white/10 text-white text-sm focus:border-teal-500 focus:outline-none"
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Phone *</label>
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-3 py-2.5 rounded-xl bg-[#1a1f2a] border border-white/10 text-white text-sm focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Date of Birth</label>
                      <input
                        type="date"
                        value={newDob}
                        onChange={e => setNewDob(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#1a1f2a] border border-white/10 text-white text-sm focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setAbhaMode('unknown')} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-sm">
                      ← Back
                    </button>
                    <button
                      onClick={handleCreateAbha}
                      disabled={abhaLookupLoading}
                      className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      {abhaLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      {abhaLookupLoading ? 'Creating...' : 'Create ABHA ID & Continue'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ STEP 2c: ABHA HEALTH RECORDS ═════════════════════════════════ */}
          {step === 'abha_records' && patient && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20">
                <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-white">{patient.name}</div>
                  <div className="text-xs text-slate-400">{patient.age} yrs · {patient.gender} · ABHA: {patient.abha_id}</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white">Health Records from ABHA Portal</h3>
                  <span className="text-[10px] text-teal-400 font-medium">{abhaRecords.length} records found</span>
                </div>
                <div className="space-y-2">
                  {abhaRecords.map((rec, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-[#1a1f2a] border border-white/5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase
                              ${rec.type === 'PRESCRIPTION' ? 'bg-blue-500/20 text-blue-400' :
                                rec.type === 'LAB_REPORT' ? 'bg-purple-500/20 text-purple-400' :
                                'bg-amber-500/20 text-amber-400'}`}>
                              {rec.type.replace('_', ' ')}
                            </span>
        