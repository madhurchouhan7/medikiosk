import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Globe2, Mic, MicOff, Volume2, Check, X, ArrowRight,
  HelpCircle, FileText, AlertTriangle, CheckCircle2,
  ShieldCheck, Activity, AlertOctagon, Upload,
  Search, UserPlus, Loader2,
  File as FileIcon, Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { LANGUAGES, UI_STRINGS } from '../../i18n/languages';
import type { LanguageCode, Question, ExtractedEntity, Patient } from '../../types';
import { ApiService, ApiError, newIdempotencyKey } from '../../services/api';
import {
  saveSnapshot, loadSnapshot, clearSnapshot, enqueueOp,
  fileToBase64, processOutbox, useOnlineStatus,
} from '../../services/offline';
import { nextLocalQuestion } from '../../services/localInterview';
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

const STEP_ORDER: KioskStep[] = ['language', 'abha', 'consent', 'interview', 'documents', 'review', 'complete'];
const STEP_LABELS: Record<string, string> = {
  language: 'Language', abha: 'Identity', abha_create: 'Identity', consent: 'Consent',
  abha_records: 'Records', interview: 'Questions', documents: 'Documents', review: 'Review', complete: 'Done',
};

function stepIndex(step: KioskStep): number {
  if (step === 'abha_create' || step === 'abha_records') return 1;
  return STEP_ORDER.indexOf(step);
}

