import { useCallback, useRef } from 'react';
import type { LanguageCode } from '../types';

// Web Speech API language codes for Indian languages
const LANG_CODES: Record<LanguageCode, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
};

// Browser TTS voices — prefer Indian English/Hindi where available
const selectBestVoice = (lang: LanguageCode): SpeechSynthesisVoice | null => {
  const voices = window.speechSynthesis.getVoices();
  const code = LANG_CODES[lang];
  
  // Try exact match
  let voice = voices.find(v => v.lang === code);
  if (voice) return voice;
  
  // Try language prefix match (e.g., 'hi' for 'hi-IN')
  const prefix = code.split('-')[0];
  voice = voices.find(v => v.lang.startsWith(prefix));
  if (voice) return voice;
  
  // Fall back to any Indian English voice
  voice = voices.find(v => v.lang === 'en-IN');
  if (voice) return voice;
  
  return null;
};

export interface UseSpeechReturn {
  speak: (text: string, lang: LanguageCode, onEnd?: () => void) => void;
  cancel: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

export function useTTS(): UseSpeechReturn {
  const speakingRef = useRef(false);

  const speak = useCallback((text: string, lang: LanguageCode, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG_CODES[lang] || 'en-IN';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Wait for voices to load if needed
    const setVoice = () => {
      const voice = selectBestVoice(lang);
      if (voice) utterance.voice = voice;
    };
    
    if (window.speechSynthesis.getVoices().length > 0) {
      setVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = setVoice;
    }

    utterance.onstart = () => { speakingRef.current = true; };
    utterance.onend = () => {
      speakingRef.current = false;
      onEnd?.();
    };
    utterance.onerror = () => {
      speakingRef.current = false;
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const cancel = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      speakingRef.current = false;
    }
  }, []);

  return {
    speak,
    cancel,
    isSpeaking: speakingRef.current,
    isSupported: 'speechSynthesis' in window,
  };
}

// ─── Web Speech API STT (SpeechRecognition) ───────────────────────────────────
export interface STTResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface UseSTTReturn {
  start: (lang: LanguageCode, onResult: (r: STTResult) => void, onEnd?: () => void) => void;
  stop: () => void;
  isSupported: boolean;
}

export function useSTT(): UseSTTReturn {
  const recognitionRef = useRef<any>(null);

  const isSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

  const start = useCallback((lang: LanguageCode, onResult: (r: STTResult) => void, onEnd?: () => void) => {
    if (!isSupported) {
      onEnd?.();
      return;
    }

    // Cancel any existing recognition
    recognitionRef.current?.stop();

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRec();
    recognitionRef.current = rec;

    rec.lang = LANG_CODES[lang] || 'en-IN';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (event: any) => {
      const results = event.results;
      for (let i = event.resultIndex; i < results.length; i++) {
        const result = results[i];
        onResult({
          transcript: result[0].transcript,
          confidence: result[0].confidence || 0.85,
          isFinal: result.isFinal,
        });
      }
    };

    rec.onend = () => {
      onEnd?.();
    };

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech') {
        console.warn('STT error:', e.error);
      }
      onEnd?.();
    };

    rec.start();
  }, [isSupported]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { start, stop, isSupported };
}
