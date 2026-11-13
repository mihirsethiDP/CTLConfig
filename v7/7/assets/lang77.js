/* v7/7 · lang77.js — the language of what an operator reads.
   The configuration screens stay in English. What an operator reads on the phone card, in a task's steps and in a diagnostic's
   questions is kept once per language, so adding a language adds no field. The picker in the top bar shows that text in English,
   Hindi, Marathi or Tamil, so an admin can read it as the operator will before a plant goes live.
   A string with no translation yet is shown in English and marked. Every translation here is a first draft: none has been read by
   a native speaker, and each flow says so until someone marks it reviewed.

   window.V7LANG:
     LANGS [{id, name, own}] · cur() · set(id) · t(text) → the text in the chosen language, or null
     flowState(flowId, lang) → 'none' | 'draft' | 'reviewed' · review(flowId, lang) · coverage(lang) → {flows, flowsAll, reviewed, words, names}
     pickerHtml()
   The choice and the reviews are kept in this browser ('ctl77.lang'); they are not part of a plant's saved state. */
(function () {
  'use strict';
  const W = window; const KEY = 'ctl77.lang';
  const LANGS = [{ id: 'en', name: 'English', own: 'English' }, { id: 'hi', name: 'Hindi', own: 'हिन्दी' }, { id: 'mr', name: 'Marathi', own: 'मराठी' }, { id: 'ta', name: 'Tamil', own: 'தமிழ்' }];
  const IX = { hi: 1, mr: 2, ta: 3 };
  /* the words of the card itself: [English, Hindi, Marathi, Tamil] */
  const WORDS = [
    ['All quiet', 'सब ठीक है', 'सर्व ठीक आहे', 'எல்லாம் சரியாக உள்ளது'],
    ['Nothing is open and nothing is due.', 'कोई समस्या खुली नहीं है और कोई काम बाकी नहीं है।', 'कोणतीही समस्या उघडी नाही आणि कोणतेही काम बाकी नाही.', 'எந்தச் சிக்கலும் திறந்திருக்கவில்லை, எந்த வேலையும் நிலுவையில் இல்லை.'],
    ['Every reading is inside its limits. Nothing is due.', 'हर रीडिंग अपनी सीमा के अंदर है। कोई काम बाकी नहीं है।', 'प्रत्येक रीडिंग मर्यादेत आहे. कोणतेही काम बाकी नाही.', 'எல்லா அளவீடுகளும் வரம்புக்குள் உள்ளன. எந்த வேலையும் நிலுவையில் இல்லை.'],
    ['Readings', 'रीडिंग', 'रीडिंग', 'அளவீடுகள்'],
    ['Sample readings', 'नमूना रीडिंग', 'नमुना रीडिंग', 'மாதிரி அளவீடுகள்'],
    ['The Visualization sends no readings for this equipment.', 'इस उपकरण की कोई रीडिंग नहीं आती।', 'या उपकरणाची कोणतीही रीडिंग येत नाही.', 'இந்தக் கருவிக்கு அளவீடுகள் எதுவும் வருவதில்லை.'],
    ['Report a problem', 'समस्या बताएँ', 'समस्या कळवा', 'சிக்கலைத் தெரிவிக்கவும்'],
    ['Inside the limits', 'सीमा के अंदर', 'मर्यादेत', 'வரம்புக்குள்'],
    ['Counts up', 'बढ़ती गिनती', 'वाढती मोजणी', 'ஏறுமுக எண்ணிக்கை'],
    ['Next tasks', 'अगले काम', 'पुढील कामे', 'அடுத்த பணிகள்'],
    ['Open the issue', 'समस्या खोलें', 'समस्या उघडा', 'சிக்கலைத் திறக்கவும்'],
    ['Open the task', 'काम खोलें', 'काम उघडा', 'பணியைத் திறக்கவும்'],
    ['Every week', 'हर हफ़्ते', 'दर आठवड्याला', 'ஒவ்வொரு வாரமும்'],
    ['OFF', 'बंद', 'बंद', 'ஆஃப்'], ['ON', 'चालू', 'चालू', 'ஆன்'],
    ['Diagnosing', 'जाँच चल रही है', 'तपासणी सुरू आहे', 'கண்டறிதல் நடக்கிறது'],
    ['Caution', 'सावधानी', 'सावधान', 'எச்சரிக்கை'], ['Minor', 'मामूली', 'किरकोळ', 'சிறியது'], ['Major', 'गंभीर', 'गंभीर', 'பெரியது'], ['Emergency', 'आपातकाल', 'आणीबाणी', 'அவசரநிலை'],
    ['Critical', 'अति महत्वपूर्ण', 'अत्यंत महत्त्वाचे', 'மிக முக்கியம்'], ['Essential', 'आवश्यक', 'आवश्यक', 'அவசியம்'], ['Standard', 'सामान्य', 'सामान्य', 'சாதாரணம்'],
    ['Yes', 'हाँ', 'होय', 'ஆம்'], ['No', 'नहीं', 'नाही', 'இல்லை'], ['Above', 'ऊपर', 'वर', 'மேலே'], ['Below', 'नीचे', 'खाली', 'கீழே'],
  ];
  /* names: readings, equipment, equipment types and tasks of the sample plant the story is told on */
  const NAMES = [
    ['Level', 'स्तर', 'पातळी', 'மட்டம்'], ['Dissolved oxygen', 'घुलित ऑक्सीजन', 'विरघळलेला ऑक्सिजन', 'கரைந்த ஆக்ஸிஜன்'], ['Temperature', 'तापमान', 'तापमान', 'வெப்பநிலை'],
    ['Motor current', 'मोटर करंट', 'मोटर करंट', 'மோட்டார் மின்னோட்டம்'], ['Trip contact', 'ट्रिप संपर्क', 'ट्रिप संपर्क', 'ட்ரிப் தொடர்பு'], ['Run hours', 'चालू घंटे', 'चालू तास', 'இயங்கிய மணிநேரம்'],
    ['Sludge blanket', 'स्लज ब्लैंकेट', 'स्लज ब्लँकेट', 'சேறு படலம்'], ['Sump flood switch', 'सम्प बाढ़ स्विच', 'सम्प पूर स्विच', 'சம்ப் வெள்ள சுவிட்ச்'], ['Chemical tank level', 'रसायन टैंक स्तर', 'रसायन टाकी पातळी', 'இரசாயனத் தொட்டி மட்டம்'],
    ['Bar Screen', 'बार स्क्रीन', 'बार स्क्रीन', 'பார் ஸ்கிரீன்'], ['Equalization Tank', 'इक्वलाइज़ेशन टैंक', 'इक्वलायझेशन टाकी', 'சமன்படுத்தும் தொட்டி'],
    ['Aeration Tank 1', 'एरेशन टैंक 1', 'एरेशन टाकी 1', 'காற்றூட்டத் தொட்டி 1'], ['Aeration Tank 2', 'एरेशन टैंक 2', 'एरेशन टाकी 2', 'காற்றூட்டத் தொட்டி 2'],
    ['Air Blower 1', 'एयर ब्लोअर 1', 'एअर ब्लोअर 1', 'காற்று ஊதி 1'], ['Air Blower 2', 'एयर ब्लोअर 2', 'एअर ब्लोअर 2', 'காற்று ஊதி 2'],
    ['Secondary Clarifier 1', 'सेकेंडरी क्लैरिफायर 1', 'सेकंडरी क्लॅरिफायर 1', 'இரண்டாம் நிலை தெளிப்பான் 1'], ['MBR Skid 1', 'MBR स्किड 1', 'MBR स्किड 1', 'MBR ஸ்கிட் 1'],
    ['Multigrade Filter 1', 'मल्टीग्रेड फ़िल्टर 1', 'मल्टीग्रेड फिल्टर 1', 'மல்டிகிரேட் வடிகட்டி 1'], ['UF Skid 1', 'UF स्किड 1', 'UF स्किड 1', 'UF ஸ்கிட் 1'],
    ['Chlorine Dosing Unit', 'क्लोरीन डोज़िंग यूनिट', 'क्लोरीन डोसिंग युनिट', 'குளோரின் செலுத்தும் அலகு'], ['Sludge Pump 1', 'स्लज पंप 1', 'स्लज पंप 1', 'சேறு பம்ப் 1'],
    ['Blower', 'ब्लोअर', 'ब्लोअर', 'ஊதி'], ['Pump', 'पंप', 'पंप', 'பம்ப்'], ['Diffuser Tank', 'डिफ्यूज़र टैंक', 'डिफ्यूझर टाकी', 'டிஃப்யூசர் தொட்டி'], ['Mechanical Screen', 'मैकेनिकल स्क्रीन', 'मेकॅनिकल स्क्रीन', 'இயந்திர ஸ்கிரீன்'],
    ['Open Skeleton Tank', 'ओपन टैंक', 'ओपन टाकी', 'திறந்த தொட்டி'], ['Clarifier Tank', 'क्लैरिफायर टैंक', 'क्लॅरिफायर टाकी', 'தெளிப்பான் தொட்டி'], ['Dosing Pump', 'डोज़िंग पंप', 'डोसिंग पंप', 'செலுத்தும் பம்ப்'], ['UF Membrane', 'UF मेम्ब्रेन', 'UF मेम्ब्रेन', 'UF சவ்வு'],
    ['DO probe calibration', 'DO प्रोब कैलिब्रेशन', 'DO प्रोब कॅलिब्रेशन', 'DO ஆய்வுக்கருவி அளவுத்திருத்தம்'], ['Bearing service', 'बेयरिंग सर्विस', 'बेअरिंग सर्व्हिस', 'பேரிங் பராமரிப்பு'], ['Quarterly CIP', 'तिमाही CIP', 'तिमाही CIP', 'காலாண்டு CIP'],
    ['Weekly backwash', 'साप्ताहिक बैकवॉश', 'साप्ताहिक बॅकवॉश', 'வாராந்திர பேக்வாஷ்'], ['Chemical refill', 'रसायन भरना', 'रसायन भरणे', 'இரசாயனம் நிரப்புதல்'], ['Sludge wasting', 'स्लज निकासी', 'स्लज निकासी', 'சேறு வெளியேற்றம்'],
    ['DO low — AT-2', 'DO कम — AT-2', 'DO कमी — AT-2', 'DO குறைவு — AT-2'],
  ];
  /* the steps of six flows, by flow */
  const FLOWS = {
    f_lowdo: [
      ['Is the blower running?', 'क्या ब्लोअर चल रहा है?', 'ब्लोअर चालू आहे का?', 'ஊதி இயங்குகிறதா?'],
      ['Does the gauge on the blower discharge read above 0.45 bar?', 'क्या ब्लोअर डिस्चार्ज का गेज 0.45 बार से ऊपर दिखा रहा है?', 'ब्लोअर डिस्चार्जवरील गेज 0.45 बारपेक्षा जास्त दाखवतो का?', 'ஊதி வெளியேற்ற அளவி 0.45 பாருக்கு மேல் காட்டுகிறதா?'],
      ['Is bubbling even across the basin?', 'क्या पूरे बेसिन में बुलबुले बराबर उठ रहे हैं?', 'संपूर्ण बेसिनमध्ये बुडबुडे समान येत आहेत का?', 'தொட்டி முழுவதும் குமிழ்கள் சீராக வருகின்றனவா?'],
      ['Is there thick brown foam on the surface?', 'क्या सतह पर गाढ़ा भूरा झाग है?', 'पृष्ठभागावर दाट तपकिरी फेस आहे का?', 'மேற்பரப்பில் அடர்த்தியான பழுப்பு நுரை உள்ளதா?'],
      ['Does the SV30 settle below 400 mL/L?', 'क्या SV30 400 mL/L से नीचे बैठता है?', 'SV30 400 mL/L च्या खाली बसतो का?', 'SV30 400 mL/L-க்குக் கீழே படிகிறதா?'],
      ['Does a handheld DO meter agree with the probe?', 'क्या हैंडहेल्ड DO मीटर की रीडिंग प्रोब से मिलती है?', 'हँडहेल्ड DO मीटरची रीडिंग प्रोबशी जुळते का?', 'கையடக்க DO மீட்டர் அளவீடு ஆய்வுக்கருவியுடன் ஒத்துப்போகிறதா?'],
      ['Read MLSS', 'MLSS पढ़ें', 'MLSS वाचा', 'MLSS-ஐப் படிக்கவும்'],
    ],
    f_blower_pm: [
      ['Isolate at the MCC, lock out, hang the tag', 'MCC पर आइसोलेट करें, लॉक आउट करें, टैग लगाएँ', 'MCC वर आयसोलेट करा, लॉक आउट करा, टॅग लावा', 'MCC-யில் தனிமைப்படுத்தி, லாக் அவுட் செய்து, டேக் தொங்கவிடவும்'],
      ['Grease both bearings: 2 pumps each, wipe the excess', 'दोनों बेयरिंग में ग्रीस लगाएँ: हर एक में 2 पंप, ज़्यादा ग्रीस पोंछ दें', 'दोन्ही बेअरिंगना ग्रीस लावा: प्रत्येकी 2 पंप, जास्तीचे ग्रीस पुसा', 'இரண்டு பேரிங்குகளுக்கும் கிரீஸ் இடவும்: ஒவ்வொன்றுக்கும் 2 பம்ப், அதிகப்படியானதைத் துடைக்கவும்'],
      ['Check belt tension and alignment; replace a cracked or glazed belt', 'बेल्ट का तनाव और अलाइनमेंट जाँचें; फटी या चिकनी बेल्ट बदलें', 'बेल्टचा ताण आणि अलाइनमेंट तपासा; तडकलेला किंवा गुळगुळीत बेल्ट बदला', 'பெல்ட் இறுக்கம் மற்றும் சீரமைப்பைச் சரிபார்க்கவும்; விரிசல் அல்லது வழுவழுப்பான பெல்ட்டை மாற்றவும்'],
      ['Check the coupling and the anti-vibration mounts', 'कपलिंग और एंटी-वाइब्रेशन माउंट जाँचें', 'कपलिंग आणि अँटी-व्हायब्रेशन माउंट तपासा', 'கப்ளிங் மற்றும் அதிர்வு தடுப்பு மவுண்ட்களைச் சரிபார்க்கவும்'],
      ['Clean the intake filter and the silencer', 'इनटेक फ़िल्टर और साइलेंसर साफ़ करें', 'इनटेक फिल्टर आणि सायलेन्सर स्वच्छ करा', 'உள்ளிழுப்பு வடிகட்டி மற்றும் சைலன்சரைச் சுத்தம் செய்யவும்'],
      ['Restart and record the discharge pressure from the gauge on the blower (bar)', 'दोबारा चालू करें और ब्लोअर के गेज से डिस्चार्ज प्रेशर दर्ज करें (बार)', 'पुन्हा सुरू करा आणि ब्लोअरवरील गेजवरून डिस्चार्ज प्रेशर नोंदवा (बार)', 'மீண்டும் இயக்கி, ஊதியின் அளவியிலிருந்து வெளியேற்ற அழுத்தத்தைப் பதிவு செய்யவும் (பார்)'],
      ['Hand back to service; the Lead signs off', 'सेवा में वापस सौंपें; लीड हस्ताक्षर करेंगे', 'सेवेत परत द्या; लीड सही करतील', 'சேவைக்குத் திரும்ப ஒப்படைக்கவும்; லீட் கையொப்பமிடுவார்'],
    ],
    f_backwash: [
      ['Close the inlet valve', 'इनलेट वाल्व बंद करें', 'इनलेट व्हॉल्व्ह बंद करा', 'உள்ளீட்டு வால்வை மூடவும்'],
      ['Open the backwash valve and start the backwash pump', 'बैकवॉश वाल्व खोलें और बैकवॉश पंप चालू करें', 'बॅकवॉश व्हॉल्व्ह उघडा आणि बॅकवॉश पंप सुरू करा', 'பேக்வாஷ் வால்வைத் திறந்து பேக்வாஷ் பம்பை இயக்கவும்'],
      ['Backwash for 8 minutes', '8 मिनट तक बैकवॉश करें', '8 मिनिटे बॅकवॉश करा', '8 நிமிடங்கள் பேக்வாஷ் செய்யவும்'],
      ['Rinse to drain for 4 minutes', '4 मिनट तक ड्रेन में रिंस करें', '4 मिनिटे ड्रेनमध्ये रिन्स करा', '4 நிமிடங்கள் வடிகாலுக்கு அலசவும்'],
      ['Record the pressure difference across the filter from its gauges after rinse (bar)', 'रिंस के बाद गेज से फ़िल्टर के आर-पार का प्रेशर अंतर दर्ज करें (बार)', 'रिन्सनंतर गेजवरून फिल्टरच्या दोन्ही बाजूंमधील प्रेशर फरक नोंदवा (बार)', 'அலசிய பின் அளவிகளிலிருந்து வடிகட்டியின் அழுத்த வேறுபாட்டைப் பதிவு செய்யவும் (பார்)'],
      ['Return the filter to service', 'फ़िल्टर को सेवा में वापस लाएँ', 'फिल्टर पुन्हा सेवेत आणा', 'வடிகட்டியை மீண்டும் சேவைக்குக் கொண்டுவரவும்'],
    ],
    f_sludge: [
      ['Check the sludge holding tank has room', 'जाँचें कि स्लज होल्डिंग टैंक में जगह है', 'स्लज होल्डिंग टाकीत जागा आहे का ते तपासा', 'சேறு சேமிப்புத் தொட்டியில் இடம் உள்ளதா எனச் சரிபார்க்கவும்'],
      ['Open the WAS valve and start the pump', 'WAS वाल्व खोलें और पंप चालू करें', 'WAS व्हॉल्व्ह उघडा आणि पंप सुरू करा', 'WAS வால்வைத் திறந்து பம்பை இயக்கவும்'],
      ['Run for 20 minutes', '20 मिनट तक चलाएँ', '20 मिनिटे चालवा', '20 நிமிடங்கள் இயக்கவும்'],
      ['Record the pump run hours', 'पंप के चालू घंटे दर्ज करें', 'पंपचे चालू तास नोंदवा', 'பம்ப் இயங்கிய மணிநேரத்தைப் பதிவு செய்யவும்'],
      ['Close the valve and log the volume wasted', 'वाल्व बंद करें और निकाली गई मात्रा दर्ज करें', 'व्हॉल्व्ह बंद करा आणि काढलेले प्रमाण नोंदवा', 'வால்வை மூடி, வெளியேற்றிய அளவைப் பதிவு செய்யவும்'],
    ],
    f_sample: [
      ['Rinse the sample bottle three times with the outlet water', 'नमूना बोतल को आउटलेट के पानी से तीन बार धोएँ', 'नमुना बाटली आउटलेटच्या पाण्याने तीन वेळा धुवा', 'மாதிரி பாட்டிலை வெளியேறும் நீரால் மூன்று முறை அலசவும்'],
      ['Fill, cap and photograph the bottle against the label with the time', 'बोतल भरें, ढक्कन लगाएँ और लेबल के साथ समय दिखाते हुए फ़ोटो लें', 'बाटली भरा, झाकण लावा आणि लेबलसह वेळ दिसेल असा फोटो घ्या', 'பாட்டிலை நிரப்பி, மூடி, லேபிளுடன் நேரம் தெரியும்படி புகைப்படம் எடுக்கவும்'],
      ['Store in the cool box and hand to the courier before noon', 'कूल बॉक्स में रखें और दोपहर से पहले कूरियर को दें', 'कूल बॉक्समध्ये ठेवा आणि दुपारपूर्वी कुरिअरला द्या', 'குளிர் பெட்டியில் வைத்து, நண்பகலுக்கு முன் கூரியரிடம் ஒப்படைக்கவும்'],
      ['Log the sample id; the Lead signs off', 'नमूना आईडी दर्ज करें; लीड हस्ताक्षर करेंगे', 'नमुना आयडी नोंदवा; लीड सही करतील', 'மாதிரி அடையாள எண்ணைப் பதிவு செய்யவும்; லீட் கையொப்பமிடுவார்'],
    ],
    f_blanket: [
      ['Is the scraper turning?', 'क्या स्क्रेपर घूम रहा है?', 'स्क्रेपर फिरत आहे का?', 'ஸ்கிரேப்பர் சுழல்கிறதா?'],
      ['Is the RAS pump running at its normal rate?', 'क्या RAS पंप अपनी सामान्य दर पर चल रहा है?', 'RAS पंप नेहमीच्या दराने चालू आहे का?', 'RAS பம்ப் வழக்கமான வீதத்தில் இயங்குகிறதா?'],
      ['Are floating clumps with gas bubbles on the surface?', 'क्या सतह पर गैस के बुलबुलों वाले तैरते गुच्छे हैं?', 'पृष्ठभागावर वायूच्या बुडबुड्यांसह तरंगणारे गोळे आहेत का?', 'மேற்பரப்பில் வாயுக் குமிழ்களுடன் மிதக்கும் கட்டிகள் உள்ளனவா?'],
      ['Does the SV30 settle above 400 mL/L?', 'क्या SV30 400 mL/L से ऊपर बैठता है?', 'SV30 400 mL/L च्या वर बसतो का?', 'SV30 400 mL/L-க்கு மேலே படிகிறதா?'],
    ],
  };
  const PATTERNS = {   /* a little grammar: "In Major", "Due: Weekly backwash" */
    hi: { in: (x) => `${x} सीमा में`, due: (x) => `बाकी: ${x}`, opened: (x) => `${x} को खुला` }, mr: { in: (x) => `${x} पातळीत`, due: (x) => `बाकी: ${x}`, opened: (x) => `${x} ला उघडले` }, ta: { in: (x) => `${x} நிலையில்`, due: (x) => `நிலுவை: ${x}`, opened: (x) => `${x} அன்று திறக்கப்பட்டது` },
  };
  const DICT = { hi: new Map(), mr: new Map(), ta: new Map() };
  const put = (row) => Object.keys(IX).forEach((l) => { if (row[IX[l]]) DICT[l].set(row[0], row[IX[l]]); });
  WORDS.forEach(put); NAMES.forEach(put); Object.keys(FLOWS).forEach((f) => FLOWS[f].forEach(put));

  function readStore() { try { const o = JSON.parse(W.localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function writeStore(o) { try { W.localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* the choice lasts for this page only */ } }
  let ST = readStore(); if (!ST.reviewed) ST.reviewed = {};
  const cur = () => (IX[ST.cur] ? ST.cur : 'en');
  const langOf = (id) => LANGS.find((l) => l.id === id) || LANGS[0];
  function set(id) { ST.cur = IX[id] ? id : 'en'; writeStore(ST); }
  function one(text, l) {
    const d = DICT[l]; if (!d) return null; if (d.has(text)) return d.get(text);
    let m = /^In (Caution|Minor|Major|Emergency)$/.exec(text); if (m && d.has(m[1])) return PATTERNS[l].in(d.get(m[1]));
    m = /^Due: (.+)$/.exec(text); if (m && d.has(m[1])) return PATTERNS[l].due(d.get(m[1]));
    m = /^Opened (.+)$/.exec(text); if (m) return PATTERNS[l].opened(m[1]);
    return null;
  }
  /* "Blower · Critical" is two things said together: each part is looked up on its own */
  function t(text, lang) {
    const l = lang || cur(); if (l === 'en') return null; const s = String(text == null ? '' : text).replace(/\s+/g, ' ').trim(); if (!s) return null;
    const whole = one(s, l); if (whole != null) return whole;
    if (s.indexOf(' · ') < 0) return null;
    const parts = s.split(' · '); let hit = 0; const out = parts.map((p) => { const x = one(p, l); if (x != null) { hit++; return x; } return p; });
    return hit ? out.join(' · ') : null;
  }
  const flowState = (flowId, lang) => (!IX[lang] ? 'none' : !FLOWS[flowId] ? 'none' : ST.reviewed[`${lang}|${flowId}`] ? 'reviewed' : 'draft');
  function review(flowId, lang, on) { if (!FLOWS[flowId] || !IX[lang]) return false; if (on === false) delete ST.reviewed[`${lang}|${flowId}`]; else ST.reviewed[`${lang}|${flowId}`] = true; writeStore(ST); return true; }
  function allFlows() { return (W.CTL && W.CTL.S && W.CTL.S.lib ? W.CTL.S.lib.flows : (W.SEED || {}).flows) || []; }
  function coverage(lang) {
    const all = allFlows(); const ids = Object.keys(FLOWS).filter((id) => all.some((f) => f.id === id));
    return { flows: ids.length, flowsAll: all.length, reviewed: ids.filter((id) => flowState(id, lang) === 'reviewed').length, words: WORDS.length, names: NAMES.length, ids };
  }
  function pickerHtml() {
    const c = cur();
    return `<span class="tb-lang" title="The language of what an operator reads: the phone card, a task's steps, a diagnostic's questions. The configuration screens stay in English."><span>Operator text</span><select id="tbLang" data-act="lang:set" aria-label="Language of the operator's text">${LANGS.map((l) => `<option value="${l.id}"${l.id === c ? ' selected' : ''}>${l.own}${l.id === 'en' ? '' : ` · ${l.name}`}</option>`).join('')}</select></span>`;
  }
  W.V7LANG = { LANGS, cur, set, t, flowState, review, coverage, pickerHtml, langOf };

  /* ── on the screens ───────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.afterRender || typeof document === 'undefined' || !document.createTreeWalker) return;
  const esc = U.esc;
  /* where an operator's own text is drawn; and, inside those, the lines that are a flow's steps (marked when not translated) */
  const ROOTS = '.phone-scr, .fl-qs, .fl-steps, .fl-try, .wk-check, .wk-flow';
  const STEPS = '.fl-q-t, .fl-s > div > div:first-child, .wk-tx, .wk-q';
  function pass(main) {
    const l = cur(); if (document.body) document.body.setAttribute('data-lang', l);
    const sel = document.getElementById('tbLang'); if (sel && sel.value !== l) sel.value = l;
    if (l === 'en' || !main || !main.querySelectorAll) return;
    const L = langOf(l);
    main.querySelectorAll(ROOTS).forEach((root) => {
      root.setAttribute('lang', l);
      const w = document.createTreeWalker(root, 4, null); const nodes = []; let n = w.nextNode(); while (n) { nodes.push(n); n = w.nextNode(); }
      nodes.forEach((x) => { const raw = x.nodeValue; const s = raw.replace(/\s+/g, ' ').trim(); if (!s) return; const out = t(s, l); if (out != null && out !== s) x.nodeValue = raw.replace(raw.trim(), out); });
      root.querySelectorAll(STEPS).forEach((el) => {
        if (el.getAttribute('data-lg')) return; const own = Array.prototype.filter.call(el.childNodes, (c) => c.nodeType === 3).map((c) => c.nodeValue).join(' ').replace(/\s+/g, ' ').trim();
        const done = own && Array.from(DICT[l].values()).indexOf(own) >= 0;
        el.setAttribute('data-lg', done ? 'ok' : 'miss'); if (!done) el.setAttribute('title', `Not in ${L.name} yet: the operator sees it in English`);
      });
    });
  }
  function flowNote(main, path) {
    const l = cur(); const m = /^flows\/([^/?]+)/.exec(String(path || '').replace(/^#?\/?/, '')); if (!m || l === 'en' || !main) return;
    const id = decodeURIComponent(m[1]); const st = flowState(id, l); const L = langOf(l); const host = main.querySelector('.pg-main'); if (!host || host.querySelector('.lg-note')) return;
    const div = document.createElement('div'); div.className = 'lg-note note note-' + (st === 'none' ? 'warn' : 'quiet');
    div.innerHTML = st === 'none' ? `<b>Not in ${esc(L.name)} yet.</b> An operator who reads ${esc(L.name)} sees this flow in English. <a href="#/languages">What is translated</a>`
      : st === 'draft' ? `<b>${esc(L.name)}: a draft, not reviewed.</b> Read it as the operator will, then mark it reviewed. ${U.btn('Mark reviewed', { act: 'lang:review', data: { flow: id, on: '1' }, small: true })}`
        : `<b>${esc(L.name)}: reviewed.</b> ${U.btn('Back to draft', { act: 'lang:review', data: { flow: id, on: '0' }, small: true, kind: 'ghost' })}`;
    host.insertBefore(div, host.firstChild);
  }
  U.afterRender((main, path) => { try { flowNote(main, path); pass(main); } catch (e) { /* the page still shows in English */ } });
  U.on('lang:set', (el) => { set(el.value); U.render(); if (cur() !== 'en') U.toast(`Operator text is shown in ${langOf(cur()).name} where it is translated. The rest stays in English, marked.`); });
  U.on('lang:review', (el) => { review(el.getAttribute('data-flow'), cur(), el.getAttribute('data-on') !== '0'); U.render(); return undefined; });

  function page() {
    const c = cur(); const all = allFlows();
    const rows = LANGS.filter((l) => l.id !== 'en').map((l) => { const cv = coverage(l.id); return { lang: `<b>${esc(l.name)}</b> <span class="muted" lang="${l.id}">${esc(l.own)}</span>`, card: `${cv.words} of ${cv.words}`, names: `${cv.names} names`, flows: `<b>${cv.flows}</b> of ${cv.flowsAll}`, rev: cv.flows ? `${cv.reviewed} of ${cv.flows}` : '0', act: l.id === c ? U.chip('Showing now', { tone: 'info' }) : U.btn(`Show ${l.name}`, { act: 'lang:show', data: { lang: l.id }, small: true }) }; });
    const cv = coverage(c === 'en' ? 'hi' : c); const show = c === 'en' ? 'hi' : c; const L = langOf(show);
    const frows = cv.ids.map((id) => { const f = all.find((x) => x.id === id); const st = flowState(id, show); return { name: `<a href="#/flows/${esc(encodeURIComponent(id))}">${esc(f ? f.name : id)}</a>`, kind: f && f.kind === 'diagnostic' ? 'Diagnostic' : 'Task', steps: String(FLOWS[id].length), state: st === 'reviewed' ? U.chip('Reviewed', { tone: 'muted' }) : U.chip('Draft, not reviewed', { tone: 'warn' }), act: c === 'en' ? '' : U.btn(st === 'reviewed' ? 'Back to draft' : 'Mark reviewed', { act: 'lang:review', data: { flow: id, on: st === 'reviewed' ? '0' : '1' }, small: true, kind: st === 'reviewed' ? 'ghost' : 'secondary' }) }; });
    const body = U.card({ title: 'What is translated', sub: 'Counted from what the library holds today.', body: U.table({ cols: [{ label: 'Language', key: 'lang' }, { label: 'Words on the card', key: 'card' }, { label: 'Equipment, readings and task names', key: 'names' }, { label: 'Flows', key: 'flows' }, { label: 'Flows reviewed', key: 'rev' }, { label: '', key: 'act' }], rows }) })
      + U.card({ title: `Flows in ${L.name}`, sub: `Open one to read it as the operator will. The other ${cv.flowsAll - cv.flows} flows are shown in English, marked, until their text is loaded.`, body: U.table({ cols: [{ label: 'Flow', key: 'name' }, { label: 'Kind', key: 'kind' }, { label: 'Steps', key: 'steps' }, { label: L.name, key: 'state' }, { label: '', key: 'act' }], rows: frows }) })
      + U.card({ title: 'Where to look', body: `<ul class="lg-ul"><li><a href="#/p/manesar/eq/bl1/phone">The phone card of BL-1</a>: names, readings and the words of the card.</li><li><a href="#/p/manesar/eq/at2/phone">The phone card of AT-2</a>, with an open issue.</li><li><a href="#/flows/f_lowdo">Low DO diagnostic</a>: its questions and answers.</li><li><a href="#/flows/f_blower_pm">Blower bearing and belt service</a>: its steps.</li></ul>`, tone: 'quiet' })
      + U.note('Every translation in this prototype is a first draft that no native speaker has read. Names and step text for the other plants and flows are not translated here. Spoken steps are not covered.', 'quiet');
    return U.page({ title: 'Operator text in other languages', sub: 'What an operator reads is kept once per language. Choose a language in the top bar to read the phone card, task steps and diagnostic questions as the operator will. The configuration screens stay in English.', body });
  }
  U.on('lang:show', (el) => { set(el.getAttribute('data-lang')); U.render(); return undefined; });
  U.route('languages', page);
})();
