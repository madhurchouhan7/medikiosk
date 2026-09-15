import { useRef, useState, useCallback } from 'react';

export interface VoiceRecorderState {
  isRecording: boolean;
  audioBlob: Blob | null;
  audioBase64: string | null;
  durationMs: number;
  error: string | null;
}

export interface UseVoiceRecorderReturn extends VoiceRecorderState {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    audioBlob: null,
    audioBase64: null,
    durationMs: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setState(s => ({ ...s, error: null, audioBlob: null, audioBase64: null, durationMs: 0 }));
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Prefer webm/opus, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg;codecs=opus';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const durationMs = Date.now() - startTimeRef.current;

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          setState(s => ({
            ...s,
            isRecording: false,
            audioBlob: blob,
            audioBase64: base64,
            durationMs,
          }));
        };
        reader.readAsDataURL(blob);

        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start(250); // collect chunks every 250ms
      startTimeRef.current = Date.now();
      setState(s => ({ ...s, isRecording: true }));
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone permission denied. Please allow microphone access in your browser settings.'
        : err.name === 'NotFoundError'
        ? 'No microphone found. Please connect a microphone and try again.'
        : `Microphone error: ${err.message}`;
      setState(s => ({ ...s, error: msg, isRecording: false }));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const reset = useCallback(() => {
    stopRecording();
    setState({ isRecording: false, audioBlob: null, audioBase64: null, durationMs: 0, error: null });
  }, [stopRecording]);

  return { ...state, startRecording, stopRecording, reset };
}
