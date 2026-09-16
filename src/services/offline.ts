/**
 * Offline-first layer: LOCAL DATA FIRST → QUEUE → SYNC → SERVER CONFIRMATION.
 *
 * - Session snapshot in localStorage: reload-safe kiosk progress.
 * - Outbox in localStorage: interview answers, document uploads, help
 *   requests, task verifications. Retried with exponential backoff when the
 *   browser reports online. Idempotency keys (server-enforced) prevent
 *   duplicates.
 */
import { useSyncExternalStore, useCallback } from 'react';
import { ApiService, ApiError, newIdempotencyKey } from './api';

const SNAP_KEY = 'medikiosk.session.snapshot.v1';
const OUTBOX_KEY = 'medikiosk.outbox.v1';

export type OutboxOp =
  | { kind: 'answer'; key: string; sessionId: string; questionId: string; category: string; answerText: string; audioBase64?: string | null }
  | { kind: 'document'; key: string; sessionId: string; docType: string; fileName: string; fileType: string; fileBase64: string }
  | { kind: 'help'; key: string; sessionId: string }
  | { kind: 'verify-task'; key: string; taskId: string; corrections: any[]; navigatorName: string };

interface OutboxEntry {
  op: OutboxOp;
  attempts: number;
  nextRetryAt: number;
  lastError?: string;
}

// ── Snapshot ────────────────────────────────────────────────────────────────
export function saveSnapshot<T>(snap: T): void {
  try { localStorage.setItem(SNAP_KEY, JSON.stringify(snap)); } catch { /* storage full/blocked */ }
}

export function loadSnapshot<T>(): T | null {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
}

export function clearSnapshot(): void {
  try { localStorage.removeItem(SNAP_KEY); } catch { /* ignore */ }
}

// ── Outbox ──────────────────────────────────────────────────────────────────
function readOutbox(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function writeOutbox(entries: OutboxEntry[]): void {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries)); } catch { /* ignore */ }
}

export function enqueueOp(op: OutboxOp): void {
  const entries = readOutbox();
  if (entries.some(e => e.op.key === op.key)) return; // idempotent enqueue
  entries.push({ op, attempts: 0, nextRetryAt: Date.now() });
  writeOutbox(entries);
  notifyOutbox();
  void processOutbox();
}

export function outboxCount(): number {
  return readOutbox().length;
}

function backoffMs(attempts: number): number {
  return Math.min(30000, 1000 * 2 ** attempts);
}

function fileFromBase64(name: string, type: string, b64: string): File {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type });
}

async function executeOp(op: OutboxOp): Promise<void> {
  switch (op.kind) {
    case 'answer':
      await ApiService.submitInterviewResponse(op.sessionId, op.questionId, op.category, op.answerText, op.audioBase64, op.key);
      break;
    case 'document':
      await ApiService.processDocument(op.sessionId, op.docType, fileFromBase64(op.fileName, op.fileType, op.fileBase64), op.key);
      break;
    case 'help':
      await ApiService.requestHelp(op.sessionId);
      break;
    case 'verify-task':
      await ApiService.verifyTask(op.taskId, op.corrections, op.navigatorName);
      break;
  }
}

let processing = false;
let syncState: 'idle' | 'syncing' = 'idle';
const listeners = new Set<() => void>();

function notifyOutbox(): void {
  listeners.forEach(l => l());
}

export function useOutboxPending(): { pending: number; syncing: boolean } {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => ({ pending: outboxCount(), syncing: syncState === 'syncing' }),
  );
}

export async function processOutbox(): Promise<void> {
  if (processing || !navigator.onLine) return;
  processing = true;
  try {
    let entries = readOutbox();
    if (entries.length > 0) {
      syncState = 'syncing';
      notifyOutbox();
    }
    const now = Date.now();
    for (const entry of entries) {
      if (!navigator.onLine || entry.nextRetryAt > now) continue;
      try {
        await executeOp(entry.op);
        entries = entries.filter(e => e.op.key !== entry.op.key);
        writeOutbox(entries);
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : 'Sync failed';
        entries = entries.map(x => x.op.key === entry.op.key
          ? { ...x, attempts: x.attempts + 1, nextRetryAt: Date.now() + backoffMs(x.attempts), lastError: msg }
          : x);
        writeOutbox(entries);
        if (e instanceof ApiError && !e.offline && e.status >= 400 && e.status < 500) {
          // Client error: retrying won't help. Drop the op so it doesn't
          // block the queue; the error stays visible at the call site.
          entries = entries.filter(x => x.op.key !== entry.op.key);
          writeOutbox(entries);
        }
      }
    }
    syncState = 'idle';
    notifyOutbox();
  } finally {
    processing = false;
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// ── Connectivity ────────────────────────────────────────────────────────────
function subscribeOnline(cb: () => void): () => void {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  const onProcessed = () => cb();
  listeners.add(onProcessed);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
    listeners.delete(onProcessed);
  };
}

export function useOnlineStatus(): { online: boolean; pending: number; syncing: boolean } {
  const { pending, syncing } = useOutboxPending();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine);
  return { online, pending, syncing };
}

export function ensureOutboxWorker(): void {
  window.addEventListener('online', () => void processOutbox());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void processOutbox();
  });
  void processOutbox();
}

export { newIdempotencyKey };
