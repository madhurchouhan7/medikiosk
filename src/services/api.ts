import {
  Patient, Question, ExtractedEntity, AssistanceTask,
  ClinicalSummary, OperationalMetrics
} from '../types';

const API_BASE = '/api';

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ─── Session creation mock fallback ───────────────────────────────────────────
function mockSession(language: string, abhaId?: string, name?: string) {
  return {
    id: `session-${Date.now()}`,
    patient_id: 'patient-demo',
    patient: {
      id: 'patient-demo',
      name: name || 'Walk-in Patient',
      age: 35,
      gender: 'Male',
      abha_id: abhaId || '91-0000-0000-0000',
      language_preference: language,
      phone: '',
    },
    language,
    status: 'ACTIVE',
    current_step: 'language',
    assistance_score: 1.0,
    demo_stage: 1,
  };
}

// ─── ApiService ───────────────────────────────────────────────────────────────
export const ApiService = {
  // ── ABHA ──────────────────────────────────────────────────────────────────
  async lookupABHA(abhaId: string): Promise<{ found: boolean; patient?: Patient; abha_health_records?: any[] }> {
    try {
      const res = await fetch(`${API_BASE}/sessions/abha/lookup?abha_id=${encodeURIComponent(abhaId)}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch {
      // Mock ABHA registry
      const mockRegistry: Record<string, any> = {
        '91-8823-9912-4012': {
          found: true,
          patient: {
            id: 'patient-scen-b', name: 'Rajesh Kumar', age: 52, gender: 'Male',
            abha_id: '91-8823-9912-4012', language_preference: 'hi', phone: '+91 98765 43210'
          },
          abha_health_records: [
            { type: 'PRESCRIPTION', date: '2025-08-15', doctor: 'Dr. Sharma, Cardiologist', facility: 'AIIMS Delhi', summary: 'Hypertension management', medications: ['Amlodipine 5mg OD'] },
            { type: 'LAB_REPORT', date: '2025-07-20', doctor: 'Dr. Mehta', facility: 'District Hospital', summary: 'Blood pressure 145/92 mmHg', tests: ['CBC', 'Lipid Profile'] }
          ]
        },
        '91-1122-3344-5566': {
          found: true,
          patient: {
            id: 'patient-scen-a', name: 'Aarav Mehta', age: 34, gender: 'Male',
            abha_id: '91-1122-3344-5566', language_preference: 'en', phone: '+91 98111 22334'
          },
          abha_health_records: [
            { type: 'PRESCRIPTION', date: '2025-09-01', doctor: 'Dr. Verma, ENT', facility: 'Apollo Hospital', summary: 'Allergic rhinitis', medications: ['Cetirizine 10mg OD'] }
          ]
        }
      };
      return mockRegistry[abhaId] || { found: false, message: 'ABHA ID not found. Please register as new patient.' };
    }
  },

  async createABHA(name: string, age: number, gender: string, phone: string, dob: string): Promise<{ abha_id: string; patient: Patient }> {
    try {
      const res = await fetch(`${API_BASE}/sessions/abha/create?name=${encodeURIComponent(name)}&age=${age}&gender=${encodeURIComponent(gender)}&phone=${encodeURIComponent(phone)}&dob=${encodeURIComponent(dob)}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('API Error');
      return await res.json();
    } catch {
      // Generate mock ABHA ID
      const rnd = () => Math.floor(1000 + Math.random() * 9000);
      const abha_id = `91-${rnd()}-${rnd()}-${rnd()}`;
      const patient: Patient = {
        id: `patient-${Date.now()}`,
        name, age, gender,
        abha_id,
        language_preference: 'hi' as any,
        phone,
      };
      return { abha_id, patient };
    }
  },

  // ── Sessions ───────────────────────────────────────────────────────────────
  async createSession(language: string, abhaId?: string, patientName?: string, patientAge?: number, patientGender?: string) {
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, abha_id: abhaId }),
      });
      if (!res.ok) throw new Error('API Error');
      const session = await res.json();
      // Patch name into session if we have it (backend creates generic name)
      if (patientName && session.patient) {
        session.patient.name = patientName;
        if (patientAge) session.patient.age = patientAge;
        if (patientGender) session.patient.gender = patientGender;
      }
      return session;
    } catch {
      return mockSession(language, abhaId, patientName);
    }
  },

  async getSessions(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/sessions`);
      if (!res.ok) throw new Error('API Error');
      return res.json();
    } catch {
      // Return the pre-seeded demo sessions
      return [
        {
          id: 'session-scen-b', patient_name: 'Rajesh Kumar', age: 52, gender: 'Male',
          abha_id: '91-8823-9912-4012', chief_complaint: 'Knee pain — 2 weeks',
          status: 'NEED_ASSISTANCE', assistance_score: 0.52, started_at: new Date().toISOString()
        },
        {
          id: 'session-scen-a', patient_name: 'Aarav Mehta', age: 34, gender: 'Male',
          abha_id: '91-1122-3344-5566', chief_complaint: 'Dry cough for 3 days',
          status: 'COMPLETED', assistance_score: 0.98, started_at: new Date(Date.now() - 120000).toISOString()
        },
        {
          id: 'session-scen-e', patient_name: 'Vikram Singh', age: 58, gender: 'Male',
          abha_id: '91-7788-9900-1122', chief_complaint: 'Acute chest pain — URGENT',
          status: 'NEED_ASSISTANCE', assistance_score: 0.30, started_at: new Date(Date.now() - 60000).toISOString()
        }
      ];
    }
  },

  // ── Interview ──────────────────────────────────────────────────────────────
  async startInterview(sessionId: string) {
    try {
      const res = await fetch(`${API_BASE}/interview/start/${sessionId}`);
      if (!res.ok) throw new Error('API Error');
      return res.json();
    } catch {
      return {
        session_id: sessionId,
        question: {
          question_id: 'q_chief_complaint',
          category: 'CHIEF_COMPLAINT',
          text: {
            en: 'What primary problem or discomfort brought you to the hospital today?',
            hi: 'आज आपको अस्पताल किस मुख्य समस्या या तकलीफ के कारण आना पड़ा?',
            bn: 'আজ কোন প্রধান সমস্যার কারণে আপনি হাসপাতালে এসেছেন?',
            ta: 'இன்று என்ன முக்கிய பிரச்சனைக்காக மருத்துவமனைக்கு வந்துள்ளீர்கள்?',
            te: 'ఈ రోజు ఏ సమస్యతో ఆసుపత్రికి వచ్చారు?',
            mr: 'आज तुम्हाला काय त्रास होतोय?',
            gu: 'આજે તમને શું તકલીફ છે?',
            kn: 'ಇಂದು ನಿಮಗೆ ಏನು ತೊಂದರೆಯಾಗಿದೆ?',
            ml: 'ഇന്ന് എന്ത് പ്രശ്നത്തിനാണ് ആശുപത്രിയിൽ വന്നത്?',
            pa: 'ਅੱਜ ਤੁਹਾਨੂੰ ਕੀ ਤਕਲੀਫ਼ ਹੈ?',
          },
          options: ['Knee Pain / घुटने में दर्द', 'Chest Pain / सीने में दर्द', 'Fever & Cold / बुखार', 'Stomach Ache / पेट दर्द', 'Other / अन्य'],
        },
        assistance_score: 1.0,
      };
    }
  },

  async submitInterviewResponse(sessionId: string, questionId: string, category: string, answerText: string) {
    try {
      const res = await fetch(`${API_BASE}/interview/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, question_id: questionId, category, answer_text: answerText }),
      });
      if (!res.ok) throw new Error('API Error');
      return res.json();
    } catch {
      const isChestPain = answerText.toLowerCase().includes('chest pain') || answerText.toLowerCase().includes('seene');
      const isSpeechFail = answerText.toLowerCase().includes('muffled') || answerText.toLowerCase().includes('failure');
      const isUnknown = answerText.toLowerCase().includes("don't remember") || answerText.toLowerCase().includes('याद नहीं');
      const score = isChestPain ? 0.30 : isSpeechFail ? 0.48 : isUnknown ? 0.70 : 0.95;

      const nextQuestions: Record<string, Question> = {
        'q_chief_complaint': {
          question_id: 'q_hpi_onset', category: 'HPI',
          text: { en: 'When did this problem start, and is it constant or comes and goes?', hi: 'यह तकलीफ कब से शुरू हुई? लगातार है या आती-जाती है?' },
          options: ['Today / आज', '1–3 Days / 1–3 दिन', 'More than a week / 1 हफ्ते से ज्यादा', 'Chronic / लंबे समय से']
        },
        'q_hpi_onset': {
          question_id: 'q_past_history', category: 'PAST_HISTORY',
          text: { en: 'Do you have any ongoing medical conditions like high BP, diabetes, or heart problems?', hi: 'क्या आपको पहले से कोई बीमारी है जैसे हाई बीपी, शुगर, या दिल की बीमारी?' },
          options: ['High BP / हाई बीपी', 'Diabetes / शुगर', 'Heart Disease / दिल की बीमारी', 'None / कोई नहीं', "Don't remember / याद नहीं"]
        },
        'q_past_history': {
          question_id: 'q_medications', category: 'MEDICATIONS',
          text: { en: 'Are you currently taking any regular medicines or tablets?', hi: 'क्या आप अभी कोई दवाई नियमित रूप से खा रहे हैं?' },
          options: ['Yes, have prescription / हाँ, पर्चा है', 'Yes, but no prescription / हाँ, पर्चा नहीं', 'No medicines / कोई दवाई नहीं', "Don't remember / याद नहीं"]
        },
        'q_medications': {
          question_id: 'q_allergies', category: 'ALLERGIES',
          text: { en: 'Do you have any known allergies to medicines, food, or other substances?', hi: 'क्या आपको किसी दवाई या खाने से एलर्जी है?' },
          options: ['Yes, medicines / दवाई से', 'Yes, food / खाने से', 'No allergies / कोई एलर्जी नहीं', "Don't know / पता नहीं"]
        },
      };

      const next = nextQuestions[questionId] || null;
      return {
        session_id: sessionId,
        transcription: answerText,
        stt_confidence: isSpeechFail ? 0.48 : 0.95,
        is_unknown: isUnknown,
        assistance_score: score,
        next_question: next,
       