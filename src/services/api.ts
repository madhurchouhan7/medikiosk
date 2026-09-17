/**
 * Real API client. Every method talks to the FastAPI backend and THROWS on
 * failure — no fabricated patients, transcripts, or OCR results.
 * Callers decide: show the error with recovery, or queue the operation in
 * the offline outbox (see offline.ts).
 */
import type {
  Patient, Question, ExtractedEntity, AssistanceTask,
  ClinicalSummary, OperationalMetrics,
} from '../types';

const CONFIGURED_API_URL =
  (import.meta.env.NIRAAMAY_API_URL as string | undefined) ??
  (import.meta.env.NIRAMAYA_API_URL as string | undefined) ??
  (import.meta.env.MY_VITE_API_URL as string | undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  '';

function normalizeBaseUrl(raw: string): string {
  // Accept with/without trailing slash, with/without a trailing "/api".
  let base = raw.trim().replace(/\/+$/, '');
  if (/\/api$/i.test(base)) base = base.slice(0, -4);
  return base;
}

const API_ROOT = normalizeBaseUrl(CONFIGURED_API_URL);
// Local `vite` dev serves a same-origin /api proxy (see vite.config.ts).
// Production has no same-origin backend, so production MUST resolve to the
// configured Render URL — never a relative fallback.
const API_BASE = API_ROOT ? `${API_ROOT}/api` : '/api';

if (!API_ROOT) {
  if (import.meta.env.PROD) {
    // Fail LOUD: firing a same-origin /api request in production only
    // produces a misleading 405 from the static host. Set NIRAMAYA_API_URL
    // at build time and redeploy — Vite bakes env vars in at build time.
    console.error(
      '[API] No backend URL configured for production. Set NIRAMAYA_API_URL ' +
      '(e.g. https://medikiosk-5vjw.onrender.com) in the hosting environment ' +
      'and trigger a NEW deployment. No request will be sent.',
    );
  } else {
    console.log('[DIAG] API_BASE: no URL configured, using local dev proxy /api');
  }
} else {
  console.log(`[DIAG] API_BASE resolved to: ${API_BASE}`);
}

/** Production must never fire a same-origin fallback request. */
function assertBackendConfigured(): void {
  if (!API_ROOT && import.meta.env.PROD) {
    throw new ApiError(
      'Backend not configured. Set NIRAMAYA_API_URL and redeploy.',
      0,
      false,
    );
  }
}

export class ApiError extends Error {
  status: number;
  offline: boolean;
  constructor(message: string, status = 0, offline = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.offline = offline;
  }
}

function isOfflineError(e: unknown): boolean {
  return e instanceof TypeError && /fetch|network|load/i.test((e as Error).message);
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  assertBackendConfigured();
  console.log(`[DIAG] API_REQUEST_ABOUT_TO_START: ${options?.method || 'GET'} ${API_BASE + url}`);
  try {
    res = await fetch(API_BASE + url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    });
  } catch (e) {
    if (isOfflineError(e)) {
      throw new ApiError('No connection to the clinic server. Your input is saved and will sync automatically.', 0, true);
    }
    throw new ApiError('Network request failed. Please retry.', 0, true);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    let message = `Request failed (${res.status})`;
    try {
      const body = JSON.parse(detail);
      if (body?.detail) message = Array.isArray(body.detail) ? body.detail.map((d: any) => d.msg || d).join('; ') : String(body.detail);
    } catch { /* keep default */ }
    throw new ApiError(message, res.status, false);
  }
  return res.json() as Promise<T>;
}