// ─── Toast (light, clinical) ──────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2" role="status" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-2.5 px-4 py-3 rounded-lg shadow-raised border text-sm max-w-sm bg-white
            ${t.type === 'success' ? 'border-slate-200 border-l-4 border-l-emerald-600 text-slate-800' :
              t.type === 'error' ? 'border-slate-200 border-l-4 border-l-red-600 text-slate-800' :
              t.type === 'warning' ? 'border-slate-200 border-l-4 border-l-amber-500 text-slate-800' :
              'border-slate-200 border-l-4 border-l-teal-700 text-slate-800'}`}
        >
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-700 shrink-0" />}
          {t.type === 'error' && <X className="w-4 h-4 mt-0.5 text-red-700 shrink-0" />}
          {t.type === 'warning' && <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />}
          {t.type === 'info' && <Activity className="w-4 h-4 mt-0.5 text-teal-700 shrink-0" />}
          <span className="flex-1 leading-snug">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="text-slate-400 hover:text-slate-700" aria-label="Dismiss notification">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Progress indicator ───────────────────────────────────────────────────────
function KioskProgress({ step }: { step: KioskStep }) {
  const idx = stepIndex(step);
  return (
    <nav aria-label="Intake progress" className="w-full">
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {STEP_ORDER.map((s, i) => (
          <li key={s} className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 border
                  ${i < idx ? 'bg-teal-700 border-teal-700 text-white' :
                    i === idx ? 'bg-white border-teal-700 text-teal-700 border-2' :
                    'bg-white border-slate-300 text-slate-400'}`}
                aria-current={i === idx ? 'step' : undefined}
              >
                {i < idx ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className={`hidden md:block text-xs truncate ${i === idx ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                {STEP_LABELS[s]}
              </span>
            </div>
            <div className={`h-1 rounded-full mt-1.5 ${i <= idx ? 'bg-teal-700' : 'bg-slate-200'}`} />
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ─── KioskContainer ───────────────────────────────────────────────────────────
export const KioskContainer: React.FC = () => {
  const [step, setStep] = useState<KioskStep>('language');
  const [lang, setLang] = useState<LanguageCode>('hi');
  const [sessionId, setSessionId] = useState<string>('');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [assistanceScore, setAssistanceScore] = useState<number>(1.0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [abhaMode, setAbhaMode] = useState<'unknown' | 'have' | 'create'>('unknown');
  const [abhaInput, setAbhaInput] = useState('');
  const [abhaLookupLoading, setAbhaLookupLoading] = useState(false);
  const [abhaRecords, setAbhaRecords] = useState<AbhaRecord[]>([]);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newGender, setNewGender] = useState('Male');
  const [newPhone, setNewPhone] = useState('');
  const [newDob, setNewDob] = useState('');

  const [speechState, setSpeechState] = useState<SpeechState>('IDLE');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [interviewHistory, setInterviewHistory] = useState<Array<{ q: string; a: string; category: string; confidence?: number }>>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micSeconds, setMicSeconds] = useState(0);
  const micTimerRef = useRef<any>(null);
  const [ttsActive, setTtsActive] = useState(false);

  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntity[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isLowConf, setIsLowConf] = useState(false);
  const [hasRedFlag, setHasRedFlag] = useState(false);
  const [ocrRawText, setOcrRawText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resetCountdown, setResetCountdown] = useState(15);

  const recorder = useVoiceRecorder();
  const tts = useTTS();
  const stt = useSTT();
  const strings = UI_STRINGS[lang] || UI_STRINGS['en'];

  const addToast = useCallback((type: Toast['type'], message: string, duration = 4000) => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const readQuestionAloud = useCallback((question: Question) => {
    const text = question.text[lang] || question.text['en'];
    setTtsActive(true);
    tts.speak(text, lang, () => setTtsActive(false));
  }, [lang, tts]);

  const handleSelectLanguage = (code: LanguageCode) => {
    setLang(code);
    setStep('abha');
  };

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
        const session = await ApiService.createSession(lang, result.patient.abha_id, result.patient.name, result.patient.age, result.patient.gender, result.patient.phone);
        setSessionId(session.id);
        addToast('success', `Welcome back, ${result.patient.name}. Your records were found.`);
        if (result.abha_health_records?.length) {
          setStep('abha_records');
        } else {
          setStep('consent');
        }
      } else {
        addToast('info', 'ABHA ID not found. You can register as a new patient or continue as walk-in.');
      }
    } catch (e) {
      addToast('error', e instanceof ApiError ? e.message : 'Could not reach the patient registry. Check the connection and try again.');
    } finally {
      setAbhaLookupLoading(false);
    }
  };

  const handleSkipAbha = async () => {
    try {
      const session = await ApiService.createSession(lang);
      setSessionId(session.id);
      setPatient(session.patient);
      setStep('consent');
    } catch (e) {
      addToast('error', e instanceof ApiError ? e.message : 'Could not start a session. Check the connection and try again.');
    }
  };

  const handleCreateAbha = async () => {
    if (!newName || !newAge || !newPhone) {
      addToast('warning', 'Please fill in name, age, and phone number');
      return;
    }
    setAbhaLookupLoading(true);
    try {
      const result = await ApiService.createABHA(newName, parseInt(newAge), newGender, newPhone, newDob);
      setPatient(result.patient as Patient);
      const session = await ApiService.createSession(lang, result.abha_id, newName, parseInt(newAge), newGender, newPhone);
      setSessionId(session.id);
      setPatient(session.patient);
      addToast('success', `ABHA ID created: ${result.abha_id}`);
      setStep('consent');
    } catch (e) {
      addToast('error', e instanceof ApiError ? e.message : 'Could not create ABHA ID. Please try again.');
    } finally {
      setAbhaLookupLoading(false);
    }
  };

  const handleConsent = async () => {
    if (!sessionId) {
      addToast('error', 'Session not ready. Please identify the patient first.');
      return;
    }
    answeredIdsRef.current = [];
    setStep('interview');
    try {
      const res = await ApiService.startInterview(sessionId);
      setCurrentQuestion(res.question);
      setSpeechState('ASKING');
      setTimeout(() => readQuestionAloud(res.question), 500);
    } catch (e) {
      if (e instanceof ApiError && e.offline) {
        // Start locally; answers queue and sync later.
        const first = nextLocalQuestion([]);
        setCurrentQuestion(first);
        setSpeechState('ASKING');
        setContinuedOffline(true);
        addToast('warning', 'Starting offline. Your answers are saved on this kiosk and will sync automatically.');
      } else {
        addToast('error', e instanceof ApiError ? e.message : 'Could not start the interview. Please try again.');
      }
    }
  };

  const handleReadConsent = () => {
    const text = strings.consentText;
    setTtsActive(true);
    tts.speak(text, lang, () => setTtsActive(false));
  };

  const handleStartListening = () => {
    if (recorder.isRecording || speechState === 'LISTENING') return;
    setSpeechState('LISTENING');
    setLiveTranscript('');
    setMicSeconds(0);

    micTimerRef.current = setInterval(() => {
      setMicSeconds(s => {
        if (s >= 15) {
          handleStopListening();
          return 15;
        }
        return s + 1;
      });
    }, 1000);

    if (stt.isSupported) {
      stt.start(lang, (result) => {
        setLiveTranscript(result.transcript);
        if (result.isFinal) {
          handleStopListening(result.transcript, result.confidence);
        }
      }, () => {
        handleStopListening(liveTranscript);
      });
    } else {
      recorder.startRecording();
    }
  };

  const answeredIdsRef = useRef<string[]>([]);
  const appendHistory = useCallback((question: Question, answer: string, sttConf?: number) => {
    if (!answeredIdsRef.current.includes(question.question_id)) {
      answeredIdsRef.current.push(question.question_id);
    }
    setInterviewHistory(prev => [...prev, {
      q: question.text[lang] || question.text['en'],
      a: answer,
      category: question.category,
      confidence: sttConf,
    }]);
  }, [lang]);

  const advanceOffline = useCallback((question: Question, answer: string) => {
    // No connection: keep the interview moving locally in category order.
    // The answer is queued for the server; wording resyncs on reconnect.
    appendHistory(question, answer);
    const next = nextLocalQuestion(answeredIdsRef.current);
    if (next) {
      setCurrentQuestion(next);
      setSpeechState('ASKING');
      setTimeout(() => readQuestionAloud(next), 400);
    } else {
      setSpeechState('IDLE');
      setStep('documents');
    }
  }, [appendHistory, readQuestionAloud]);

  const handleStopListening = useCallback((finalTranscript?: string, confidence?: number) => {
    clearInterval(micTimerRef.current);
    stt.stop();
    const wasRecordingFallback = recorder.isRecording;
    if (recorder.isRecording) recorder.stopRecording();

    const text = (finalTranscript || liveTranscript).trim();
    if (text) {
      handleAnswerSubmit(text, confidence);
    } else if (wasRecordingFallback) {
      // Web Speech unavailable/failed: send raw audio to the server STT.
      // Poll briefly for the encoded clip, then submit audio-only.
      setSpeechState('THINKING');
      let polls = 0;
      const timer = setInterval(() => {
        polls += 1;
        const clip = recorder.audioBase64;
        if (clip || polls > 20) {
          clearInterval(timer);
          if (clip) {
            handleAnswerSubmit('', undefined, clip);
          } else {
            setSpeechState('ASKING');
            addToast('info', 'No speech was captured. Tap the microphone and speak, or choose an option below.');
          }
        }
      }, 250);
    } else {
      setSpeechState('ASKING');
      addToast('info', 'No speech was heard. Tap the microphone and speak clearly, or choose an option below.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTranscript, recorder, stt]);

  const handleAnswerSubmit = async (answer: string, sttConf?: number, audioBase64?: string | null) => {
    if (!currentQuestion || !sessionId) {
      addToast('error', 'Session not ready. Please go back and identify the patient first.');
      return;
    }
    tts.cancel();
    setTtsActive(false);
    setSpeechState('THINKING');
    setLiveTranscript('');

    const isChestPain = /chest pain|seene mein dard|crushing|heart pain/i.test(answer);
    if (isChestPain) setHasRedFlag(true);

    const key = newIdempotencyKey();
    try {
      const res = await ApiService.submitInterviewResponse(
        sessionId,
        currentQuestion.question_id,
        currentQuestion.category,
        answer,
        audioBase64,
        key,
      );

      setAssistanceScore(res.assistance_score);
      appendHistory(currentQuestion, answer || '(voice recording sent for transcription)', sttConf);

      if (res.next_question) {
        setCurrentQuestion(res.next_question);
        setSpeechState('ASKING');
        setTimeout(() => readQuestionAloud(res.next_question!), 400);
      } else {
        setSpeechState('IDLE');
        setStep('documents');
        addToast('success', 'Questions complete. Next: scan a prescription if you have one.');
      }
    } catch (e) {
      if (e instanceof ApiError && e.offline) {
        enqueueOp({
          kind: 'answer', key, sessionId,
          questionId: currentQuestion.question_id,
          category: currentQuestion.category,
          answerText: answer, audioBase64,
        });
        setContinuedOffline(true);
        addToast('warning', 'Connection lost. Your answer is saved on this kiosk and will sync automatically — please continue.');
        advanceOffline(currentQuestion, answer || '(voice answer saved, pending transcription)');
      } else {
        setSpeechState('ASKING');
        addToast('error', e instanceof ApiError ? e.message : 'That answer could not be saved. Please try again.');
      }
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!sessionId) {
      addToast('error', 'Session not ready. Please identify the patient first.');
      return;
    }
    const file = files[0];
    setUploadedFiles(prev => [...prev, file]);
    setOcrProcessing(true);
    addToast('info', 'Reading your document. This usually takes a few seconds.');

    const key = newIdempotencyKey();
    try {
      const res = await ApiService.processDocument(sessionId, 'PRESCRIPTION', file, key);
      setExtractedEntities(res.entities || []);
      setIsLowConf(res.requires_verification || false);
      setAssistanceScore(res.assistance_score || 1.0);
      setOcrRawText(res.raw_text || '');

      if (res.requires_verification) {
        if ((res.entities || []).length === 0 && !res.raw_text) {
          addToast('warning', 'The scan is saved. A staff member will read it from the original image — you can continue.');
        } else {
          addToast('warning', 'The scan was unclear, so a staff member will verify it. You can continue.');
        }
      } else {
        addToast('success', `Found ${res.entities?.length || 0} medicine(s) at ${Math.round((res.overall_confidence || 0) * 100)}% confidence.`);
      }
      setStep('review');
    } catch (e) {
      if (e instanceof ApiError && e.offline) {
        try {
          const b64 = await fileToBase64(file);
          enqueueOp({
            kind: 'document', key, sessionId, docType: 'PRESCRIPTION',
            fileName: file.name, fileType: file.type || 'image/jpeg', fileBase64: b64,
          });
          addToast('warning', 'Connection lost. The document is saved on this kiosk and will upload automatically.');
          setStep('review');
        } catch {
          addToast('error', 'The document could not be saved locally. Please try again when connected.');
        }
      } else {
        addToast('error', e instanceof ApiError ? e.message : 'The document could not be read. Try a clearer photo or press Skip.');
      }
    } finally {
      setOcrProcessing(false);
    }
  };

  const handleSkipDocuments = () => {
    addToast('info', 'Continuing without a document scan.');
    setStep('review');
  };

  const handleCompleteSession = async () => {
    if (sessionId) {
      try {
        await ApiService.getSummary(sessionId);
      } catch (e) {
        // The doctor view generates the summary on demand; a failure here
        // must not block the patient. Queue nothing — responses are stored.
        addToast('warning', 'Summary will be prepared for the doctor shortly. You are done — please wait to be called.');
        setStep('complete');
        return;
      }
    }
    setStep('complete');
    addToast('success', 'Your intake is complete. Please wait to be called.');
  };

  const handleNeedHelp = async () => {
    if (!sessionId) {
      addToast('warning', 'Please wait for the session to start, then press Need help again.');
      return;
    }
    try {
      await ApiService.requestHelp(sessionId);
    } catch (e) {
      if (e instanceof ApiError && e.offline) {
        enqueueOp({ kind: 'help', key: newIdempotencyKey(), sessionId });
      } else {
        addToast('error', e instanceof ApiError ? e.message : 'Could not reach staff dispatch. Please alert someone nearby.');
        return;
      }
    }
    setAssistanceScore(0.0);
    addToast('warning', 'Help requested. A staff member will come to this kiosk shortly. Please stay where you are.');
  };

  // ── Connectivity: banner state + resync after reconnect ──────────────────
  const { online, pending, syncing } = useOnlineStatus();
  const [continuedOffline, setContinuedOffline] = useState(false);

  useEffect(() => {
    if (online && continuedOffline && pending === 0 && sessionId && step === 'interview') {
      setContinuedOffline(false);
      ApiService.nextQuestion(sessionId)
        .then(res => {
          if (res.question) {
            setCurrentQuestion(res.question);
            setSpeechState('ASKING');
            addToast('success', 'Connection restored. Continuing with the next question.');
          } else if (res.is_interview_complete) {
            setStep('documents');
            addToast('success', 'Connection restored. Your answers synced — please continue with documents.');
          }
        })
        .catch(() => { /* stay on the local question; outbox keeps retrying */ });
    }
    if (!online && step === 'interview') setContinuedOffline(true);
  }, [online, pending, continuedOffline, sessionId, step, addToast]);

  // ── Snapshot: reload-safe kiosk progress ──────────────────────────────────
  useEffect(() => {
    saveSnapshot({ step, lang, sessionId, patient, interviewHistory, currentQuestion, assistanceScore });
  }, [step, lang, sessionId, patient, interviewHistory, currentQuestion, assistanceScore]);

  useEffect(() => {
    const snap = loadSnapshot<{
      step: typeof step; lang: LanguageCode; sessionId: string;
      patient: Patient | null; interviewHistory: typeof interviewHistory;
      currentQuestion: Question | null; assistanceScore: number;
    }>();
    if (snap?.sessionId && step === 'language') {
      setLang(snap.lang);
      setSessionId(snap.sessionId);
      setPatient(snap.patient);
      setInterviewHistory(snap.interviewHistory || []);
      if (snap.currentQuestion) setCurrentQuestion(snap.currentQuestion);
      setAssistanceScore(snap.assistanceScore ?? 1.0);
      if (snap.step && snap.step !== 'language' && snap.step !== 'complete') {
        setStep(snap.step);
        addToast('info', 'Previous session restored. You can continue where you left off.');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timer: any;
    if (step === 'complete') {
      setResetCountdown(15);
      timer = setInterval(() => {
        setResetCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            clearSnapshot();
            answeredIdsRef.current = [];
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

  useEffect(() => {
    return () => {
      clearInterval(micTimerRef.current);
      tts.cancel();
      stt.stop();
    };
  }, []);

  const scoreLabel = assistanceScore >= 0.85 ? 'On track' : assistanceScore >= 0.65 ? 'Needs confirmation' : 'Staff review';
  const scoreClasses = assistanceScore >= 0.85 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : assistanceScore >= 0.65 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-teal-700 flex items-center justify-center shrink-0">
              <Activity className="w-4.5 h-4.5 w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-slate-900 leading-tight">MediKiosk</div>
              <div className="text-xs text-slate-500">OPD intake · {lang.toUpperCase()}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {step !== 'language' && (
              <span className={`hidden sm:inline-flex items-center text-xs font-medium px-2.5 py-1 rounded border ${scoreClasses}`}>
                {scoreLabel} · {Math.round(assistanceScore * 100)}%
              </span>
            )}
            {ttsActive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-teal-200 bg-teal-50 text-xs text-teal-800" role="status">
                <Volume2 className="w-3.5 h-3.5" />
                Speaking…
              </span>
            )}
            <button
              onClick={handleNeedHelp}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100"
            >
              <HelpCircle className="w-4 h-4" />
              Need help
            </button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto mt-3">
          <KioskProgress step={step} />
        </div>
        {!online && (
          <div className="max-w-3xl mx-auto mt-2.5" role="alert">
            <p className="text-[13px] font-medium px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              Offline — answers and documents are saved on this kiosk{pending > 0 && ` (${pending} waiting to sync)`}. Please continue; everything sends automatically.
            </p>
          </div>
        )}
        {online && (syncing || pending > 0) && (
          <div className="max-w-3xl mx-auto mt-2.5" role="status">
            <p className="text-[13px] font-medium px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-800">
              Syncing saved items… ({pending} left)
            </p>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 w-full">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

          {/* STEP 1: LANGUAGE */}
          {step === 'language' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Which language should we use?</h1>
                <p className="text-base text-slate-600 mt-2">अपनी भाषा चुनें · Choose one option below</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="group" aria-label="Language choices">
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => handleSelectLanguage(l.code)}
                    className="min-h-[76px] p-4 rounded-lg bg-white border border-slate-300 hover:border-teal-700 hover:bg-teal-50/40 flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-2xl" aria-hidden>{l.flag}</span>
                    <span className="text-base font-semibold text-slate-900">{l.nativeName}</span>
                    <span className="text-xs text-slate-500">{l.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-center text-sm text-slate-500">You can listen to every question aloud. A staff member can help at any time.</p>
            </div>
          )}

          {/* STEP 2: ABHA */}
          {step === 'abha' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="text-center">
                <h2 className="text-2xl font-semibold tracking-tight">{strings.abhaTitle}</h2>
                <p className="text-base text-slate-600 mt-1">{strings.abhaSubtitle}</p>
              </div>

              {abhaMode === 'unknown' && (
                <div className="space-y-3">
                  <p className="text-center text-base text-slate-700 font-medium">Do you have an ABHA health ID?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setAbhaMode('have')}
                      className="min-h-[96px] p-5 rounded-lg bg-white border border-slate-300 hover:border-teal-700 flex flex-col items-center gap-1.5"
                    >
                      <ShieldCheck className="w-7 h-7 text-teal-700" />
                      <span className="font-semibold text-slate-900">Yes, I have an ABHA ID</span>
                      <span className="text-sm text-slate-500">हाँ, मेरे पास आभा आईडी है</span>
                    </button>
                    <button
                      onClick={() => setAbhaMode('create')}
                      className="min-h-[96px] p-5 rounded-lg bg-white border border-slate-300 hover:border-teal-700 flex flex-col items-center gap-1.5"
                    >
                      <UserPlus className="w-7 h-7 text-teal-700" />
                      <span className="font-semibold text-slate-900">No, register me</span>
                      <span className="text-sm text-slate-500">नया पंजीकरण करें</span>
                    </button>
                  </div>
                  <button onClick={handleSkipAbha} className="w-full min-h-[52px] py-3 rounded-lg text-slate-600 hover:text-slate-900 text-[15px] font-medium border border-transparent hover:border-slate-200">
                    Skip — continue as walk-in patient →
                  </button>
                </div>
              )}

              {abhaMode === 'have' && (
                <div className="clinical-card p-5 space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="abha-id" className="label-micro">ABHA ID</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="abha-id"
                        type="text"
                        value={abhaInput}
                        onChange={e => setAbhaInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAbhaLookup()}
                        placeholder="91-XXXX-XXXX-XXXX"
                        className="clinical-input flex-1 px-4 py-3.5 min-h-[56px] font-mono text-lg"
                      />
                      <button
                        onClick={handleAbhaLookup}
                        disabled={abhaLookupLoading}
                        className="btn-primary px-6 min-h-[56px] inline-flex items-center justify-center gap-2"
                      >
                        {abhaLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        {abhaLookupLoading ? 'Checking…' : 'Find'}
                      </button>
                    </div>
                    <p className="text-[13px] text-slate-500">Demo IDs: 91-8823-9912-4012 or 91-1122-3344-5566</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setAbhaMode('unknown')} className="btn-secondary px-4 py-2.5 min-h-[48px] text-sm">← Back</button>
                    <button onClick={handleSkipAbha} className="btn-secondary flex-1 py-2.5 min-h-[48px] text-sm">Skip → walk-in</button>
                  </div>
                </div>
              )}

              {abhaMode === 'create' && (
                <div className="clinical-card p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2 space-y-1.5">
                      <label htmlFor="nb-name" className="label-micro">Full name *</label>
                      <input id="nb-name" type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Rajesh Kumar" className="clinical-input px-3.5 py-3 min-h-[52px]" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="nb-age" className="label-micro">Age *</label>
                      <input id="nb-age" type="number" value={newAge} onChange={e => setNewAge(e.target.value)} placeholder="45" className="clinical-input px-3.5 py-3 min-h-[52px]" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="nb-gender" className="label-micro">Gender *</label>
                      <select id="nb-gender" value={newGender} onChange={e => setNewGender(e.target.value)} className="clinical-input px-3.5 py-3 min-h-[52px]">
                        <option>Male</option><option>Female</option><option>Other</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="nb-phone" className="label-micro">Phone *</label>
                      <input id="nb-phone" type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+91 98765 43210" className="clinical-input px-3.5 py-3 min-h-[52px]" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="nb-dob" className="label-micro">Date of birth</label>
                      <input id="nb-dob" type="date" value={newDob} onChange={e => setNewDob(e.target.value)} className="clinical-input px-3.5 py-3 min-h-[52px]" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setAbhaMode('unknown')} className="btn-secondary px-4 py-3 min-h-[52px] text-sm">← Back</button>
                    <button onClick={handleCreateAbha} disabled={abhaLookupLoading} className="btn-primary flex-1 py-3 min-h-[52px] inline-flex items-center justify-center gap-2">
                      {abhaLookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      {abhaLookupLoading ? 'Creating…' : 'Create ABHA ID and continue'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABHA RECORDS */}
          {step === 'abha_records' && patient && (
            <div className="space-y-5 animate-fadeIn">
              <div className="clinical-card p-4 flex items-center gap-3 border-l-4 border-l-emerald-600">
                <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-lg font-semibold shrink-0" aria-hidden>
                  {patient.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{patient.name}</div>
                  <div className="text-sm text-slate-500">{patient.age} yrs · {patient.gender} · ABHA {patient.abha_id}</div>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Verified</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Records found ({abhaRecords.length})</h3>
                  <span className="text-xs text-slate-500">From ABHA portal</span>
                </div>
                <div className="space-y-2.5">
                  {abhaRecords.map((rec, idx) => (
                    <div key={idx} className="clinical-card p-4">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[11px] px-2 py-0.5 rounded border font-semibold uppercase tracking-wide bg-slate-50 text-slate-600 border-slate-200">
                          {rec.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-500">{rec.date}</span>
                      </div>
                      <p className="text-[15px] text-slate-800 font-medium">{rec.summary}</p>
                      <p className="text-[13px] text-slate-500 mt-0.5">{rec.doctor} · {rec.facility}</p>
                      {rec.medications && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {rec.medications.map((m, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-200">{m}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => setStep('consent')} className="btn-primary w-full py-4 min-h-[60px] inline-flex items-center justify-center gap-2 text-base">
                Continue to consent <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* CONSENT */}
          {step === 'consent' && (
            <div className="space-y-5 animate-fadeIn">
              {patient && (
                <div className="clinical-card p-4 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-lg font-semibold shrink-0" aria-hidden>
                    {patient.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{patient.name}</div>
                    <div className="text-[13px] text-slate-500">ABHA: {patient.abha_id} · {patient.age} yrs</div>
                  </div>
                </div>
              )}

              <div className="clinical-card p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-5 h-5 text-teal-700" />
                  <h2 className="text-lg font-semibold">{strings.consentTitle}</h2>
                </div>
                <p className="text-[15px] text-slate-700 leading-relaxed">{strings.consentText}</p>
                <p className="text-[13px] text-slate-500 mt-3">Nothing here is a diagnosis or prescription. A doctor reviews everything before treatment.</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button onClick={handleReadConsent} className="btn-secondary flex items-center justify-center gap-2 px-4 py-3.5 min-h-[56px]">
                  <Volume2 className="w-4 h-4" />
                  {strings.readAloud}
                </button>
                <button onClick={handleConsent} className="btn-primary flex-1 py-3.5 min-h-[56px] inline-flex items-center justify-center gap-2 text-base">
                  <Check className="w-5 h-5" />
                  {strings.agree}
                </button>
              </div>
            </div>
          )}

          {/* INTERVIEW */}
          {step === 'interview' && currentQuestion && (
            <div className="space-y-5 animate-fadeIn" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded border bg-slate-100 border-slate-200 text-slate-600 uppercase tracking-wide">
                  {currentQuestion.category.replace(/_/g, ' ')}
                </span>
                <span className="text-[13px] text-slate-500">Question {interviewHistory.length + 1}</span>
              </div>

              <div className="text-center pt-1">
                <h2 className="text-xl sm:text-2xl font-semibold leading-snug max-w-xl mx-auto">
                  {currentQuestion.text[lang] || currentQuestion.text['en']}
                </h2>
                <button onClick={() => readQuestionAloud(currentQuestion)} className="mt-2 inline-flex items-center gap-1.5 text-sm text-teal-700 hover:text-teal-800 font-medium min-h-[44px] px-3">
                  <Volume2 className="w-4 h-4" />
                  Listen again
                </button>
              </div>

              {/* Mic + explicit states */}
              <div className="flex flex-col items-center gap-3 py-1">
                {speechState === 'THINKING' ? (
                  <div className="text-center" role="status">
                    <div className="w-20 h-20 rounded-full bg-white border border-slate-300 flex items-center justify-center mx-auto">
                      <Loader2 className="w-8 h-8 text-teal-700 animate-spin" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 mt-3">Saving your answer…</p>
                    <p className="text-[13px] text-slate-500">Please wait a moment.</p>
                  </div>
                ) : (
                  <button
                    onClick={speechState === 'LISTENING' ? () => handleStopListening() : handleStartListening}
                    aria-pressed={speechState === 'LISTENING'}
                    aria-label={speechState === 'LISTENING' ? 'Stop recording' : 'Start recording your answer'}
                    className={`w-20 h-20 rounded-full flex items-center justify-center border-2 min-h-[80px] min-w-[80px]
                      ${speechState === 'LISTENING'
                        ? 'bg-red-600 border-red-700 text-white'
                        : 'bg-teal-700 border-teal-800 text-white hover:bg-teal-800'}`}
                  >
                    {speechState === 'LISTENING' ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                  </button>
                )}

                {speechState === 'LISTENING' && (
                  <div className="text-center" role="status">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-600" aria-hidden /> Recording… {micSeconds}s of 15s
                    </p>
                    {liveTranscript
                      ? <p className="text-[15px] text-slate-700 italic mt-2 max-w-md">“{liveTranscript}”</p>
                      : <p className="text-sm text-slate-500 mt-2">Speak clearly. Tap the microphone again to finish.</p>}
                  </div>
                )}
                {speechState === 'ASKING' && (
                  <p className="text-[15px] text-slate-600">Tap the microphone and speak — <span className="font-medium">or</span> tap an option below.</p>
                )}
              </div>

              {currentQuestion.options && speechState !== 'THINKING' && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-xs text-slate-400 uppercase tracking-wide">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span>Touch options</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {currentQuestion.options.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAnswerSubmit(opt)}
                        className="min-h-[56px] p-4 rounded-lg bg-white border border-slate-300 hover:border-teal-700 hover:bg-teal-50/50 text-left text-[15px] font-medium text-slate-800"
                      >
                        {opt}
                      </button>
                    ))}
                    <button
                      onClick={() => handleAnswerSubmit("I don't remember / याद नहीं")}
                      className="min-h-[56px] p-4 rounded-lg bg-white border border-dashed border-slate-300 text-left text-[15px] font-medium text-slate-600 hover:border-amber-400"
                    >
                      I don&apos;t remember / याद नहीं
                    </button>
                  </div>
                </div>
              )}

              {interviewHistory.length > 0 && (
                <details className="clinical-card">
                  <summary className="px-4 py-3 text-sm font-medium text-slate-600 cursor-pointer min-h-[48px]">Answers recorded so far ({interviewHistory.length})</summary>
                  <div className="px-4 pb-3 space-y-2 border-t border-slate-100 pt-3">
                    {interviewHistory.map((h, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">{h.q}</p>
                          <p className="font-medium text-slate-800">{h.a}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* DOCUMENTS */}
          {step === 'documents' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="text-center">
                <h2 className="text-2xl font-semibold tracking-tight">{strings.docScanTitle}</h2>
                <p className="text-base text-slate-600 mt-1">{strings.docScanDesc}</p>
              </div>

              {ocrProcessing ? (
                <div className="clinical-card p-10 text-center" role="status">
                  <Loader2 className="w-10 h-10 text-teal-700 animate-spin mx-auto" />
                  <p className="font-semibold text-slate-900 mt-4">Reading your document…</p>
                  <p className="text-sm text-slate-500 mt-1">Extracting medicines and doses. Do not close this screen.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full min-h-[120px] p-8 rounded-lg bg-white border-2 border-dashed border-slate-300 hover:border-teal-700 text-center"
                  >
                    <Upload className="w-7 h-7 text-teal-700 mx-auto mb-2" />
                    <span className="font-semibold text-slate-900 block">Upload prescription or report</span>
                    <span className="text-sm text-slate-500 block mt-1">Take a photo or choose a file · JPG, PNG, or PDF</span>
                  </button>

                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf" capture="environment" onChange={e => handleFileUpload(e.target.files)} className="hidden" aria-label="Upload prescription or report" />

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      {uploadedFiles.map((f, i) => (
                        <div key={i} className="clinical-card p-3 flex items-center gap-3">
                          <FileIcon className="w-4 h-4 text-teal-700 shrink-0" />
                          <span className="text-sm text-slate-700 truncate flex-1">{f.name}</span>
                          <span className="text-xs text-slate-500">{(f.size / 1024).toFixed(0)} KB</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <div className="flex-1 h-px bg-slate-200" /><span>If you have no papers with you</span><div className="flex-1 h-px bg-slate-200" />
                  </div>

                  <button onClick={handleSkipDocuments} className="btn-secondary w-full py-3.5 min-h-[56px]">
                    Skip — I have no documents
                  </button>
                </div>
              )}
            </div>
          )}

          {/* REVIEW */}
          {step === 'review' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-semibold text-slate-900 text-xl">{strings.reviewTitle}</h2>
                {isLowConf ? (
                  <span className="text-xs px-2.5 py-1 rounded border bg-amber-50 text-amber-800 border-amber-200 font-medium">
                    A staff member will verify the scan
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-1 rounded border bg-emerald-50 text-emerald-800 border-emerald-200 font-medium">
                    Ready for the doctor
                  </span>
                )}
              </div>

              {patient && (
                <div className="clinical-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-semibold shrink-0" aria-hidden>
                    {patient.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{patient.name}</p>
                    <p className="text-xs text-slate-500">ABHA: {patient.abha_id} · {patient.age} yrs · {patient.gender}</p>
                  </div>
                </div>
              )}

              {hasRedFlag && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3" role="alert">
                  <AlertOctagon className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800">Urgent symptom noted — chest pain</p>
                    <p className="text-sm text-slate-700 mt-0.5">You will be prioritised. Please stay at the kiosk; staff have been alerted.</p>
                  </div>
                </div>
              )}

              {isLowConf && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3" role="status">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900">Scan needs a human check</p>
                    <p className="text-sm text-slate-700 mt-0.5">The handwriting or photo was unclear. Your visit continues — a reviewer will confirm the medicines.</p>
                  </div>
                </div>
              )}

              {interviewHistory.length > 0 && (
                <div className="space-y-2">
                  <p className="label-micro">Your answers</p>
                  {interviewHistory.map((item, idx) => (
                    <div key={idx} className="clinical-card p-3.5">
                      <p className="text-xs text-slate-500">{item.q}</p>
                      <p className="font-medium text-slate-900 mt-0.5">{item.a}</p>
                    </div>
                  ))}
                </div>
              )}

              {extractedEntities.length > 0 && (
                <div className="space-y-2">
                  <p className="label-micro">Medicines read from your document</p>
                  {ocrRawText && (
                    <div className="clinical-card p-3.5 bg-slate-50">
                      <p className="text-xs text-slate-500 mb-1">Exact text read</p>
                      <p className="text-[13px] font-mono text-slate-700 break-words">{ocrRawText}</p>
                    </div>
                  )}
                  {extractedEntities.map((med, idx) => (
                    <div key={idx} className="clinical-card p-3.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{med.entity_name} {med.dosage && <span className="font-normal text-slate-600">— {med.dosage}</span>}</p>
                        <p className="text-xs text-slate-500">{med.frequency} · {med.source_ref}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded border font-semibold whitespace-nowrap
                        ${med.confidence >= 0.8 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                        {Math.round(med.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                  <p className="text-[13px] text-slate-500">Unclear items are marked and sent for verification — never guessed.</p>
                </div>
              )}

              <button onClick={handleCompleteSession} className="btn-primary w-full py-4 min-h-[60px] inline-flex items-center justify-center gap-2 text-base">
                <CheckCircle2 className="w-5 h-5" />
                {strings.finishBtn}
              </button>
            </div>
          )}

          {/* COMPLETE */}
          {step === 'complete' && (
            <div className="text-center space-y-5 animate-fadeIn py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-600 flex items-center justify-center mx-auto" role="img" aria-label="Complete">
                <CheckCircle2 className="w-9 h-9 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{strings.thankYou}</h2>
                <p className="text-[15px] text-slate-600 mt-2 max-w-md mx-auto">{strings.resetNotice}</p>
              </div>
              {patient && (
                <div className="clinical-card p-4 inline-block mx-auto text-left">
                  <p className="label-micro mb-1">Patient</p>
                  <p className="font-semibold text-slate-900">{patient.name}</p>
                  <p className="text-sm text-teal-700 font-mono">{patient.abha_id}</p>
                </div>
              )}
              <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <Clock className="w-4 h-4" />
                Clearing this screen in <span className="font-semibold text-slate-900">{resetCountdown}s</span>
              </p>
              <div className="flex justify-center gap-2.5">
                <Link to="/navigator" className="btn-secondary px-4 py-2.5 text-sm">Staff view</Link>
                <Link to="/doctor" className="btn-primary px-4 py-2.5 text-sm">Doctor view</Link>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer strip */}
      <footer className="bg-white border-t border-slate-200 px-4 py-2.5">
        <p className="max-w-3xl mx-auto text-center text-xs text-slate-500">
          This kiosk collects history only. It does not diagnose or prescribe. Press <span className="font-semibold">Need help</span> any time.
        </p>
      </footer>
    </div>
  );
};
