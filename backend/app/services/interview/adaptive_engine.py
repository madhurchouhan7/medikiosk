from typing import List, Optional, Dict
from app.models.schemas import Question

# ─── Specialty Domain Classifier ──────────────────────────────────────────────
def detect_specialty_domain(text: str) -> str:
    """Classifies chief complaint into clinical organ/specialty domain for targeted inquiry."""
    t = text.lower()
    
    # 1. Cardiac / Respiratory
    if any(k in t for k in [
        'chest', 'seene', 'heart', 'dil', 'breath', 'saans', 'palpitation', 
        'cough', 'khansi', 'choking', 'wheez', 'angina', 'crushing'
    ]):
        return "CARDIAC_RESPIRATORY"
        
    # 2. Musculoskeletal / Orthopedic
    if any(k in t for k in [
        'knee', 'ghutne', 'joint', 'jodo', 'back', 'kamar', 'shoulder', 
        'neck', 'gardan', 'hip', 'swelling', 'sujan', 'fracture', 'sprain', 
        'stiffness', 'arthritis', 'gathiya', 'bone', 'haddi', 'leg pain', 'pair'
    ]):
        return "MUSCULOSKELETAL"
        
    # 3. Gastrointestinal / Abdominal
    if any(k in t for k in [
        'stomach', 'pet', 'abdomen', 'loose motion', 'dast', 'vomit', 'ulti', 
        'nausea', 'gas', 'acid', 'constipat', 'kabz', 'jaundice', 'piliya', 
        'burning in chest', 'heartburn', 'cramp'
    ]):
        return "GASTROINTESTINAL"
        
    # 4. Neurological
    if any(k in t for k in [
        'headache', 'sar dard', 'dizziness', 'chakkar', 'faint', 'behoshi', 
        'seizure', 'daura', 'numb', 'sunn', 'weakness', 'paralysis', 'tremor'
    ]):
        return "NEUROLOGICAL"
        
    # 5. Fever / Infectious
    if any(k in t for k in [
        'fever', 'bukhar', 'chills', 'thand', 'rigor', 'shiver', 
        'infection', 'burning urine', 'peshab', 'rash'
    ]):
        return "FEVER_INFECTION"
        
    return "GENERAL"


# ─── Universal Step 1: Chief Complaint (CC) ───────────────────────────────────
CHIEF_COMPLAINT_QUESTION = Question(
    question_id="q_chief_complaint",
    category="CHIEF_COMPLAINT",
    text={
        "en": "What primary problem or discomfort brought you to the hospital today?",
        "hi": "आज आपको अस्पताल किस मुख्य समस्या या तकलीफ के कारण आना पड़ा?",
        "bn": "আজ কোন প্রধান সমস্যার কারণে আপনি হাসপাতালে এসেছেন?",
        "ta": "இன்று என்ன முக்கிய பிரச்சனைக்காக மருத்துவமனைக்கு வந்துள்ளீர்கள்?",
        "te": "ఈ రోజు ఏ సమస్యతో ఆసుపత్రికి వచ్చారు?",
        "mr": "आज तुम्हाला काय मुख्य त्रास होतोय?",
        "gu": "આજે તમને કઈ મુખ્ય તકલીફ છે?",
        "kn": "ಇಂದು ನಿಮಗೆ ಏನು ಮುಖ್ಯ ತೊಂದರೆಯಾಗಿದೆ?",
        "ml": "ഇന്ന് എന്ത് പ്രധാന പ്രശ്നത്തിനാണ് ആശുപത്രിയിൽ വന്നത്?",
        "pa": "ਅੱਜ ਤੁਹਾਨੂੰ ਕੀ ਮੁੱਖ ਤਕਲੀਫ਼ ਹੈ?"
    },
    options=[
        "Knee / Joint Pain (घुटने या जोड़ों में दर्द)",
        "Chest Pain / Heaviness (सीने में दर्द या भारीपन)",
        "Fever & Bodyache (बुखार और बदन दर्द)",
        "Stomach Ache / Acidity (पेट दर्द या गैस/एसिडिटी)",
        "Breathlessness / Cough (सांस फूलना या खांसी)",
        "Severe Headache / Dizziness (तेज सिरदर्द या चक्कर)"
    ]
)

# ─── Specialty-Specific Dynamic Question Banks (SOCRATES + Systematic History) ─

