export type LanguageCode = 'en' | 'hi' | 'bn' | 'ta' | 'te' | 'mr' | 'gu' | 'kn' | 'ml' | 'pa';

export type ProvenanceType = 'PATIENT_REPORTED' | 'AI_EXTRACTED' | 'HUMAN_VERIFIED' | 'CLINICIAN_CONFIRMED';

export type ExceptionCategory = 
  | 'LOW_SPEECH_CONFIDENCE'
  | 'LOW_OCR_CONFIDENCE'
  | 'INCOMPLETE_ANSWERS'
  | 'INTERACTION_FAILURE'
  | 'PATIENT_REQUEST'
  | 'RULE_BASED_SAFETY_FLAG';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  abha_id: string;
  language_preference: LanguageCode;
  phone?: string;
}

export interface Question {
  question_id: string;
  category: string;
  text: Record<string, string>;
  options?: string[];
}

export interface ExtractedEntity {
  id: string;
  session_id: string;
  category: 'MEDICATION' | 'DIAGNOSIS' | 'INVESTIGATION' | 'ALLERGY';
  entity_name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  confidence: number;
  provenance: ProvenanceType;
  source_ref: string;
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
}

export interface AssistanceTask {
  id: string;
  session_id: string;
  patient_name: string;
  exception_category: ExceptionCategory;
  tier: 'TIER_1_OPD_FLOOR' | 'TIER_2_REMOTE_HUB';
  reason: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
  assistance_score: number;
  failed_step: string;
  entities: ExtractedEntity[];
  created_at: string;
}

export interface RedFlagAlert {
  severity: 'NORMAL' | 'ATTENTION' | 'URGENT';
  symptom: string;
  message: string;
  action_required: string;
}

export interface ClinicalSummary {
  session_id: string;
  patient: Patient;
  chief_complaint: string;
  hpi_summary: string;
  past_medical_history: string[];
  medications: ExtractedEntity[];
  allergies: string[];
  review_of_systems: string[];
  red_flags: RedFlagAlert[];
  missing_or_uncertain_info: string[];
  physician_verified: boolean;
  physician_notes?: string;
  disclaimer: string;
}

export interface OperationalMetrics {
  total_sessions: number;
  intake_completion_rate: number;
  median_intake_time_seconds: number;
  exception_rate: number;
  avg_resolution_time_seconds: number;
  ocr_correction_rate: number;
  ai_to_human_handoff_rate: number;
}
