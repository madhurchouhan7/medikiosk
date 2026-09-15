from typing import List, Optional, Dict
from app.models.schemas import Question

CLINICAL_QUESTIONS: List[Question] = [
    Question(
        question_id="q_chief_complaint",
        category="CHIEF_COMPLAINT",
        text={
            "en": "What primary problem or discomfort brought you to the hospital today?",
            "hi": "आज आपको अस्पताल किस मुख्य समस्या या तकलीफ के कारण आना पड़ा?",
            "bn": "আজ কোন প্রধান সমস্যার কারণে আপনি হাসপাতালে এসেছেন?",
            "ta": "இன்று என்ன முக்கிய பிரச்சனைக்காக மருத்துவமனைக்கு வந்துள்ளீர்கள்?",
            "te": "ఈ రోజు ఏ సమస్యతో ఆసుపత్రికి వచ్చారు?",
            "mr": "आज तुम्हाला काय त्रास होतोय?",
            "gu": "આજે તમને શું તકલીફ છે?",
            "kn": "ಇಂದು ನಿಮಗೆ ಏನು ತೊಂದರೆಯಾಗಿದೆ?",
            "ml": "ഇന്ന് എന്ത് പ്രശ്നത്തിനാണ് ആശുപത്രിയിൽ വന്നത്?",
            "pa": "ਅੱਜ ਤੁਹਾਨੂੰ ਕੀ ਤਕਲੀਫ਼ ਹੈ?"
        },
        options=["Knee Pain / घुटने में दर्द", "Chest Pain / सीने में दर्द", "Fever & Cold / बुखार", "Stomach Ache / पेट दर्द", "Other Issue / अन्य"]
    ),
    Question(
        question_id="q_hpi_onset",
        category="HPI",
        text={
            "en": "When did this pain or problem start, and is it constant or coming in waves?",
            "hi": "यह दर्द या तकलीफ कब शुरू हुई, और क्या यह लगातार बनी रहती है या आती-जाती है?",
            "bn": "এই ব্যথা বা সমস্যা কখন শুরু হয়েছিল?",
            "ta": "இந்த வலி எப்போது தொடங்கியது?",
            "te": "ఈ నొప్పి ఎప్పుడు ప్రారంభమైంది?",
            "mr": "हा त्रास कधीपासून सुरू झाला?",
            "gu": "આ દુખાવો ક્યારથી શરૂ થયો?",
            "kn": "ಈ ನೋವು ಯಾವಾಗ ಪ್ರಾರಂಭವಾಯಿತು?",
            "ml": "ഈ വേദന എപ്പോൾ തുടങ്ങി?",
            "pa": "ਇਹ ਦਰਦ ਕਦੋਂ ਸ਼ੁਰੂ ਹੋਇਆ?"
        },
        options=["Today / आज ही", "1-3 Days ago / 1-3 दिन से", "More than a week / 1 हफ्ते से अधिक", "Chronic / लंबे समय से"]
    ),
    Question(
        question_id="q_past_history",
        category="PAST_HISTORY",
        text={
            "en": "Do you have any ongoing medical conditions such as high blood pressure, diabetes, asthma, or heart issues?",
            "hi": "क्या आपको पहले से कोई बीमारी जैसे हाई बीपी, डायबिटीज, दमा, या दिल की बीमारी है?",
            "bn": "আপনার কি ডায়াবেটিস, হাই বিপি বা হার্টের সমস্যা আছে?",
            "ta": "உங்களுக்கு உயர் இரத்த அழுத்தம் அல்லது நீரிழிவு நோய் உள்ளதா?",
            "te": "మీకు బిపి లేదా షుగర్ వ్యాధి ఉందా?",
            "mr": "तुम्हाला बीपी किंवा शुगरचा त्रास आहे का?",
            "gu": "તમને હાઇ બીપી કે ડાયાબિટીસની તકલીફ છે?",
            "kn": "ನಿಮಗೆ ಬಿಪಿ ಅಥವಾ ಸಕ್ಕರೆ ಕಾಯಿಲೆ ಇದೆಯೇ?",
            "ml": "നിങ്ങൾക്ക് പ്രമേഹമോ പ്രഷറോ ഉണ്ടോ?",
            "pa": "ਕੀ ਤੁਹਾਨੂੰ ਹਾਈ ਬੀਪੀ ਜਾਂ ਸ਼ੂਗਰ ਹੈ?"
        },
        options=["High BP / हाइपरटेंशन", "Diabetes / शुगर", "Heart Disease / दिल की बीमारी", "None of these / कोई नहीं", "I don't remember / याद नहीं"]
    ),
    Question(
        question_id="q_medications",
        category="MEDICATIONS",
        text={
            "en": "Are you currently taking any regular medications or daily tablets?",
            "hi": "क्या आप वर्तमान में कोई नियमित दवाइयां या रोज की गोलियां ले रहे हैं?",
            "bn": "আপনি কি নিয়মিত কোনো ওষুধ খাচ্ছেন?",
            "ta": "நீங்கள் ஏதேனும் வழக்கமான மருந்துகளை உட்கொள்கிறீர்களா?",
            "te": "మీరు క్రమం తప్పకుండా ఏవైనా మందులు వాడుతున్నారా?",
            "mr": "तुम्ही काही रोजची औषधे घेता का?",
            "gu": "તમે રોજની કોઈ દવાઓ લો છો?",
            "kn": "ನೀವು ನಿಯಮಿತವಾಗಿ ಯಾವುದೇ ಔಷಧ ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದ್ದೀರಾ?",
            "ml": "നിങ്ങൾ സ്ഥിരമായി മരുന്നുകൾ കഴിക്കുന്നുണ്ടോ?",
            "pa": "ਕੀ ਤੁਸੀਂ ਕੋਈ ਦਵਾਈਆਂ ਲੈ ਰਹੇ ਹੋ?"
        },
        options=["Yes, have prescription / हां, पर्ची है", "Taking BP/Sugar meds / बीपी/शुगर की दवा", "No medications / कोई दवा नहीं", "Don't remember names / नाम याद नहीं"]
    ),
    Question(
        question_id="q_allergies",
        category="ALLERGIES",
        text={
            "en": "Do you have any known allergies to any medicines, injections, or foods?",
            "hi": "क्या आपको किसी दवाई, इंजेक्शन या खाने से कोई एलर्जी है?",
            "bn": "আপনার কি কোনো ওষুধে অ্যালার্জি আছে?",
            "ta": "உங்களுக்கு ஏதேனும் மருந்து அலர்ஜி உள்ளதா?",
            "te": "మీకు ఏవైనా మందుల పట్ల అలర్జీ ఉందా?",
            "mr": "तुम्हाला कोणत्या औषधाची ऍलर्जी आहे का?",
            "gu": "તમને કોઈ દવાની એલર્જી છે?",
            "kn": "ನಿಮಗೆ ಯಾವುದಾದರೂ ಔಷಧದ ಅಲರ್ಜಿ ಇದೆಯೇ?",
            "ml": "നിങ്ങൾക്ക് എന്തെങ്കിലും മരുന്ന് അലർജിയുണ്ടോ?",
            "pa": "ਕੀ ਤੁਹਾਨੂੰ ਕਿਸੇ ਦਵਾਈ ਤੋਂ ਐਲਰਜੀ ਹੈ?"
        },
        options=["No Allergies / कोई एलर्जी नहीं", "Penicillin / पेनिसिलिन", "Sulfa Drugs / सल्फा", "Not sure / पता नहीं"]
    )
]

class AdaptiveInterviewEngine:
    @staticmethod
    def get_first_question() -> Question:
        return CLINICAL_QUESTIONS[0]

    @staticmethod
    def get_next_question(current_question_id: str) -> Optional[Question]:
        indices = {q.question_id: idx for idx, q in enumerate(CLINICAL_QUESTIONS)}
        current_idx = indices.get(current_question_id, -1)

        if current_idx != -1 and current_idx + 1 < len(CLINICAL_QUESTIONS):
            return CLINICAL_QUESTIONS[current_idx + 1]
        return None