DOMAIN_QUESTIONS: Dict[str, List[Question]] = {
    # ══════════════════════════════════════════════════════════════════════════
    # 1. CARDIAC & RESPIRATORY (Chest Pain, Breathlessness, Cough)
    # ══════════════════════════════════════════════════════════════════════════
    "CARDIAC_RESPIRATORY": [
        # SOCRATES - Site
        Question(
            question_id="q_hpi_site",
            category="HPI_SITE",
            text={
                "en": "Where exactly is the chest discomfort or tightness located?",
                "hi": "सीने में दर्द या भारीपन ठीक किस जगह महसूस हो रहा है?",
            },
            options=["Center of chest (सीने के बीच में)", "Left side of chest (सीने के बाईं तरफ)", "Right side (दाईं तरफ)", "Upper chest / throat (ऊपरी सीने या गले में)"]
        ),
        # SOCRATES - Onset
        Question(
            question_id="q_hpi_onset",
            category="HPI_ONSET",
            text={
                "en": "When did this chest trouble begin, and did it start suddenly or gradually build up?",
                "hi": "यह तकलीफ कब शुरू हुई, और क्या यह अचानक शुरू हुई या धीरे-धीरे बढ़ी?",
            },
            options=["Under 1 hour ago — Sudden (1 घंटे से कम - अचानक)", "A few hours ago (कुछ घंटों पहले)", "1–3 Days ago (1–3 दिन पहले)", "Coming & going for weeks (हफ्तों से)"]
        ),
        # SOCRATES - Character
        Question(
            question_id="q_hpi_character",
            category="HPI_CHARACTER",
            text={
                "en": "How would you describe the feeling — is it crushing/heavy pressure, sharp like a needle, burning, or tightness?",
                "hi": "यह दर्द कैसा महसूस होता है — भारी दबाव या वजन जैसा, सुई चुभने जैसा, जलन, या जकड़न?",
            },
            options=["Heavy crushing pressure / weight (भारी दबाव या वजन)", "Tight band / squeezing (जकड़न जैसा)", "Burning sensation (जलन जैसा)", "Sharp / stabbing (सुई चुभने जैसा)"]
        ),
        # SOCRATES - Radiation
        Question(
            question_id="q_hpi_radiation",
            category="HPI_RADIATION",
            text={
                "en": "Does the pain travel or radiate anywhere, such as to your left arm, shoulder, neck, jaw, or back?",
                "hi": "क्या यह दर्द कहीं और फैलता है, जैसे बाएं हाथ, कंधे, गर्दन, जबड़े, या पीठ में?",
            },
            options=["Radiates to left arm & shoulder (बाएं हाथ व कंधे में फैलता है)", "Radiates to jaw or neck (जबड़े या गर्दन में)", "Radiates to back (पीठ में)", "Does not spread / localized (कहीं नहीं फैलता)"]
        ),
        # SOCRATES - Associated Symptoms (Proactive AI Probing)
        Question(
            question_id="q_hpi_associated",
            category="HPI_ASSOCIATED",
            text={
                "en": "Do you notice any cold sweating, shortness of breath, nausea, dizziness, or fast heartbeat?",
                "hi": "क्या आपको ठंडा पसीना, सांस लेने में तकलीफ, घबराहट, उल्टी जैसा लगना या चक्कर आ रहे हैं?",
            },
            options=["Cold sweating & breathlessness (ठंडा पसीना और सांस फूलना)", "Shortness of breath only (सिर्फ सांस फूलना)", "Nausea or dizziness (उल्टी जैसा या चक्कर)", "None of these (इनमें से कुछ नहीं)"]
        ),
        # SOCRATES - Timing & Progression
        Question(
            question_id="q_hpi_timing",
            category="HPI_TIMING",
            text={
                "en": "Is the discomfort constant right now, or does it come in episodes lasting several minutes?",
                "hi": "क्या यह दर्द अभी लगातार बना हुआ है, या कुछ मिनटों के दौरों में आता-जाता है?",
            },
            options=["Constant continuous pain (लगातार बना हुआ है)", "Comes in episodes of 10–20 mins (10–20 मिनट के दौरों में)", "Only occurs on walking/climbing (चलने या सीढ़ी चढ़ने पर ही)"]
        ),
        # SOCRATES - Exacerbating & Relieving
        Question(
            question_id="q_hpi_exacerbating",
            category="HPI_EXACERBATING",
            text={
                "en": "Does walking or climbing stairs make it worse, and does sitting down or resting provide relief?",
                "hi": "क्या चलने या सीढ़ी चढ़ने से दर्द बढ़ता है, और आराम से बैठने पर राहत मिलती है?",
            },
            options=["Worse on walking, better with rest (चलने पर बढ़ता है, आराम से घटता है)", "Worse when taking deep breaths (गहरी सांस लेने पर बढ़ता है)", "No change with rest (आराम करने से भी कोई फर्क नहीं)"]
        ),
        # SOCRATES - Severity
        Question(
            question_id="q_hpi_severity",
            category="HPI_SEVERITY",
            text={
                "en": "On a scale of 1 to 10 (where 10 is unbearable), how severe is this chest pain?",
                "hi": "1 से 10 के पैमाने पर (जहाँ 10 असहनीय दर्द है), यह दर्द कितना तेज है?",
            },
            options=["Severe 8–10 / Unbearable (असहनीय 8–10)", "Moderate 5–7 / Distressing (मध्यम 5–7)", "Mild 1–4 / Tolerable (हल्का 1–4)"]
        ),
        # Previous Treatment for this episode
        Question(
            question_id="q_previous_treatment",
            category="PREVIOUS_TREATMENT",
            text={
                "en": "Have you taken any medicines today for this chest pain, such as Sorbitrate, Aspirin, or an antacid/gas tablet?",
                "hi": "क्या आज आपने इस दर्द के लिए कोई दवा ली, जैसे सॉर्बिट्रेट, एस्पिरिन, या गैस की गोली?",
            },
            options=["Took Aspirin or Sorbitrate (एस्पिरिन या सॉर्बिट्रेट ली)", "Took Gas / Antacid tablet (गैस की गोली ली)", "Took home remedy (घरेलू उपाय किया)", "Took nothing (कुछ नहीं लिया)"]
        ),
        # Past Medical History
        Question(
            question_id="q_past_medical_history",
            category="PAST_MEDICAL_HISTORY",
            text={
                "en": "Do you have a known history of High Blood Pressure, Diabetes, Heart blockages, High Cholesterol, or Thyroid?",
                "hi": "क्या आपको पहले से हाई बीपी, शुगर (डायबिटीज), दिल की बीमारी, कोलेस्ट्रॉल या थायराइड है?",
            },
            options=["High BP & Diabetes (हाई बीपी और शुगर दोनों)", "High BP only (सिर्फ हाई बीपी)", "Diabetes only (सिर्फ शुगर)", "Heart disease / Stent (पहले से दिल की बीमारी / स्टेंट)", "None (कोई बीमारी नहीं)"]
        ),
        # Past Surgical & Hospitalization History
        Question(
            question_id="q_past_surgical_history",
            category="PAST_SURGICAL_HISTORY",
            text={
                "en": "Have you ever had any heart procedures, angioplasty/stent, bypass surgery, or previous hospital admissions?",
                "hi": "क्या पहले कभी आपका कोई ऑपरेशन, एंजियोप्लास्टी/स्टेंट, बाईपास सर्जरी हुई है या अस्पताल में भर्ती हुए हैं?",
            },
            options=["Angioplasty / Stent placed (एंजियोप्लास्टी / स्टेंट लगा है)", "Bypass surgery / CABG (बाईपास सर्जरी हुई है)", "Previous ICU admission (पहले अस्पताल में भर्ती हुए थे)", "No surgeries or admissions (कभी कोई ऑपरेशन या भर्ती नहीं)"]
        ),
        # Current Regular Medications
        Question(
            question_id="q_medications",
            category="MEDICATIONS",
            text={
                "en": "What daily tablets do you take regularly, such as blood thinners (Ecosprin), BP tablets (Amlodipine/Telmisartan), or cholesterol meds?",
                "hi": "आप रोज कौन सी दवाइयां खाते हैं, जैसे खून पतला करने वाली (इकोस्पिरिन), बीपी या कोलेस्ट्रॉल की दवा?",
            },
            options=["Blood thinners & BP meds (खून पतला करने व बीपी की दवा)", "BP medicines only (सिर्फ बीपी की दवा)", "Diabetes tablets / Insulin (शुगर की गोली / इंसुलिन)", "No regular medications (कोई रोज की दवा नहीं)", "Have prescription to scan (पर्चा स्कैन करेंगे)"]
        ),
        # Allergy History
        Question(
            question_id="q_allergies",
            category="ALLERGIES",
            text={
                "en": "Do you have any known allergies to Aspirin, Penicillin, pain injections, or any food items?",
                "hi": "क्या आपको एस्पिरिन, पेनिसिलिन, दर्द के इंजेक्शन या किसी खाने से कोई एलर्जी है?",
            },
            options=["No known drug allergies (कोई एलर्जी नहीं है)", "Allergic to Aspirin (एस्पिरिन से एलर्जी)", "Allergic to Penicillin / Antibiotics (पेनिसिलिन से एलर्जी)", "Not sure (पता नहीं)"]
        ),
        # Family History
        Question(
            question_id="q_family_history",
            category="FAMILY_HISTORY",
            text={
                "en": "Has anyone in your immediate family (parents, brothers, sisters) had a heart attack, sudden death, or paralysis before age 55?",
                "hi": "क्या आपके परिवार में (माता-पिता, भाई-बहन) किसी को 55 साल से पहले हार्ट अटैक, अचानक मृत्यु या लकवा हुआ है?",
            },
            options=["Father or Brother had early heart attack (पिता या भाई को कम उम्र में हार्ट अटैक)", "Mother or Sister had heart disease (माता या बहन को दिल की बीमारी)", "Strong family history of Diabetes/BP (परिवार में बीपी/शुगर का इतिहास)", "No family history of early heart disease (परिवार में ऐसा कोई इतिहास नहीं)"]
        ),
        # Personal & Social History
        Question(
            question_id="q_personal_social_history",
            category="PERSONAL_SOCIAL_HISTORY",
            text={
                "en": "Do you smoke bidi/cigarettes, chew tobacco/gutkha, or consume alcohol? What type of daily work or physical labor do you do?",
                "hi": "क्या आप बीड़ी/सिगरेट पीते हैं, तंबाकू/गुटखा खाते हैं या शराब लेते हैं? आपका दैनिक काम किस तरह का है?",
            },
            options=["Smoke bidi / cigarettes regularly (रोज बीड़ी/सिगरेट पीते हैं)", "Chew tobacco / gutkha (तंबाकू या गुटखा खाते हैं)", "Sedentary / desk work (बैठकर काम करते हैं)", "Heavy manual labor (शारीरिक मेहनत का काम)", "Non-smoker / no habits (कोई नशा नहीं करते)"]
        ),
        # Targeted Review of Systems (ROS)
        Question(
            question_id="q_review_of_systems",
            category="REVIEW_OF_SYSTEMS",
            text={
                "en": "Have you noticed any swelling in your feet/ankles, difficulty breathing when lying flat, or recent blackouts?",
                "hi": "क्या पैरों या पंजों में सूजन आई है, सीधे लेटने पर सांस फूलती है, या हाल ही में चक्कर खाकर गिरे हैं?",
            },
            options=["Foot / ankle swelling (पैरों या टखनों में सूजन)", "Breathless when lying flat (सीधे लेटने पर सांस फूलती है)", "Both swelling and breathlessness (सूजन और सांस दोनों)", "None of these symptoms (इनमें से कुछ नहीं)"]
        ),
        # Previous Investigations / Records
        Question(
            question_id="q_previous_investigations",
            category="PREVIOUS_INVESTIGATIONS",
            text={
                "en": "Do you have any previous ECG reports, 2D Echo, blood tests, or hospital discharge summaries with you today?",
                "hi": "क्या आज आपके पास पुरानी ईसीजी (ECG), इको रिपोर्ट, खून की जांच या अस्पताल की डिस्चार्ज पर्ची है?",
            },
            options=["Yes, have ECG or Echo report (हाँ, ईसीजी या इको रिपोर्ट है)", "Yes, have recent blood tests (हाँ, हाल की खून जांच रिपोर्ट है)", "Have old hospital papers (हाँ, पुराने अस्पताल के कागज हैं)", "No previous reports with me (कोई पुरानी रिपोर्ट साथ नहीं है)"]
        ),
    ],

    # ══════════════════════════════════════════════════════════════════════════
    # 2. MUSCULOSKELETAL & ORTHOPEDIC (Joint Pain, Back Pain, Swelling)
    # ══════════════════════════════════════════════════════════════════════════
    "MUSCULOSKELETAL": [
        # SOCRATES - Site
        Question(
            question_id="q_hpi_site",
            category="HPI_SITE",
            text={
                "en": "Which exact joint or part of the body is causing pain (Right knee, Left knee, Both knees, Lower back, or Hip)?",
                "hi": "शरीर के किस जोड़ या अंग में दर्द है — दायां घुटना, बायां घुटना, दोनों घुटने, कमर, या कूल्हा?",
            },
            options=["Right Knee (दायां घुटना)", "Both Knees (दोनों घुटने)", "Lower Back (कमर का निचला हिस्सा)", "Left Knee (बायां घुटना)", "Shoulder or Neck (कंधा या गर्दन)"]
        ),
        # SOCRATES - Onset
        Question(
            question_id="q_hpi_onset",
            category="HPI_ONSET",
            text={
                "en": "When did this pain start, and did it happen after a sudden fall/injury or slowly develop over months/years?",
                "hi": "यह दर्द कब से है, और क्या यह किसी चोट/गिरने के बाद शुरू हुआ या कई महीनों/सालों से धीरे-धीरे बढ़ा है?",
            },
            options=["Developing gradually for months/years (महीनों-सालों से धीरे-धीरे)", "Started 1–2 weeks ago (1–2 हफ्तों से शुरू हुआ)", "Recent fall or injury (हाल ही में चोट या गिरने के बाद)", "Sudden severe onset (अचानक तेज दर्द शुरू हुआ)"]
        ),
        # SOCRATES - Character
        Question(
            question_id="q_hpi_character",
            category="HPI_CHARACTER",
            text={
                "en": "How does the pain feel — deep dull ache, sharp catching pain on moving, burning, or throbbing?",
                "hi": "दर्द किस प्रकार का है — अंदर गहरा मीठा-मीठा दर्द, मुड़ने पर चुभने जैसा, जलन, या टीस मारने जैसा?",
            },
            options=["Deep dull aching pain (अंदर गहरा मीठा दर्द)", "Sharp pain when moving or bending (मुड़ने या चलने पर तेज चुभन)", "Stiffness with throbbing (जकड़न और टीस मारना)", "Burning sensation (जलन जैसा दर्द)"]
        ),
        # SOCRATES - Radiation
        Question(
            question_id="q_hpi_radiation",
            category="HPI_RADIATION",
            text={
                "en": "Does the pain travel or radiate anywhere, such as down your leg/calf or into the thigh/foot?",
                "hi": "क्या यह दर्द कहीं फैलता है, जैसे कमर से नीचे पैर/पिंडली में, या सिर्फ उसी जोड़ में रहता है?",
            },
            options=["Localized strictly to joint (सिर्फ उसी जोड़ में रहता है)", "Radiates down the leg / calf (कमर से नीचे पैर में जाता है)", "Spreads to thigh or hip (जांघ या कूल्हे तक जाता है)"]
        ),
        # SOCRATES - Associated Symptoms (Proactive Probing)
        Question(
            question_id="q_hpi_associated",
            category="HPI_ASSOCIATED",
            text={
                "en": "Do you experience joint swelling, morning stiffness lasting over 30 minutes, cracking/grinding sounds, or joint locking?",
                "hi": "क्या जोड़ में सूजन, सुबह उठने पर आधे घंटे से ज्यादा जकड़न, कटकट की आवाज, या जोड़ के अटकने की समस्या होती है?",
            },
            options=["Morning stiffness & swelling (सुबह जकड़न और सूजन)", "Cracking sounds on walking (चलने पर कटकट की आवाज)", "Joint gives way / locks (जोड़ अटक जाता है या लचक जाता है)", "No swelling or locking (सूजन या अटकन नहीं है)"]
        ),
        # SOCRATES - Timing
        Question(
            question_id="q_hpi_timing",
            category="HPI_TIMING",
            text={
                "en": "Is the pain worse in the morning on waking, or does it worsen toward the evening after walking and standing?",
                "hi": "क्या दर्द सुबह उठते ही ज्यादा होता है, या शाम को चलने-फिरने और खड़े रहने के बाद बढ़ जाता है?",
            },
            options=["Worse in evening after walking (शाम को चलने के बाद बढ़ता है)", "Worse in morning on waking (सुबह सोकर उठने पर ज्यादा रहता है)", "Constant all day and night (दिन-रात लगातार बना रहता है)"]
        ),
        # SOCRATES - Exacerbating & Relieving
        Question(
            question_id="q_hpi_exacerbating",
            category="HPI_EXACERBATING",
            text={
                "en": "What makes it worse (squatting, climbing stairs, sitting on the floor) and what gives relief (rest, hot water, pain gel)?",
                "hi": "किससे दर्द ज्यादा बढ़ता है (उकड़ू बैठने, सीढ़ी चढ़ने, नीचे बैठने से) और किससे आराम मिलता है (सिकाई, आराम, मलहम से)?",
            },
            options=["Worse on stairs & squatting, better with rest (सीढ़ी व उकड़ू बैठने पर बढ़ता है)", "Worse on prolonged sitting (ज्यादा देर बैठे रहने पर बढ़ता है)", "Hot fomentation & pain gel gives relief (सिकाई और मलहम से आराम मिलता है)"]
        ),
        # SOCRATES - Severity & Functional Impact
        Question(
            question_id="q_hpi_severity",
            category="HPI_SEVERITY",
            text={
                "en": "How severely does this affect your ability to walk, climb stairs, sit on the toilet, or sleep at night?",
                "hi": "यह दर्द आपके चलने, सीढ़ी चढ़ने, नीचे बैठने या रात को सोने में कितनी रुकावट डालता है?",
            },
            options=["Severe: Need support to walk (बहुत ज्यादा: चलने के लिए सहारे की जरूरत)", "Moderate: Can walk but with difficulty (मध्यम: चल पाते हैं पर काफी तकलीफ से)", "Mild: Manages daily work with mild ache (हल्का: रोजमर्रा का काम कर लेते हैं)"]
        ),
        # Previous Treatment
        Question(
            question_id="q_previous_treatment",
            category="PREVIOUS_TREATMENT",
            text={
                "en": "Have you taken any pain killers, calcium tablets, knee injections, or done physiotherapy for this?",
                "hi": "क्या आपने इसके लिए कोई दर्द की गोली, कैल्शियम, घुटने का इंजेक्शन या फिजियोथेरेपी कराई है?",
            },
            options=["Taking daily pain tablets (रोज दर्द की गोली खा रहे हैं)", "Took Calcium / Vit D (कैल्शियम या विटामिन डी लिया है)", "Got knee injection / physiotherapy (घुटने में सुई या कसरत कराई है)", "Took no treatment yet (अभी तक कोई इलाज नहीं लिया)"]
        ),
        # Past Medical History
        Question(
            question_id="q_past_medical_history",
            category="PAST_MEDICAL_HISTORY",
            text={
                "en": "Do you have High BP, Diabetes, high Uric Acid (Gout), Thyroid problem, or Osteoporosis (weak bones)?",
                "hi": "क्या आपको हाई बीपी, शुगर, यूरिक एसिड (गठिया/गाउट), थायराइड या हड्डियों की कमजोरी है?",
            },
            options=["High BP (हाई बीपी है)", "High BP & Diabetes (बीपी और शुगर दोनों)", "High Uric Acid / Gout (यूरिक एसिड / गठिया है)", "None of these (इनमें से कुछ नहीं)"]
        ),
        # Past Surgical & Hospitalization History
        Question(
            question_id="q_past_surgical_history",
            category="PAST_SURGICAL_HISTORY",
            text={
                "en": "Have you ever had any orthopedic surgery, bone fracture repair, arthroscopy, or spine surgery?",
                "hi": "क्या पहले कभी आपकी कोई हड्डी की सर्जरी, प्लास्टर, घुटने की दूरबीन जांच या रीढ़ का ऑपरेशन हुआ है?",
            },
            options=["Previous fracture or plaster (पहले कभी हड्डी टूटी या प्लास्टर लगा था)", "Previous joint surgery (पहले जोड़ का ऑपरेशन हुआ था)", "No past bone surgeries (कभी कोई हड्डी की सर्जरी नहीं हुई)"]
        ),
        # Current Regular Medications
        Question(
            question_id="q_medications",
            category="MEDICATIONS",
            text={
                "en": "Are you taking regular medications like Diclofenac, Aceclofenac, Calcium, BP tablets, or Ayurvedic herbal remedies?",
                "hi": "क्या आप दर्द की गोलियां (डाइक्लोफेनाक/एसीक्लोफेनाक), कैल्शियम, बीपी की दवा या कोई आयुर्वेदिक दवाई नियमित खा रहे हैं?",
            },
            options=["Regular pain killers (रोज दर्द की दवा ले रहे हैं)", "BP / Sugar medicines (बीपी या शुगर की दवाएं)", "Calcium & Vitamin D (कैल्शियम और विटामिन डी)", "Ayurvedic / Herbal medicine (आयुर्वेदिक या देसी दवाई)", "Have prescription to scan (पर्चा स्कैन करेंगे)"]
        ),
        # Allergy History
        Question(
            question_id="q_allergies",
            category="ALLERGIES",
            text={
                "en": "Do you have any allergies or stomach burning/ulcers from pain-killer tablets (NSAIDs) or any other drugs?",
                "hi": "क्या आपको दर्द निवारक गोलियों से पेट में जलन/छाले होते हैं या किसी दवा से कोई एलर्जी है?",
            },
            options=["Pain medicines cause severe stomach burning/acidity (दर्द की दवा से पेट में तेज जलन होती है)", "Allergic to specific medicine (किसी खास दवा से एलर्जी है)", "No known allergies (कोई एलर्जी नहीं है)"]
        ),
        # Family History
        Question(
            question_id="q_family_history",
            category="FAMILY_HISTORY",
            text={
                "en": "Did either of your parents or siblings have severe arthritis, bowed legs, or knee replacement surgery?",
                "hi": "क्या आपके माता-पिता या भाई-बहन में किसी को गठिया, घुटने टेढ़े होने या घुटना बदलवाने की बीमारी रही है?",
            },
            options=["Mother or Father had severe knee arthritis (माता या पिता को घुटने का गठिया था)", "Family member had joint replacement (परिवार में घुटना बदलवाया गया है)", "No family history of arthritis (परिवार में किसी को जोड़ों की बीमारी नहीं)"]
        ),
        # Personal & Social History
        Question(
            question_id="q_personal_social_history",
            category="PERSONAL_SOCIAL_HISTORY",
            text={
                "en": "Does your work involve prolonged standing, heavy lifting, or sitting on the floor? Do you smoke or consume tobacco?",
                "hi": "क्या आपके काम में ज्यादा देर खड़ा रहना, भारी वजन उठाना या जमीन पर बैठना पड़ता है? क्या बीड़ी-तंबाकू लेते हैं?",
            },
            options=["Job involves prolonged standing / walking (काम में बहुत देर खड़ा रहना पड़ता है)", "Heavy physical labor / lifting (भारी वजन उठाने का काम है)", "Desk job / sitting work (बैठकर काम करते हैं)", "Chew tobacco or smoke (तंबाकू या बीड़ी लेते हैं)", "None / retired (कोई विशेष मेहनत नहीं / रिटायर्ड)"]
        ),
        # Targeted Review of Systems (ROS)
        Question(
            question_id="q_review_of_systems",
            category="REVIEW_OF_SYSTEMS",
            text={
                "en": "Do you have pain in other small joints (fingers, toes), any unexplained fever, skin rash, or redness in the eyes?",
                "hi": "क्या हाथ-पैर की उंगलियों के छोटे जोड़ों में भी दर्द है, बुखार रहता है, त्वचा पर चकत्ते या आंखों में लाली है?",
            },
            options=["Pain in multiple small finger/toe joints (हाथ-पैर की उंगलियों में भी दर्द है)", "Fever or skin rash (बुखार या त्वचा पर चकत्ते हैं)", "Only knee / back pain — no other symptoms (सिर्फ घुटने या कमर में दर्द है)"]
        ),
        # Previous Investigations / Records
        Question(
            question_id="q_previous_investigations",
            category="PREVIOUS_INVESTIGATIONS",
            text={
                "en": "Do you have any previous knee X-rays, MRI scans, or blood tests (Uric acid / Rheumatoid factor) with you today?",
                "hi": "क्या आज आपके पास घुटने का एक्स-रे (X-ray), एमआरआई, या यूरिक एसिड/आरए फैक्टर की खून जांच रिपोर्ट है?",
            },
            options=["Yes, have knee X-ray (हाँ, घुटने का एक्स-रे है)", "Yes, have MRI or blood tests (हाँ, एमआरआई या खून जांच है)", "No reports with me today (आज कोई रिपोर्ट साथ नहीं है)"]
        ),
    ],

    # ══════════════════════════════════════════════════════════════════════════
    # 3. GASTROINTESTINAL & ABDOMINAL (Stomach Pain, Vomiting, Acidity)
    # ══════════════════════════════════════════════════════════════════════════
    "GASTROINTESTINAL": [
        Question(
            question_id="q_hpi_site",
            category="HPI_SITE",
            text={
                "en": "Where exactly in your stomach or abdomen is the pain (Upper stomach, Lower right, Lower left, or all over)?",
                "hi": "पेट में दर्द ठीक किस जगह है — नाभि के ऊपर, दाईं तरफ नीचे, बाईं तरफ नीचे, या पूरे पेट में?",
            },
            options=["Upper abdomen / Epigastric (नाभि के ऊपर / सीने के नीचे)", "Lower right abdomen (पेट के निचले दाएं हिस्से में)", "Lower left abdomen (पेट के निचले बाएं हिस्से में)", "All over abdomen (पूरे पेट में फैला हुआ)"]
        ),
        Question(
            question_id="q_hpi_onset",
            category="HPI_ONSET",
            text={
                "en": "When did the stomach problem start, and was it sudden severe cramping or a gradual dull burning?",
                "hi": "यह पेट दर्द कब शुरू हुआ — क्या अचानक तेज मरोड़ उठी या धीरे-धीरे जलन/दर्द बढ़ा?",
            },
            options=["Sudden severe pain today (आज अचानक तेज दर्द हुआ)", "Started 2–3 days ago (2–3 दिन पहले शुरू हुआ)", "Chronic problem for months (महीनों से पुराना दर्द है)"]
        ),
        Question(
            question_id="q_hpi_character",
            category="HPI_CHARACTER",
            text={
                "en": "What kind of pain is it — cramping like twists/spasms, severe burning acidity, sharp stabbing, or bloated fullness?",
                "hi": "दर्द किस तरह का है — मरोड़ या ऐंठन जैसा, खट्टी डकार व तेज जलन, सुई चुभने जैसा, या भारी अफारे जैसा?",
            },
            options=["Cramping & spasms (मरोड़ और ऐंठन जैसा)", "Severe burning / acidity (तेज जलन और एसिडिटी)", "Dull constant ache with bloating (भारीपन और धीमा दर्द)", "Sharp stabbing pain (तेज चुभन जैसा दर्द)"]
        ),
        Question(
            question_id="q_hpi_radiation",
            category="HPI_RADIATION",
            text={
                "en": "Does the pain travel straight through to your back, shoulder, or down toward your groin?",
                "hi": "क्या यह दर्द पीठ की तरफ, कंधे पर, या नीचे जांघ/कमर की तरफ जाता है?",
            },
            options=["Radiates to back (पीठ की तरफ जाता है)", "Radiates to shoulder blade (कंधे या पसलियों में जाता है)", "Radiates to groin / lower area (नीचे की तरफ जाता है)", "Stays in one spot (एक ही जगह रहता है)"]
        ),
        Question(
            question_id="q_hpi_associated",
            category="HPI_ASSOCIATED",
            text={
                "en": "Have you had any vomiting, nausea, loose motions, constipation, fever, or yellowing of the eyes/urine?",
                "hi": "क्या आपको उल्टी, दस्त, कब्ज, बुखार, या आंखें/पेशाब पीला पड़ने की शिकायत हुई है?",
            },
            options=["Vomiting & nausea (उल्टी और जी मिचलाना)", "Loose motions / diarrhea (दस्त या पतले दस्त)", "Severe constipation (गंभीर कब्ज / पेट साफ न होना)", "Yellow eyes / jaundice signs (आंखें या पेशाब पीला पड़ना)", "None of these (इनमें से कुछ नहीं)"]
        ),
        Question(
            question_id="q_hpi_timing",
            category="HPI_TIMING",
            text={
                "en": "Is the pain related to food — does it get worse on an empty stomach or immediately after eating spicy/heavy meals?",
                "hi": "क्या खाने से दर्द का संबंध है — क्या खाली पेट दर्द बढ़ता है या तीखा/भारी खाना खाने के तुरंत बाद?",
            },
            options=["Worse immediately after meals (खाना खाने के तुरंत बाद बढ़ता है)", "Worse on empty stomach / late night (खाली पेट या देर रात ज्यादा होता है)", "No relation to meals (खाने-पीने से कोई संबंध नहीं)"]
        ),
        Question(
            question_id="q_hpi_exacerbating",
            category="HPI_EXACERBATING",
            text={
                "en": "Does taking antacid syrup or milk help, or does bending forward relieve the pain?",
                "hi": "क्या एंटासिड सिरप, ठंडा दूध पीने या आगे झुककर बैठने से आराम मिलता है?",
            },
            options=["Relieved by antacid / milk (सिरप या दूध से आराम मिलता है)", "Relieved by leaning forward (आगे झुककर बैठने से आराम मिलता है)", "Nothing relieves the pain (किसी चीज से आराम नहीं मिलता)"]
        ),
        Question(
            question_id="q_hpi_severity",
            category="HPI_SEVERITY",
            text={
                "en": "On a scale of 1 to 10, how intense is the stomach pain right now?",
                "hi": "1 से 10 के पैमाने पर, पेट का दर्द अभी कितना तेज है?",
            },
            options=["Severe 8–10: Unable to sit still (असहनीय 8–10: बैठा नहीं जा रहा)", "Moderate 5–7: Hard to work (मध्यम 5–7: काम करना मुश्किल)", "Mild 1–4: Tolerable discomfort (हल्का 1–4: सहने योग्य)"]
        ),
        Question(
            question_id="q_previous_treatment",
            category="PREVIOUS_TREATMENT",
            text={
                "en": "Have you taken any gas tablets (Pan-D, Omez), pain medicines, or home churna/kadha for this?",
                "hi": "क्या आपने इसके लिए गैस की गोली (पैन-डी, ओमेज), दर्द की दवा, या कोई घरेलू चूर्ण/काढ़ा लिया है?",
            },
            options=["Took gas tablet Pantoprazole/Omez (गैस की गोली पैन-डी/ओमेज ली)", "Took pain killer / antispasmodic (दर्द या मरोड़ की गोली ली)", "Took home churna / remedy (घरेलू चूर्ण लिया)", "Took nothing (कुछ नहीं लिया)"]
        ),
        Question(
            question_id="q_past_medical_history",
            category="PAST_MEDICAL_HISTORY",
            text={
                "en": "Do you have a history of stomach ulcers, gallstones, liver problems, Hepatitis, or Diabetes?",
                "hi": "क्या आपको पहले से पेट में छाले (अल्सर), पित्त की थैली की पथरी, लिवर की बीमारी या शुगर है?",
            },
            options=["History of gallstones (पित्त की थैली में पथरी रही है)", "History of acidity / stomach ulcers (अल्सर या पुरानी एसिडिटी)", "History of jaundice / liver disease (पीलिया या लिवर की बीमारी)", "None of these (इनमें से कोई बीमारी नहीं)"]
        ),
        Question(
            question_id="q_past_surgical_history",
            category="PAST_SURGICAL_HISTORY",
            text={
                "en": "Have you ever had an appendix operation, gallbladder removal, hernia surgery, or endoscopy?",
                "hi": "क्या पहले कभी अपेंडिक्स, पित्त की थैली, हार्निया का ऑपरेशन या पेट की दूरबीन जांच (एंडोस्कोपी) हुई है?",
            },
            options=["Had appendix or gallbladder removed (अपेंडिक्स या पित्त की थैली का ऑपरेशन हुआ था)", "Had hernia surgery (हर्निया का ऑपरेशन हुआ था)", "Had endoscopy previously (पहले एंडोस्कोपी कराई थी)", "No previous abdominal surgeries (पेट का कोई ऑपरेशन नहीं हुआ)"]
        ),
        Question(
            question_id="q_medications",
            category="MEDICATIONS",
            text={
                "en": "Are you taking regular medications like pain killers, blood thinners, steroid tablets, or Ayurvedic medicines?",
                "hi": "क्या आप नियमित रूप से दर्द की दवा, खून पतला करने वाली दवा, स्टेरॉयड, या देसी दवाई लेते हैं?",
            },
            options=["Regular pain killers (अक्सर दर्द की गोलियां खाते हैं)", "Blood thinner Aspirin (खून पतला करने की दवा)", "No regular medications (कोई रोज की दवा नहीं)", "Have prescription to scan (पर्चा स्कैन करेंगे)"]
        ),
        Question(
            question_id="q_allergies",
            category="ALLERGIES",
            text={
                "en": "Do you have any allergies to antibiotics, pain medicines, or specific foods?",
                "hi": "क्या आपको किसी एंटीबायोटिक, दर्द की दवा या किसी खास भोजन से एलर्जी है?",
            },
            options=["No known allergies (कोई एलर्जी नहीं है)", "Allergic to certain antibiotics (कुछ एंटीबायोटिक से एलर्जी है)", "Not sure (पता नहीं)"]
        ),
        Question(
            question_id="q_family_history",
            category="FAMILY_HISTORY",
            text={
                "en": "Has anyone in your family had stomach or bowel cancers, gallstones, or liver disease?",
                "hi": "क्या परिवार में किसी को पेट/आंत का कैंसर, पथरी या लिवर की बीमारी रही है?",
            },
            options=["Family history of gallstones / liver (परिवार में पथरी या लिवर की बीमारी)", "Family history of stomach cancer (परिवार में पेट की गांठ/कैंसर)", "No family history (परिवार में ऐसा कोई इतिहास नहीं)"]
        ),
        Question(
            question_id="q_personal_social_history",
            category="PERSONAL_SOCIAL_HISTORY",
            text={
                "en": "Do you consume alcohol, smoke/tobacco, or eat a lot of spicy/outside food? How are your stress levels?",
                "hi": "क्या आप शराब, बीड़ी-सिगरेट या तंबाकू लेते हैं? क्या बाहर का तीखा-तला खाना ज्यादा खाते हैं?",
            },
            options=["Drink alcohol occasionally or regularly (शराब पीते हैं)", "Chew tobacco or smoke (तंबाकू या बीड़ी पीते हैं)", "Heavy spicy / outside diet (तीखा-तला खाना ज्यादा खाते हैं)", "None of these / clean diet (सादा भोजन / कोई नशा नहीं)"]
        ),
        Question(
            question_id="q_review_of_systems",
            category="REVIEW_OF_SYSTEMS",
            text={
                "en": "Have you noticed any black or bloody stools, unexplained weight loss, or loss of appetite?",
                "hi": "क्या शौच में काला या खून जैसा मल आया है, वजन तेजी से घटा है, या भूख बिल्कुल नहीं लग रही?",
            },
            options=["Black or bloody stools (शौच में काला या लाल खून आया है)", "Unexplained weight loss & poor appetite (वजन कम हुआ है और भूख नहीं लगती)", "Normal stools, no weight loss (शौच सामान्य है, वजन नहीं घटा)"]
        ),
        Question(
            question_id="q_previous_investigations",
            category="PREVIOUS_INVESTIGATIONS",
            text={
                "en": "Do you have any ultrasound abdomen scan, endoscopy report, or Liver Function blood tests with you today?",
                "hi": "क्या आज आपके पास पेट का अल्ट्रासाउंड, एंडोस्कोपी या लिवर जांच रिपोर्ट है?",
            },
            options=["Yes, have Ultrasound abdomen report (हाँ, पेट के अल्ट्रासाउंड की रिपोर्ट है)", "Yes, have endoscopy or blood tests (हाँ, एंडोस्कोपी या खून रिपोर्ट है)", "No previous reports with me (कोई पुरानी रिपोर्ट साथ नहीं है)"]
        ),
    ],

    # ══════════════════════════════════════════════════════════════════════════
    # 4. GENERAL / DEFAULT (Fever, Headache, Cough, General Malaise)
    # ══════════════════════════════════════════════════════════════════════════
    "GENERAL": [
        Question(
            question_id="q_hpi_site",
            category="HPI_SITE",
            text={
                "en": "Where in your body do you feel the most trouble (head, throat, chest, urinary, or whole body)?",
                "hi": "शरीर के किस हिस्से में सबसे ज्यादा परेशानी है — सिर, गला, छाती, पेशाब, या पूरे बदन में?",
            },
            options=["Head / Forehead (सिर या माथे में)", "Throat & Chest (गले और छाती में)", "Whole body aches & weakness (पूरे बदन में दर्द व कमजोरी)", "Urinary tract / Burning (पेशाब में जलन / पेट के नीचे)"]
        ),
        Question(
            question_id="q_hpi_onset",
            category="HPI_ONSET",
            text={
                "en": "How many days has this problem been going on, and is it getting progressively worse?",
                "hi": "यह परेशानी कितने दिनों से चल रही है, और क्या यह दिन-ब-दिन बढ़ती जा रही है?",
            },
            options=["1–2 Days (1–2 दिन से)", "3–7 Days (3–7 दिन से)", "More than 2 weeks (2 हफ्ते से ज्यादा)", "Months (महीनों से)"]
        ),
        Question(
            question_id="q_hpi_character",
            category="HPI_CHARACTER",
            text={
                "en": "How would you describe your symptoms — high fever with shivering, dull heavy fatigue, or throbbing pain?",
                "hi": "तकलीफ कैसी महसूस होती है — ठंड लगकर तेज बुखार, भारी कमजोरी व बदन टूटना, या तेज टीस?",
            },
            options=["High fever with shivering/chills (कंपकंपी के साथ तेज बुखार)", "Heavy fatigue & severe body ache (भारी कमजोरी और बदन दर्द)", "Throbbing headache (सिर में तेज टीस मारना)", "Continuous dry/wet cough (लगातार खांसी)"]
        ),
        Question(
            question_id="q_hpi_radiation",
            category="HPI_RADIATION",
            text={
                "en": "Does the discomfort spread anywhere else in your body?",
                "hi": "क्या यह दर्द या तकलीफ शरीर में कहीं और भी फैलती है?",
            },
            options=["Spreads to neck & shoulders (गर्दन और कंधों में जाती है)", "All over whole body (पूरे शरीर में फैली हुई है)", "Stays in one localized area (एक ही जगह सीमित है)"]
        ),
        Question(
            question_id="q_hpi_associated",
            category="HPI_ASSOCIATED",
            text={
                "en": "Do you have any accompanying symptoms like vomiting, skin rashes, burning urine, breathlessness, or eye pain?",
                "hi": "क्या साथ में कोई अन्य लक्षण हैं जैसे उल्टी, त्वचा पर दाने, पेशाब में जलन, सांस फूलना या आंखों में दर्द?",
            },
            options=["Cough & throat pain (खांसी और गले में खराश)", "Burning in urine (पेशाब में जलन)", "Vomiting & loose motions (उल्टी और दस्त)", "Skin rash or red spots (त्वचा पर दाने या लाल चकत्ते)", "None of these (इनमें से कुछ नहीं)"]
        ),
        Question(
            question_id="q_hpi_timing",
            category="HPI_TIMING",
            text={
                "en": "Does the fever or symptom spike at a particular time, such as every evening or night?",
                "hi": "क्या बुखार या तकलीफ किसी खास समय ज्यादा होती है, जैसे रोज शाम को या रात में?",
            },
            options=["Spikes mostly in evening / night (शाम या रात में ज्यादा बढ़ता है)", "Continuous all day (पूरे दिन एक जैसा बना रहता है)", "Comes in irregular spikes (रुक-रुक कर कभी भी आ जाता है)"]
        ),
        Question(
            question_id="q_hpi_exacerbating",
            category="HPI_EXACERBATING",
            text={
                "en": "Does resting or taking Paracetamol bring down the fever/symptom temporarily?",
                "hi": "क्या आराम करने या पैरासिटामोल लेने से बुखार या दर्द कुछ देर के लिए कम होता है?",
            },
            options=["Paracetamol lowers fever for a few hours (दवा से कुछ घंटे बुखार उतरता है)", "No relief from medicines (दवा लेने पर भी आराम नहीं मिलता)", "Have not taken any medicines (कोई दवा नहीं ली)"]
        ),
        Question(
            question_id="q_hpi_severity",
            category="HPI_SEVERITY",
            text={
                "en": "How severely does this affect your daily routine — are you unable to get out of bed?",
                "hi": "यह तकलीफ आपकी दिनचर्या को कितना प्रभावित कर रही है — क्या बिस्तर से उठना भी मुश्किल है?",
            },
            options=["Severe: Bed-bound and very weak (बहुत ज्यादा: बिस्तर से उठना मुश्किल)", "Moderate: Doing light tasks with difficulty (मध्यम: मुश्किल से हल्का काम कर पा रहे हैं)", "Mild: Managing normal routine (हल्का: सामान्य काम कर रहे हैं)"]
        ),
        Question(
            question_id="q_previous_treatment",
            category="PREVIOUS_TREATMENT",
            text={
                "en": "What medicines have you already taken for this, such as antibiotics, Paracetamol, or cough syrups?",
                "hi": "इसके लिए आपने पहले से कौन सी दवाएं ली हैं, जैसे एंटीबायोटिक, पैरासिटामोल, या कफ सिरप?",
            },
            options=["Took Paracetamol / Crocin (पैरासिटामोल या क्रोसिन ली)", "Took antibiotic course from medical store (दुकान से एंटीबायोटिक ली)", "Took cough syrup or home remedy (कफ सिरप या काढ़ा लिया)", "Took nothing (कुछ नहीं लिया)"]
        ),
        Question(
            question_id="q_past_medical_history",
            category="PAST_MEDICAL_HISTORY",
            text={
                "en": "Do you have any chronic conditions like Diabetes, High BP, Asthma, Kidney trouble, or TB in the past?",
                "hi": "क्या आपको पहले से कोई पुरानी बीमारी है जैसे शुगर, हाई बीपी, दमा, किडनी की समस्या या पुरानी टीबी?",
            },
            options=["Diabetes (शुगर की बीमारी है)", "High BP (हाई बीपी है)", "Asthma / Breathing trouble (दमा या सांस की बीमारी)", "None / generally healthy (कोई पुरानी बीमारी नहीं)"]
        ),
        Question(
            question_id="q_past_surgical_history",
            category="PAST_SURGICAL_HISTORY",
            text={
                "en": "Have you ever been hospitalized or undergone any major surgeries in the past?",
                "hi": "क्या पहले कभी आपको अस्पताल में भर्ती होना पड़ा या कोई बड़ा ऑपरेशन हुआ है?",
            },
            options=["Previous hospital admission (पहले अस्पताल में भर्ती हुए थे)", "Had previous surgery (पहले कोई ऑपरेशन हुआ था)", "Never hospitalized / no surgeries (कभी भर्ती या ऑपरेशन नहीं हुआ)"]
        ),
        Question(
            question_id="q_medications",
            category="MEDICATIONS",
            text={
                "en": "What regular daily medicines or inhalers do you use?",
                "hi": "आप रोज कौन सी दवाइयां या इन्हेलर इस्तेमाल करते हैं?",
            },
            options=["Regular BP or Diabetes pills (बीपी या शुगर की दवाएं)", "Using inhaler for breathing (सांस का इन्हेलर लेते हैं)", "No daily medications (कोई रोज की दवा नहीं लेते)", "Have prescription to scan (पर्चा स्कैन करेंगे)"]
        ),
        Question(
            question_id="q_allergies",
            category="ALLERGIES",
            text={
                "en": "Do you have any drug allergies, such as to Penicillin, Sulfa drugs, or pain injections?",
                "hi": "क्या आपको किसी दवा से एलर्जी है, जैसे पेनिसिलिन, सल्फा, या दर्द के इंजेक्शन से?",
            },
            options=["No drug allergies (कोई एलर्जी नहीं है)", "Allergic to Penicillin (पेनिसिलिन से एलर्जी है)", "Allergic to Sulfa drugs (सल्फा दवाओं से एलर्जी है)", "Not sure (पता नहीं)"]
        ),
        Question(
            question_id="q_family_history",
            category="FAMILY_HISTORY",
            text={
                "en": "Is anyone at home or in your close family currently suffering from the same illness, or have TB/chronic disease?",
                "hi": "क्या घर या परिवार में किसी और को भी यही बीमारी है, या टीबी/पुरानी बीमारी रही है?",
            },
            options=["Other family members also have fever/cough (घर में अन्य लोगों को भी बुखार/खांसी है)", "Family member had TB in past (परिवार में पहले टीबी का इतिहास रहा है)", "No family illness (घर में किसी और को कोई बीमारी नहीं)"]
        ),
        Question(
            question_id="q_personal_social_history",
            category="PERSONAL_SOCIAL_HISTORY",
            text={
                "en": "Do you smoke, chew tobacco, or have you recently traveled out of town? What is your occupation?",
                "hi": "क्या आप बीड़ी-सिगरेट या तंबाकू लेते हैं? क्या हाल ही में कहीं बाहर यात्रा की है? आपका क्या काम है?",
            },
            options=["Smoker / Tobacco user (बीड़ी-सिगरेट या तंबाकू लेते हैं)", "Recent travel out of town (हाल ही में बाहर यात्रा की थी)", "Daily wage / outdoor work (धूप या बाहर का काम है)", "Non-smoker / normal lifestyle (कोई नशा नहीं / सामान्य दिनचर्या)"]
        ),
        Question(
            question_id="q_review_of_systems",
            category="REVIEW_OF_SYSTEMS",
            text={
                "en": "Have you noticed any unintentional weight loss, night sweats, severe weakness, or bleeding from anywhere?",
                "hi": "क्या बिना वजह वजन कम हुआ है, रात को पसीना आता है, बहुत ज्यादा कमजोरी है, या कहीं से खून आया है?",
            },
            options=["Night sweats & weight loss (रात को पसीना और वजन घटना)", "Severe weakness / fatigue (बहुत ज्यादा कमजोरी)", "None of these (इनमें से कुछ नहीं)"]
        ),
        Question(
            question_id="q_previous_investigations",
            category="PREVIOUS_INVESTIGATIONS",
            text={
                "en": "Do you have any previous blood test reports (CBC, Dengue, Malaria, Typhoid), X-rays, or urine tests with you?",
                "hi": "क्या आज आपके पास खून की जांच (सीबीसी, डेंगू, मलेरिया, टाइफाइड), छाती का एक्स-रे या पेशाब की जांच रिपोर्ट है?",
            },
            options=["Yes, have blood test report (हाँ, खून जांच रिपोर्ट है)", "Yes, have Chest X-ray (हाँ, छाती का एक्स-रे है)", "No reports with me today (आज कोई रिपोर्ट साथ नहीं है)"]
        ),
    ]
}


