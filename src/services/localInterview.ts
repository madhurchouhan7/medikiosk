/**
 * Minimal offline interview fallback. Used ONLY when the server is
 * unreachable: lets the patient keep answering in category order so nothing
 * is lost. Categories (not wording) drive the clinical summary, so the
 * server reconciles queued answers on sync and the doctor view stays
 * correct. As soon as connectivity returns, the kiosk resyncs to the
 * server's adaptive question via GET /interview/next/{session}.
 */
import type { Question } from '../types';

const q = (id: string, category: string, en: string, hi: string): Question => ({
  question_id: id, category, text: { en, hi },
});

export const LOCAL_QUESTIONS: Question[] = [
  q('q_chief_complaint', 'CHIEF_COMPLAINT',
    'What is your main health problem today?',
    'आज आपकी मुख्य स्वास्थ्य समस्या क्या है?'),
  q('q_hpi_site', 'HPI_SITE',
    'Where exactly is the problem located?',
    'तकलीफ शरीर में ठीक किस जगह है?'),
  q('q_hpi_onset', 'HPI_ONSET',
    'When did it start — suddenly or gradually?',
    'यह कब शुरू हुआ — अचानक या धीरे-धीरे?'),
  q('q_hpi_character', 'HPI_CHARACTER',
    'How does it feel — sharp, dull, heavy, or burning?',
    'यह कैसा लगता है — चुभन, भारीपन, या जलन?'),
  q('q_hpi_severity', 'HPI_SEVERITY',
    'How severe is it — mild, moderate, or severe?',
    'यह कितना तेज है — हल्का, मध्यम, या तेज?'),
  q('q_previous_treatment', 'PREVIOUS_TREATMENT',
    'Have you taken any medicine for this yet?',
    'क्या आपने इसके लिए कोई दवा ली है?'),
  q('q_past_medical_history', 'PAST_MEDICAL_HISTORY',
    'Do you have BP, sugar, heart disease, or asthma?',
    'क्या आपको बीपी, शुगर, दिल की बीमारी या दमा है?'),
  q('q_medications', 'MEDICATIONS',
    'Which daily medicines do you take?',
    'आप रोज कौन सी दवाइयां लेते हैं?'),
  q('q_allergies', 'ALLERGIES',
    'Any allergy to any medicine or food?',
    'क्या किसी दवा या खाने से एलर्जी है?'),
  q('q_review_of_systems', 'REVIEW_OF_SYSTEMS',
    'Any other problem — fever, swelling, breathlessness?',
    'कोई और तकलीफ — बुखार, सूजन, सांस फूलना?'),
];

export function nextLocalQuestion(answeredIds: string[]): Question | null {
  return LOCAL_QUESTIONS.find(item => !answeredIds.includes(item.question_id)) || null;
}
