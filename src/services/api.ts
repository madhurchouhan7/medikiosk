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

      const isCardiac = answerText.toLowerCase().includes('chest') || answerText.toLowerCase().includes('seene') || answerText.toLowerCase().includes('heart');

      const nextQuestions: Record<string, Question> = {
        'q_chief_complaint': {
          question_id: 'q_hpi_site', category: 'HPI_SITE',
          text: {
            en: isCardiac ? 'Where exactly is the chest discomfort or tightness located?' : 'Which exact joint or part of the body is causing pain (Right/Left knee, Back, Shoulder)?',
            hi: isCardiac ? 'सीने में दर्द या भारीपन ठीक किस जगह महसूस हो रहा है?' : 'शरीर के किस जोड़ या अंग में दर्द है — दायां घुटना, बायां घुटना, कमर या कंधा?'
          },
          options: isCardiac
            ? ['Center of chest (सीने के बीच में)', 'Left side of chest (सीने के बाईं तरफ)', 'Right side (दाईं तरफ)', 'Upper chest / throat (ऊपरी सीने या गले में)']
            : ['Right Knee (दायां घुटना)', 'Both Knees (दोनों घुटने)', 'Lower Back (कमर का निचला हिस्सा)', 'Left Knee (बायां घुटना)']
        },
        'q_hpi_site': {
          question_id: 'q_hpi_onset', category: 'HPI_ONSET',
          text: {
            en: 'When did this trouble start, and did it happen suddenly or gradually develop over time?',
            hi: 'यह तकलीफ कब शुरू हुई, और क्या यह अचानक शुरू हुई या धीरे-धीरे समय के साथ बढ़ी?'
          },
          options: ['Under 1 hour ago — Sudden (1 घंटे से कम - अचानक)', '1–3 Days ago (1–3 दिन से)', 'More than 2 weeks (2 हफ्ते से ज्यादा)', 'Chronic for months (महीनों पुराना)']
        },
        'q_hpi_onset': {
          question_id: 'q_hpi_character', category: 'HPI_CHARACTER',
          text: {
            en: 'How would you describe the feeling — crushing pressure, sharp catching ache, burning acidity, or dull heaviness?',
            hi: 'यह दर्द कैसा महसूस होता है — भारी दबाव या वजन जैसा, मुड़ने पर चुभने जैसा, जलन, या धीमा भारीपन?'
          },
          options: ['Heavy crushing pressure / weight (भारी दबाव या वजन)', 'Deep dull ache on walking (चलने पर गहरा मीठा दर्द)', 'Sharp catching pain (तेज चुभन जैसा दर्द)', 'Burning sensation (जलन जैसा दर्द)']
        },
        'q_hpi_character': {
          question_id: 'q_hpi_radiation', category: 'HPI_RADIATION',
          text: {
            en: 'Does the pain travel or radiate anywhere else (e.g. to arm/jaw, down the leg, or to back)?',
            hi: 'क्या यह दर्द कहीं और फैलता है (जैसे हाथ/जबड़े में, पैर में नीचे की तरफ, या पीठ में)?'
          },
          options: ['Radiates to left arm & shoulder (बाएं हाथ व कंधे में फैलता है)', 'Radiates down the leg (पैर में नीचे की तरफ जाता है)', 'Radiates to back (पीठ की तरफ जाता है)', 'Does not radiate / localized (कहीं नहीं फैलता)']
        },
        'q_hpi_radiation': {
          question_id: 'q_hpi_associated', category: 'HPI_ASSOCIATED',
          text: {
            en: 'Do you notice cold sweating, breathlessness, joint swelling, morning stiffness, or nausea?',
            hi: 'क्या आपको ठंडा पसीना, सांस फूलना, जोड़ में सूजन, सुबह की जकड़न या जी मिचलाने की समस्या है?'
          },
          options: ['Cold sweating & breathlessness (ठंडा पसीना और सांस फूलना)', 'Joint swelling & morning stiffness (सूजन और सुबह की जकड़न)', 'Breathlessness only (सिर्फ सांस फूलना)', 'None of these (इनमें से कुछ नहीं)']
        },
        'q_hpi_associated': {
          question_id: 'q_hpi_timing', category: 'HPI_TIMING',
          text: {
            en: 'Is the symptom constant right now, or does it come in episodes at particular times of the day?',
            hi: 'क्या यह तकलीफ अभी लगातार बनी हुई है, या दिन के किसी खास समय दौरों में आती-जाती है?'
          },
          options: ['Constant continuous pain (लगातार बना हुआ है)', 'Worse in evening after walking (शाम को चलने के बाद ज्यादा होता है)', 'Worse in morning on waking (सुबह उठते ही ज्यादा रहता है)', 'Comes in episodes of 10–20 mins (10–20 मिनट के दौरों में)']
        },
        'q_hpi_timing': {
          question_id: 'q_hpi_exacerbating', category: 'HPI_EXACERBATING',
          text: {
            en: 'Does walking, stairs, or movement make it worse, and does resting provide relief?',
            hi: 'क्या चलने, सीढ़ी चढ़ने या मुड़ने से दर्द बढ़ता है, और आराम करने से राहत मिलती है?'
          },
          options: ['Worse on walking/stairs, better with rest (चलने पर बढ़ता है, आराम से घटता है)', 'Worse on squatting / bending (उकड़ू बैठने या झुकने पर बढ़ता है)', 'No change with rest (आराम करने से भी फर्क नहीं)']
        },
        'q_hpi_exacerbating': {
          question_id: 'q_hpi_severity', category: 'HPI_SEVERITY',
          text: {
            en: 'On a scale of 1 to 10, how severe is this problem and does it stop you from walking or sleeping?',
            hi: '1 से 10 के पैमाने पर, यह तकलीफ कितनी तेज है और क्या इससे चलना या सोना मुश्किल हो रहा है?'
          },
          options: ['Severe 8–10: Stops routine activities (असहनीय 8–10: सामान्य काम बंद)', 'Moderate 5–7: Distressing but managing (मध्यम 5–7: काफी तकलीफ है)', 'Mild 1–4: Tolerable (हल्का 1–4: सहने योग्य)']
        },
        'q_hpi_severity': {
          question_id: 'q_previous_treatment', category: 'PREVIOUS_TREATMENT',
          text: {
            en: 'Have you taken any medicines, pain pills, sprays, or home remedies for this episode so far?',
            hi: 'क्या आपने इस परेशानी के लिए अब तक कोई दवा, दर्द की गोली, स्प्रे या घरेलू नुस्खा लिया है?'
          },
          options: ['Took pain killer tablet (दर्द की गोली ली है)', 'Took Sorbitrate / Gas tablet (सॉर्बिट्रेट या गैस की गोली ली)', 'Applied pain gel / hot water (सिकाई या दर्द का जेल लगाया)', 'Took nothing (कुछ नहीं लिया)']
        },
        'q_previous_treatment': {
          question_id: 'q_past_medical_history', category: 'PAST_MEDICAL_HISTORY',
          text: {
            en: 'Do you have any ongoing medical conditions like High BP, Diabetes, Heart blockages, or Asthma?',
            hi: 'क्या आपको पहले से कोई बीमारी जैसे हाई बीपी, शुगर (डायबिटीज), दिल की बीमारी या दमा है?'
          },
          options: ['High BP (हाई बीपी)', 'Diabetes (शुगर / मधुमेह)', 'High BP & Diabetes (बीपी और शुगर दोनों)', 'Heart disease (दिल की बीमारी)', 'None (कोई पुरानी बीमारी नहीं)']
        },
        'q_past_medical_history': {
          question_id: 'q_past_surgical_history', category: 'PAST_SURGICAL_HISTORY',
          text: {
            en: 'Have you ever had any operations, heart stents, bone fractures, or hospital admissions in the past?',
            hi: 'क्या पहले कभी आपका कोई ऑपरेशन, दिल में स्टेंट, हड्डी में प्लास्टर या अस्पताल में भर्ती होना पड़ा है?'
          },
          options: ['Heart stent / angioplasty (दिल में स्टेंट लगा है)', 'Previous joint / bone surgery (हड्डी या जोड़ का ऑपरेशन हुआ था)', 'Previous hospital admission (पहले अस्पताल में भर्ती हुए थे)', 'No past surgeries or admissions (कभी कोई ऑपरेशन या भर्ती नहीं)']
        },
        'q_past_surgical_history': {
          question_id: 'q_medications', category: 'MEDICATIONS',
          text: {
            en: 'What regular daily tablets or medicines are you currently taking?',
            hi: 'आप रोज कौन सी दवाइयां नियमित रूप से ले रहे हैं?'
          },
          options: ['BP / Sugar medicines (बीपी या शुगर की दवाएं)', 'Blood thinner (Ecosprin) (खून पतला करने की दवा)', 'Pain medicines / Calcium (दर्द की दवा या कैल्शियम)', 'No regular medications (कोई रोज की दवा नहीं)', 'Have prescription to scan (पर्चा स्कैन करेंगे)']
        },
        'q_medications': {
          question_id: 'q_allergies', category: 'ALLERGIES',
          text: {
            en: 'Do you have any known allergies to Aspirin, Penicillin, pain killers, or any foods/injections?',
            hi: 'क्या आपको एस्पिरिन, पेनिसिलिन, दर्द की दवा या किसी इंजेक्शन/खाने से कोई एलर्जी है?'
          },
          options: ['No known drug allergies (कोई एलर्जी नहीं है)', 'Allergic to Penicillin / Sulfa (पेनिसिलिन या सल्फा से एलर्जी)', 'Pain killers cause stomach burning (दर्द की दवा से पेट में जलन होती है)', 'Not sure (पता नहीं)']
        },
        'q_allergies': {
          question_id: 'q_family_history', category: 'FAMILY_HISTORY',
          text: {
            en: 'Has anyone in your immediate family (parents/siblings) had a heart attack, arthritis, or stroke before age 55?',
            hi: 'क्या परिवार में (माता-पिता, भाई-बहन) किसी को 55 साल से पहले हार्ट अटैक, गठिया या लकवा हुआ है?'
          },
          options: ['Family history of early heart attack (परिवार में कम उम्र में हार्ट अटैक का इतिहास)', 'Family history of severe arthritis (परिवार में गंभीर गठिया की बीमारी)', 'Family history of Diabetes/BP (परिवार में शुगर/बीपी का इतिहास)', 'No significant family history (परिवार में ऐसा कोई इतिहास नहीं)']
        },
        'q_family_history': {
          question_id: 'q_personal_social_history', category: 'PERSONAL_SOCIAL_HISTORY',
          text: {
            en: 'Do you smoke bidi/cigarettes, chew tobacco/gutkha, or drink alcohol? What is your occupation?',
            hi: 'क्या आप बीड़ी/सिगरेट पीते हैं, तंबाकू/गुटखा खाते हैं या शराब लेते हैं? आपका क्या काम है?'
          },
          options: ['Smoke bidi / cigarettes (बीड़ी या सिगरेट पीते हैं)', 'Chew tobacco / gutkha (तंबाकू या गुटखा खाते हैं)', 'Heavy physical standing work (भारी मेहनत या खड़े रहने का काम)', 'Non-smoker / no habits (कोई नशा नहीं / सामान्य दिनचर्या)']
        },
        'q_personal_social_history': {
          question_id: 'q_review_of_systems', category: 'REVIEW_OF_SYSTEMS',
          text: {
            en: 'Have you noticed any feet swelling, breathing trouble when lying down, fever, or weight loss?',
            hi: 'क्या पैरों में सूजन आई है, सीधे लेटने पर सांस फूलती है, बुखार रहता है, या बिना वजह वजन घटा है?'
          },
          options: ['Feet swelling & breathlessness (पैरों में सूजन और सांस फूलना)', 'Fever or unexplained weight loss (बुखार या वजन घटना)', 'None of these symptoms (इनमें से कुछ नहीं)']
        },
        'q_review_of_systems': {
          question_id: 'q_previous_investigations', category: 'PREVIOUS_INVESTIGATIONS',
          text: {
            en: 'Do you have any previous ECG reports, X-rays, blood tests, or discharge summaries with you today?',
            hi: 'क्या आज आपके पास पुरानी ईसीजी (ECG), एक्स-रे, खून की जांच या अस्पताल की पर्ची है?'
          },
          options: ['Yes, have ECG / X-ray report (हाँ, ईसीजी या एक्स-रे रिपोर्ट है)', 'Yes, have recent blood tests (हाँ, हाल की खून जांच रिपोर्ट है)', 'No reports with me today (आज कोई रिपोर्ट साथ नहीं है)']
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
        is_interview_complete: !next,
      };
    }
  },

  // ── Documents ──────────────────────────────────────────────────────────────
  async processDocument(sessionId: string, docType: string, fileOrName: File | string) {
    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('doc_type', docType);
      if (fileOrName instanceof File) {
        formData.append('file', fileOrName);
        formData.append('file_name', fileOrName.name);
      } else {
        formData.append('file_name', fileOrName);
      }

      const res = await fetch(`${API_BASE}/documents/process`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('API Error');
      return res.json();
    } catch {
      const fileName = fileOrName instanceof File ? fileOrName.name : fileOrName;
      const isLowConf = fileName.includes('low_conf') || fileName.includes('blurry') || fileName.includes('handwritten');
      const fileSize = fileOrName instanceof File ? fileOrName.size : 100000;
      const isSmallFile = fileSize < 50000;
      const useLowConf = isLowConf || isSmallFile;

      return {
        document_id: `doc-${Date.now()}`,
        session_id: sessionId,
        raw_text: useLowConf ? 'Rx: Amlodipine [unclear dose 5mg/10mg] OD' : 'Rx:\n1. Amlodipine 5mg OD\n2. Paracetamol 650mg PRN',
        overall_confidence: useLowConf ? 0.52 : 0.96,
        assistance_score: useLowConf ? 0.52 : 0.98,
        requires_verification: useLowConf,
        exception_type: useLowConf ? 'LOW_OCR_CONFIDENCE' : null,
        entities: [
          {
            id: `med-${Date.now()}`,
            session_id: sessionId,
            category: 'MEDICATION',
            entity_name: 'Amlodipine',
            dosage: useLowConf ? '[Unclear 5mg/10mg]' : '5mg',
            frequency: 'Once daily (OD)',
            confidence: useLowConf ? 0.52 : 0.96,
            provenance: 'AI_EXTRACTED',
            source_ref: `${fileName}#line=1`,
            verified: false,
          },
          ...(!useLowConf ? [{
            id: `med-${Date.now() + 1}`,
            session_id: sessionId,
            category: 'MEDICATION' as const,
            entity_name: 'Paracetamol',
            dosage: '650mg',
            frequency: 'As needed (PRN)',
            confidence: 0.94,
            provenance: 'AI_EXTRACTED' as const,
            source_ref: `${fileName}#line=2`,
            verified: false,
          }] : []),
        ],
      };
    }
  },

  // ── Navigator Tasks ────────────────────────────────────────────────────────
  async getAssistanceTasks(tier?: string): Promise<AssistanceTask[]> {
    try {
      const url = tier ? `/assistance/tasks?tier=${tier}` : '/assistance/tasks';
      const res = await fetch(API_BASE + url);
      if (!res.ok) throw new Error('API Error');
      return res.json();
    } catch {
      const all: AssistanceTask[] = [
        {
          id: 'task-scen-b-001', session_id: 'session-scen-b', patient_name: 'Rajesh Kumar',
          exception_category: 'LOW_OCR_CONFIDENCE', tier: 'TIER_2_REMOTE_HUB',
          reason: 'Unreadable prescription dosage (52% confidence) below threshold',
          priority: 'HIGH', status: 'PENDING', assistance_score: 0.52, failed_step: 'DOC_SCAN',
          entities: [{
            id: 'med-scen-b-01', session_id: 'session-scen-b', category: 'MEDICATION',
            entity_name: 'Amlodipine', dosage: '[Unclear 5mg/10mg]', frequency: 'Once daily (OD)',
            confidence: 0.52, provenance: 'AI_EXTRACTED', source_ref: 'blurry_prescription.jpg#line=2', verified: false
          }],
          created_at: new Date().toISOString(),
        },
        {
          id: 'task-scen-c-002', session_id: 'session-scen-c', patient_name: 'Saraswati Devi',
          exception_category: 'LOW_SPEECH_CONFIDENCE', tier: 'TIER_1_OPD_FLOOR',
          reason: 'Speech recognition confidence 48% (dialect / low volume)',
          priority: 'MEDIUM', status: 'PENDING', assistance_score: 0.48, failed_step: 'VOICE_INTERVIEW',
          entities: [], created_at: new Date().toISOString(),
        },
        {
          id: 'task-scen-e-003', session_id: 'session-scen-e', patient_name: 'Vikram Singh',
          exception_category: 'RULE_BASED_SAFETY_FLAG', tier: 'TIER_1_OPD_FLOOR',
          reason: 'CLINICAL RED FLAG: Acute chest pain & diaphoresis detected.',
          priority: 'URGENT', status: 'PENDING', assistance_score: 0.30, failed_step: 'CLINICAL_SAFETY_EVALUATION',
          entities: [], created_at: new Date().toISOString(),
        },
      ];
      if (tier) return all.filter(t => t.tier === tier);
      return all;
    }
  },

  async verifyTask(taskId: string, corrections: any[], navigatorName?: string) {
    try {
      const res = await fetch(`${API_BASE}/assistance/tasks/${taskId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corrections, navigator_name: navigatorName || 'Staff Navigator' }),
      });
      if (!res.ok) throw new Error('API Error');
      return res.json();
    } catch {
      return { message: 'Verified successfully', task_id: taskId, new_assistance_score: 1.0 };
    }
  },

  async escalateTask(taskId: string, note?: string) {
    try {
      const res = await fetch(`${API_BASE}/assistance/tasks/${taskId}/escalate?note=${encodeURIComponent(note || 'Escalated to attending clinician')}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('API Error');
      return res.json();
    } catch {
      return { message: 'Task escalated', task_id: taskId, priority: 'URGENT' };
    }
  },

  // ── Summaries ──────────────────────────────────────────────────────────────
  async listSummaries(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/summaries`);
      if (!res.ok) throw new Error('API Error');
      return res.json();
    } catch {
      return [
        {
          session_id: 'session-scen-b', patient_name: 'Rajesh Kumar', age: 52, gender: 'Male',
          abha_id: '91-8823-9912-4012', chief_complaint: 'Knee pain — 2 weeks',
          status: 'NEED_ASSISTANCE', assistance_score: 0.52, physician_verified: false
        },
        {
          session_id: 'session-scen-a', patient_name: 'Aarav Mehta', age: 34, gender: 'Male',
          abha_id: '91-1122-3344-5566', chief_complaint: 'Dry cough for 3 days',
          status: 'COMPLETED', assistance_score: 0.98, physician_verified: false
        },
        {
          session_id: 'session-scen-e', patient_name: 'Vikram Singh', age: 58, gender: 'Male',
          abha_id: '91-7788-9900-1122', chief_complaint: 'URGENT: Chest pain',
          status: 'NEED_ASSISTANCE', assistance_score: 0.30, physician_verified: false
        }
      ];
    }
  },

  async getSummary(sessionId: string): Promise<ClinicalSummary> {
    try {
      const res = await fetch(`${API_BASE}/summaries/${sessionId}`);
      if (!res.ok) throw new Error('API Error');
      return res.json();
    } catch {
      // Return a meaningful fallback based on session
      const summaries: Record<string, ClinicalSummary> = {
        'session-scen-b': {
          session_id: 'session-scen-b',
          patient: { id: 'patient-scen-b', name: 'Rajesh Kumar', age: 52, gender: 'Male', abha_id: '91-8823-9912-4012', language_preference: 'hi', phone: '+91 98765 43210' },
          chief_complaint: 'Ghutne mein dard (Knee pain) — 2 weeks',
          hpi_summary: 'Pain started 2 weeks ago, worsens on walking and standing. No recent trauma.',
          past_medical_history: ['Hypertension (High BP) — ongoing for 3 years'],
          medications: [{
            id: 'med-01', session_id: 'session-scen-b', category: 'MEDICATION', entity_name: 'Amlodipine',
            dosage: '5mg', frequency: 'Once daily (OD)', confidence: 1.0, provenance: 'HUMAN_VERIFIED',
            source_ref: 'blurry_prescription.jpg#line=2', verified: true, verified_by: 'Staff Navigator (Tier 2)'
          }],
          allergies: ['Not reported — confirm during consultation'],
          review_of_systems: ['Musculoskeletal: Right knee tenderness', 'Cardiovascular: Managed hypertension'],
          red_flags: [{ severity: 'ATTENTION', symptom: 'Co-existing Hypertension', message: 'Patient reports ongoing hypertension.', action_required: 'Check sitting BP prior to examination.' }],
          missing_or_uncertain_info: ['Dosage ambiguity resolved by Tier 2 Reviewer'],
          physician_verified: false,
          disclaimer: 'AI-assisted summary — physician verification required.',
        },
        'session-scen-a': {
          session_id: 'session-scen-a',
          patient: { id: 'patient-scen-a', name: 'Aarav Mehta', age: 34, gender: 'Male', abha_id: '91-1122-3344-5566', language_preference: 'en', phone: '+91 98111 22334' },
          chief_complaint: 'Dry cough for 3 days',
          hpi_summary: 'Onset 3 days ago, mild throat irritation, no fever or shortness of breath.',
          past_medical_history: ['No chronic conditions reported'],
          medications: [{ id: 'med-a', session_id: 'session-scen-a', category: 'MEDICATION', entity_name: 'Cetirizine', dosage: '10mg', frequency: 'Once daily at night', confidence: 0.96, provenance: 'AI_EXTRACTED', source_ref: 'prescription_scen_a.jpg#line=1', verified: false }],
          allergies: ['No known drug allergies'],
          review_of_systems: ['Respiratory: Mild dry cough', 'General: Afebrile'],
          red_flags: [],
          missing_or_uncertain_info: ['None — high-confidence automated intake'],
          physician_verified: false,
          disclaimer: 'AI-assisted summary — physician verification required.',
        },
        'session-scen-e': {
          session_id: 'session-scen-e',
          patient: { id: 'patient-scen-e', name: 'Vikram Singh', age: 58, gender: 'Male', abha_id: '91-7788-9900-1122', language_preference: 'en', phone: '+91 99001 12233' },
          chief_complaint: 'Acute crushing chest pain with left arm radiation',
          hpi_summary: 'Started 45 minutes ago while climbing stairs, accompanied by sweating.',
          past_medical_history: ['Hypertension — known for 5 years'],
          medications: [],
          allergies: ['Penicillin — reported allergy'],
          review_of_systems: ['Cardiovascular: Chest pain, diaphoresis', 'Musculoskeletal: Left arm pain'],
          red_flags: [
            { severity: 'URGENT', symptom: 'Acute Chest Pain', message: 'Reported crushing chest pain with radiation — potential cardiac origin.', action_required: 'Immediate ECG. Activate cardiac emergency protocol.' },
            { severity: 'URGENT', symptom: 'Cardiac Radiation Symptoms', message: 'Left arm radiation with diaphoresis.', action_required: 'Contact on-call cardiologist immediately.' }
          ],
          missing_or_uncertain_info: ['Patient was unable to complete full intake due to urgent symptoms'],
          physician_verified: false,
          disclaimer: 'AI-assisted summary — physician verification required. URGENT CASE.',
        },
      };
      return summaries[sessionId] || summaries['session-scen-b'];
    }
  },

  async verifySummary(sessionId: string, physicianNotes?: string) {
    try {
      const res = await fetch(`${API_BASE}/summaries/${sessionId}/verify?physician_notes=${encodeURIComponent(physicianNotes || 'Verified')}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('API Error');
      return res.json();
    } catch {
      return { message: 'Summary verified', session_id: sessionId, physician_verified: true };
    }
  },

  // ── Admin ──────────────────────────────────────────────────────────────────
  async getOperationalMetrics(): Promise<OperationalMetrics> {
    try {
      const res = await fetch(`${API_BASE}/sessions/metrics/operational`);
      if (!res.ok) throw new Error('API Error');
      return res.json();
    } catch {
      return {
        total_sessions: 142, intake_completion_rate: 0.942, median_intake_time_seconds: 88,
        exception_rate: 0.118, avg_resolution_time_seconds: 32, ocr_correction_rate: 0.084,
        ai_to_human_handoff_rate: 0.096,
      };
    }
  },

  async getAuditLogs(): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/sessions/audit/logs`);
      if (!res.ok) throw new Error('API Error');
      return res.json();
    } catch {
      return [
        { timestamp: '22:30:15', action: 'Session completed automatically', actor: 'System Orchestration', provenance: 'AI_EXTRACTED', details: 'Scenario A: High confidence 98%' },
        { timestamp: '22:31:02', action: 'Exception created: LOW_OCR_CONFIDENCE', actor: 'Task Router', provenance: 'SYSTEM_AUDIT', details: 'Assigned to Tier 2 Remote Reviewer Hub' },
        { timestamp: '22:32:10', action: 'Exception created: LOW_SPEECH_CONFIDENCE', actor: 'Task Router', provenance: 'SYSTEM_AUDIT', details: 'Assigned to Tier 1 OPD Floor Navigator' },
        { timestamp: '22:33:45', action: 'CRITICAL ALERT: RULE_BASED_SAFETY_FLAG', actor: 'Clinical Rules Engine', provenance: 'SYSTEM_AUDIT', details: 'Chest pain emergency protocol triggered' },
        { timestamp: '22:35:12', action: 'Human verified medication Amlodipine 5mg', actor: 'Staff Navigator', provenance: 'HUMAN_VERIFIED', details: 'Resolved task #task-scen-b-001' }
      ];
    }
  },
};