export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `key-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export interface SessionPayload {
  id: string;
  patient: Patient;
  language: string;
  status: string;
  assistance_score: number;
}

export interface InterviewResponse {
  session_id: string;
  transcription: string;
  stt_confidence: number;
  is_unknown: boolean;
  assistance_score: number;
  next_question: Question | null;
  is_interview_complete: boolean;
}

export interface DocumentResult {
  document_id: string;
  session_id: string;
  raw_text: string;
  overall_confidence: number;
  assistance_score: number;
  entities: ExtractedEntity[];
  requires_verification: boolean;
  exception_type?: string | null;
}

export const ApiService = {
  async lookupABHA(abhaId: string): Promise<{ found: boolean; patient?: Patient; abha_health_records?: any[] }> {
    return apiFetch(`/sessions/abha/lookup?abha_id=${encodeURIComponent(abhaId)}`, { method: 'POST' });
  },

  async createABHA(name: string, age: number, gender: string, phone: string, dob: string): Promise<{ abha_id: string; patient: Patient }> {
    const q = new URLSearchParams({ name, age: String(age), gender, phone, dob });
    return apiFetch(`/sessions/abha/create?${q.toString()}`, { method: 'POST' });
  },

  async createSession(language: string, abhaId?: string, patientName?: string, patientAge?: number, patientGender?: string, patientPhone?: string): Promise<SessionPayload> {
    console.log('[DIAG] CREATE_SESSION_CALLED', { language, hasAbhaId: !!abhaId });
    return apiFetch(`/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        language,
        abha_id: abhaId,
        patient_name: patientName,
        patient_age: patientAge,
        patient_gender: patientGender,
        patient_phone: patientPhone,
      }),
    });
  },

  async getSessions(): Promise<any[]> {
    return apiFetch(`/sessions`);
  },

  async startInterview(sessionId: string): Promise<{ session_id: string; question: Question; assistance_score: number }> {
    return apiFetch(`/interview/start/${encodeURIComponent(sessionId)}`);
  },

  async nextQuestion(sessionId: string): Promise<{ session_id: string; question: Question | null; is_interview_complete: boolean }> {
    return apiFetch(`/interview/next/${encodeURIComponent(sessionId)}`);
  },

  async submitInterviewResponse(
    sessionId: string, questionId: string, category: string,
    answerText: string, audioBase64?: string | null, idempotencyKey?: string,
  ): Promise<InterviewResponse> {
    return apiFetch(`/interview/respond`, {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId, question_id: questionId, category,
        answer_text: answerText, audio_base64: audioBase64 || undefined,
        idempotency_key: idempotencyKey || undefined,
      }),
    });
  },

  async processDocument(sessionId: string, docType: string, file: File, idempotencyKey?: string): Promise<DocumentResult> {
    assertBackendConfigured();
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('doc_type', docType);
    formData.append('file', file);
    formData.append('file_name', file.name);
    if (idempotencyKey) formData.append('idempotency_key', idempotencyKey);
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/documents/process`, { method: 'POST', body: formData });
    } catch (e) {
      if (isOfflineError(e)) {
        throw new ApiError('Document saved locally. It will upload when the connection returns.', 0, true);
      }
      throw new ApiError('Upload failed. Please retry.', 0, true);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      let message = `Document processing failed (${res.status})`;
      try {
        const body = JSON.parse(detail);
        if (body?.detail) message = String(body.detail);
      } catch { /* keep default */ }
      throw new ApiError(message, res.status, res.status >= 500);
    }
    return res.json();
  },

  async requestHelp(sessionId: string): Promise<AssistanceTask> {
    return apiFetch(`/assistance/help`, {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  },

  async getAssistanceTasks(tier?: string): Promise<AssistanceTask[]> {
    const url = tier ? `/assistance/tasks?tier=${encodeURIComponent(tier)}` : '/assistance/tasks';
    return apiFetch(url);
  },

  async verifyTask(taskId: string, corrections: any[], navigatorName?: string) {
    return apiFetch(`/assistance/tasks/${encodeURIComponent(taskId)}/verify`, {
      method: 'POST',
      body: JSON.stringify({ corrections, navigator_name: navigatorName || 'Staff Navigator' }),
    });
  },

  async escalateTask(taskId: string, note?: string) {
    return apiFetch(`/assistance/tasks/${encodeURIComponent(taskId)}/escalate?note=${encodeURIComponent(note || 'Escalated to attending clinician')}`, {
      method: 'POST',
    });
  },

  async listSummaries(): Promise<any[]> {
    return apiFetch(`/summaries`);
  },

  async getSummary(sessionId: string): Promise<ClinicalSummary> {
    return apiFetch(`/summaries/${encodeURIComponent(sessionId)}`);
  },

  async verifySummary(sessionId: string, physicianNotes?: string) {
    return apiFetch(`/summaries/${encodeURIComponent(sessionId)}/verify?physician_notes=${encodeURIComponent(physicianNotes || 'Verified')}`, {
      method: 'POST',
    });
  },

  async getOperationalMetrics(): Promise<OperationalMetrics> {
    return apiFetch(`/sessions/metrics/operational`);
  },

  async getAuditLogs(): Promise<any[]> {
    return apiFetch(`/sessions/audit/logs`);
  },

  documentFileUrl(docId: string): string {
    return `${API_BASE}/documents/file/${encodeURIComponent(docId)}`;
  },

  /** Extract the stored document id from an entity source_ref like
   *  "upload:<session>/<file>#doc=<uuid>" so the navigator can open it. */
  docIdFromSourceRef(sourceRef: string | undefined): string | null {
    if (!sourceRef) return null;
    const m = /#doc=([A-Za-z0-9-]+)/.exec(sourceRef);
    return m ? m[1] : null;
  },
};
