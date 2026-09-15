# MediKiosk Application Route Map

## 1. Landing & Marketing Site (Public)
- `/` - Main landing page (Hero, Problem/Solution, Capabilities, Journey, Tech Stack, Security, CTA)
- `/demo` - Live interactive walkthrough launcher
- `/journey` - Interactive 6-step patient journey breakdown

## 2. Patient Kiosk Portal (`/kiosk`)
- `/kiosk` - Dedicated fullscreen Kiosk container
  - Step 1: `/kiosk/language` - Language Selector (10 Indian languages)
  - Step 2: `/kiosk/auth` - ABHA Sandbox Login / Aadhaar / New Patient Registration
  - Step 3: `/kiosk/consent` - Multilingual Audio Consent & Tap Confirmation
  - Step 4: `/kiosk/interview` - AI Voice/Touch Adaptive Clinical History Interview
  - Step 5: `/kiosk/documents` - Prescription & Medical Report Camera/Upload Scanner
  - Step 6: `/kiosk/review` - Patient summary & extracted item preview
  - Step 7: `/kiosk/complete` - Completion confirmation & automatic kiosk reset timer

## 3. Navigator Assistance Dashboard (`/navigator`)
- `/navigator` - Active operational dashboard for hospital navigators / staff
- `/navigator/tasks` - Filterable queue of low-confidence extraction tasks & help requests
- `/navigator/tasks/:id` - Detailed side-by-side human-in-the-loop verification view

## 4. Doctor Portal (`/doctor`)
- `/doctor` - Physician clinical dashboard
- `/doctor/patients` - Triage list of intake-completed patients
- `/doctor/patients/:id` - Physician intake summary (SOAP layout, Red Flags, Evidence Tracing, Doctor Verification)

## 5. Admin & System Health Portal (`/admin`)
- `/admin` - System overview & server health
- `/admin/status` - Live provider status (LLM, STT, OCR, DB, Cache)
- `/admin/logs` - Compliance & audit trail viewer