class AdaptiveInterviewEngine:
    @staticmethod
    def get_first_question() -> Question:
        """Always starts with the structured Chief Complaint question."""
        return CHIEF_COMPLAINT_QUESTION

    @staticmethod
    def get_domain_from_responses(responses: List[dict]) -> str:
        """Inspects past responses to find the chief complaint and identify clinical domain."""
        for r in responses:
            cat = r.get("category", "")
            ans = r.get("answer_text", "")
            if cat == "CHIEF_COMPLAINT" and ans:
                return detect_specialty_domain(ans)
        return "GENERAL"

    @staticmethod
    def get_next_question(current_question_id: str, responses: List[dict] = None) -> Optional[Question]:
        """
        Dynamically sequences questions based on the 12-point clinical framework:
        1. CC -> Detects Domain
        2. SOCRATES HPI (Site, Onset, Character, Radiation, Associated, Timing, Exacerbating, Severity)
        3. Previous Treatment
        4. Past Medical History
        5. Past Surgical History
        6. Medications
        7. Allergies
        8. Family History
        9. Personal/Social History
        10. Review of Systems
        11. Previous Investigations
        """
        responses = responses or []
        domain = AdaptiveInterviewEngine.get_domain_from_responses(responses)
        domain_list = DOMAIN_QUESTIONS.get(domain, DOMAIN_QUESTIONS["GENERAL"])

        # If current question was the Chief Complaint, move to the domain's first question (q_hpi_site)
        if current_question_id == "q_chief_complaint":
            return domain_list[0] if domain_list else None

        # Otherwise find where we are in the domain list
        ids = [q.question_id for q in domain_list]
        try:
            current_idx = ids.index(current_question_id)
            if current_idx + 1 < len(domain_list):
                return domain_list[current_idx + 1]
            return None
        except ValueError:
            # Fallback if question_id is not in current domain
            return None
