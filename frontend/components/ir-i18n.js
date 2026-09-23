/**
 * frontend/components/ir-i18n.js
 * ─────────────────────────────────────────────────────────────────────────────
 * RAKSHA PATH — UNIVERSAL MULTI-LANGUAGE TRANSLATION ENGINE & DOM LOCALIZATION
 * 
 * Supported Indian Railways Operational Languages:
 *   - EN: English (Official Standard)
 *   - HI: हिन्दी (Hindi / राजभाषा)
 *   - BN: বাংলা (Bengali)
 *   - MR: मराठी (Marathi)
 *   - TA: தமிழ் (Tamil)
 *   - TE: తెలుగు (Telugu)
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'ir_selected_language';

  // Comprehensive Railway & Operations Dictionary
  const DICTIONARY = {
    // ── Navigation & System Headers ──
    'Executive Admin': {
      HI: 'कार्यकारी प्रशासन',
      BN: 'নির্বাহী প্রশাসন',
      MR: 'कार्यकारी प्रशासन',
      TA: 'நிர்வாக அட்மின்',
      TE: 'ఎగ్జిక్యూటివ్ అడ్మిన్'
    },
    'Getting Started': {
      HI: 'शुरुआत करें',
      BN: 'শুরু করুন',
      MR: 'सुरुवात करा',
      TA: 'தொடங்குதல்',
      TE: 'ప్రారంభించండి'
    },
    'Calendar': {
      HI: 'कैलेंडर एवं शेड्यूल',
      BN: 'ক্যালেন্ডার ও সময়সূচী',
      MR: 'कॅलेंडर आणि वेळापत्रक',
      TA: 'நாட்காட்டி & அட்டவணை',
      TE: 'క్యాలెండర్ & షెడ్యూల్'
    },
    'Maintenance': {
      HI: 'अनुरक्षण एवं रखरखाव',
      BN: 'রক্ষণাবেক্ষণ',
      MR: 'देखभाल आणि दुरुस्ती',
      TA: 'பராமரிப்பு பணி',
      TE: 'నిర్వహణ మరియు మరమ్మత్తు'
    },
    'Control Office': {
      HI: 'खंड नियंत्रण कार्यालय',
      BN: 'বিভাগীয় নিয়ন্ত্রণ কার্যালয়',
      MR: 'विभाग नियंत्रण कार्यालय',
      TA: 'பிரிவு கட்டுப்பாட்டு அலுவலகம்',
      TE: 'విభాగ నియంత్రణ కార్యాలయం'
    },
    'Surveillance': {
      HI: 'संरक्षा एवं निगरानी',
      BN: 'সুরক্ষা ও নজরদারি',
      MR: 'सुरक्षा आणि पाळत',
      TA: 'பாதுகாப்பு & கண்காணிப்பு',
      TE: 'భద్రత మరియు నిఘా'
    },
    'AI MLOps': {
      HI: 'एआई एमएलऑप्स',
      BN: 'এআই এমএলঅপ্স',
      MR: 'एआय एमएलऑप्स',
      TA: 'ஏஐ எம்எல்ஆப்ஸ்',
      TE: 'ఏఐ ఎంఎల్ఆప్స్'
    },
    'Work Orders': {
      HI: 'कार्य आदेश (वर्क ऑर्डर)',
      BN: 'কাজের আদেশ',
      MR: 'काम आदेश',
      TA: 'பணி ஆணைகள்',
      TE: 'పని ఆర్డర్లు'
    },
    'Request Maintenance': {
      HI: 'अनुरक्षण अनुरोध',
      BN: 'রক্ষণাবেক্ষণ অনুরোধ',
      MR: 'देखभाल विनंती',
      TA: 'பராமரிப்பு கோரிக்கை',
      TE: 'నిర్వహణ అభ్యర్థన'
    },
    'PM Schedules': {
      HI: 'आवधिक अनुरक्षण कार्यक्रम',
      BN: 'পর্যায়ক্রমিক রক্ষণাবেক্ষণ সময়সূচী',
      MR: 'नियतकालिक देखभाल वेळापत्रक',
      TA: 'காலமுறை பராமரிப்பு அட்டவணை',
      TE: 'ఆవర్తన నిర్వహణ షెడ్యూల్'
    },
    'Labor': {
      HI: 'श्रम एवं कार्यबल',
      BN: 'শ্রমিক ও কর্মীদল',
      MR: 'श्रम आणि कार्यबल',
      TA: 'பணியாளர்கள் & தொழிலாளர்கள்',
      TE: 'కార్మికులు & సిబ్బంది'
    },
    'Operational Reports': {
      HI: 'परिचालन रिपोर्ट व ऑडिट',
      BN: 'অপারেশনাল রিপোর্ট ও অডিট',
      MR: 'ऑपरेशनल अहवाल आणि ऑडिट',
      TA: 'செயல்பாட்டு அறிக்கைகள் & தணிக்கை',
      TE: 'కార్యాచరణ నివేదికలు & ఆడిట్'
    },
    'Personnel Credentials & RBAC Console': {
      HI: 'कार्मिक क्रेडेंशियल एवं आरबीएसी कंसोल',
      BN: 'কর্মী প্রমাণপত্র ও আরবিএসি কনসোল',
      MR: 'कर्मचारी क्रेडेन्शियल आणि आरबीएसी कन्सोल',
      TA: 'பணியாளர் நற்சான்றிதழ்கள் & ஆர்பிஏசி கன்சோல்',
      TE: 'సిబ్బంది ఆధారాలు & ఆర్‌బిఎసి కన్సోల్'
    },
    'Logout': {
      HI: 'लॉग आउट',
      BN: 'লগ আউট',
      MR: 'लॉग आउट',
      TA: 'வெளியேறு',
      TE: 'లాగ్ అవుట్'
    },
    'System Live': {
      HI: 'सिस्टम लाइव',
      BN: 'সিস্টেম লাইভ',
      MR: 'सिस्टम लाइव्ह',
      TA: 'அமைப்பு நேரலையில்',
      TE: 'సిస్టమ్ లైవ్'
    },

    // ── Surveillance & Inspection Dashboard ──
    'Surveillance & Track Inspection Center': {
      HI: 'संरक्षा, ट्रैक निरीक्षण एवं निगरानी केंद्र',
      BN: 'ট্র্যাক পরিদর্শন ও নজরদারি কেন্দ্র',
      MR: 'ट्रॅक तपासणी आणि पाळत केंद्र',
      TA: 'பாதை ஆய்வு மற்றும் கண்காணிப்பு மையம்',
      TE: 'ట్రాక్ తనిఖీ మరియు నిఘా కేంద్రం'
    },
    'Automated defect telemetry, statutory inspection reports, incident logging & drone feeds': {
      HI: 'स्वचालित दोष टेलीमेट्री, वैधानिक निरीक्षण रिपोर्ट, घटना लॉगिंग एवं ड्रोन फीड',
      BN: 'স্বয়ংক্রিয় ত্রুটি টেলিমেট্রি, সংবিধিবদ্ধ পরিদর্শন রিপোর্ট, ঘটনা লগিং ও ড্রোন ফিড',
      MR: 'स्वयंचलित त्रुटी टेलिमेट्री, वैधानिक तपासणी अहवाल, घटना नोंद आणि ड्रोन फीड',
      TA: 'தானியங்கி குறைபாடு டெலிமெட்ரி, சட்டரீதியான ஆய்வு அறிக்கைகள், சம்பவ பதிவு & ட்ரோன் ஊட்டங்கள்',
      TE: 'స్వయంచాలక లోపం టెలిమెట్రీ, చట్టబద్ధమైన తనిఖీ నివేదికలు, సంఘటన లాగింగ్ & డ్రోన్ ఫీడ్‌లు'
    },
    'Live Telemetry & GIS Feeds': {
      HI: 'लाइव टेलीमेट्री एवं जीआईएस फीड्स',
      BN: 'লাইভ টেলিমেট্রি এবং জিআইএস ফিড',
      MR: 'थेट टेलिमेट्री आणि जीआयएस फीड',
      TA: 'நேரடி டெலிமெட்ரி & ஜிஐஎஸ் ஊட்டங்கள்',
      TE: 'లైవ్ టెలిమెట్రీ & జిఐఎస్ ఫీడ్‌లు'
    },
    'Inspection Reports': {
      HI: 'निरीक्षण रिपोर्ट हब',
      BN: 'পরিদর্শন রিপোর্ট হাব',
      MR: 'तपासणी अहवाल केंद्र',
      TA: 'ஆய்வு அறிக்கைகள் மையம்',
      TE: 'తనిఖీ నివేదికల హబ్'
    },
    'Incident Reports': {
      HI: 'संरक्षा घटना रिपोर्ट',
      BN: 'সুরক্ষা ঘটনা রিপোর্ট',
      MR: 'सुरक्षा घटना अहवाल',
      TA: 'பாதுகாப்பு சம்பவ அறிக்கைகள்',
      TE: 'భద్రతా సంఘటన నివేదికలు'
    },
    'High-Priority Inspection Anomalies (AI-Scored Criticality)': {
      HI: 'उच्च-प्राथमिकता निरीक्षण विसंगतियां (एआई-स्कोर गंभीरता)',
      BN: 'উচ্চ-অগ্রাধিকার পরিদর্শন অসঙ্গতি (এআই-স্কোর সংবেদনশীলতা)',
      MR: 'उच्च-प्राधान्य तपासणी विसंगती (एआय-स्कोअर तीव्रता)',
      TA: 'உயர் முன்னுரிமை ஆய்வு முரண்பாடுகள் (ஏஐ-மதிப்பீடு)',
      TE: 'అధిక ప్రాధాన్యత తనిఖీ వ్యత్యాసాలు (ఏఐ-స్కోర్ తీవ్రత)'
    },
    'Filtered by: Urgent P1 & P2 Risks': {
      HI: 'फ़िल्टर: अति-आवश्यक P1 एवं P2 जोखिम',
      BN: 'ফিল্টার: জরুরি P1 এবং P2 ঝুঁকি',
      MR: 'फिल्टर: तातडीचे P1 आणि P2 धोके',
      TA: 'வடிகட்டியது: அவசர P1 & P2 அபாயங்கள்',
      TE: 'ఫిల్టర్ చేయబడింది: అత్యవసర P1 & P2 ప్రమాదాలు'
    },
    'Manual Override': {
      HI: 'मैनुअल ओवरराइड',
      BN: 'ম্যানুয়াল ওভাররাইড',
      MR: 'मॅन्युअल ओव्हरराइड',
      TA: 'மேனுவல் ஓவர்ரைடு',
      TE: 'మాన్యువల్ ఓవర్‌రైడ్'
    },
    'AI RATIONALE:': {
      HI: 'एआई विश्लेषणात्मक तर्क:',
      BN: 'এআই যুক্তি:',
      MR: 'एआय तर्क:',
      TA: 'ஏஐ விளக்கம்:',
      TE: 'ఏఐ సమర్థన:'
    },
    'View Dossier': {
      HI: 'डोज़ियर देखें',
      BN: 'ডজিয়ার দেখুন',
      MR: 'डोसियर पहा',
      TA: 'கோப்பைப் பார்',
      TE: 'డాసియర్ చూడండి'
    },
    'Audit / Sign-Off': {
      HI: 'ऑडिट / अनुमोदन करें',
      BN: 'অডিট / সাইন-অফ',
      MR: 'ऑडिट / स्वाक्षरी करा',
      TA: 'தணிக்கை / ஒப்புதல்',
      TE: 'ఆడిట్ / ఆమోదించండి'
    },
    'Inspect / QA Audit': {
      HI: 'गुणवत्ता ऑडिट एवं निरीक्षण',
      BN: 'গুণমান অডিট ও পরিদর্শন',
      MR: 'गुणवत्ता ऑडिट आणि तपासणी',
      TA: 'தர தணிக்கை & ஆய்வு',
      TE: 'నాణ్యత ఆడిట్ & తనిఖీ'
    },

    // ── Control Office & Emergency Incidents ──
    'Incoming Safety Incidents & Priority Line Block Requests': {
      HI: 'आगामी संरक्षा घटनाएं एवं प्राथमिकता लाइन ब्लॉक अनुरोध',
      BN: 'আসন্ন সুরক্ষা ঘটনা এবং অগ্রাধিকার লাইন ব্লক অনুরোধ',
      MR: 'आगामी सुरक्षा घटना आणि प्राधान्य लाइन ब्लॉक विनंत्या',
      TA: 'உள்வரும் பாதுகாப்பு சம்பவங்கள் & முன்னுரிமை லைன் பிளாக் கோரிக்கைகள்',
      TE: 'ఇన్‌కమింగ్ భద్రతా సంఘటనలు & ప్రాధాన్యత లైన్ బ్లాక్ అభ్యర్థనలు'
    },
    'Live Surveillance Stream': {
      HI: 'लाइव निगरानी स्ट्रीम',
      BN: 'লাইভ নজরদারি স্ট্রিম',
      MR: 'थेट पाळत प्रवाह',
      TA: 'நேரடி கண்காணிப்பு ஸ்ட்ரீம்',
      TE: 'లైవ్ నిఘా స్ట్రీమ్'
    },
    'Refresh': {
      HI: 'ताज़ा करें',
      BN: 'রিফ্রেশ',
      MR: 'रिफ्रेश करा',
      TA: 'புதுப்பி',
      TE: 'రిఫ్రెష్'
    },
    'Sanction Possession': {
      HI: 'ब्लॉक स्वीकृत करें',
      BN: 'ব্লক অনুমোদন করুন',
      MR: 'ब्लॉक मंजूर करा',
      TA: 'பிளாக் அனுமதி வழங்கவும்',
      TE: 'బ్లాక్ మంజూరు చేయండి'
    },
    'Sanctioned': {
      HI: 'स्वीकृत (कंट्रोल)',
      BN: 'অনুমোদিত',
      MR: 'मंजूर केले',
      TA: 'அனுமதிக்கப்பட்டது',
      TE: 'మంజూరు చేయబడింది'
    },
    'Pending Sanction': {
      HI: 'स्वीकृति लंबित',
      BN: 'অনুমোদন মুলতুবি',
      MR: 'मंजुरी प्रलंबित',
      TA: 'அனுமதி நிலுவையில் உள்ளது',
      TE: 'మంజూరు పెండింగ్‌లో ఉంది'
    },

    // ── KPI & Summary Card Labels ──
    'Total Inspections': {
      HI: 'कुल निरीक्षण',
      BN: 'মোট পরিদর্শন',
      MR: 'एकूण तपासण्या',
      TA: 'மொத்த ஆய்வுகள்',
      TE: 'మొత్తం తనిఖీలు'
    },
    'Completed': {
      HI: 'पूर्ण',
      BN: 'সম্পন্ন',
      MR: 'पूर्ण झाले',
      TA: 'முடிந்தது',
      TE: 'పూర్తయింది'
    },
    'Pending': {
      HI: 'लंबित',
      BN: 'মুলতুবি',
      MR: 'प्रलंबित',
      TA: 'நிலுவையில் உள்ளது',
      TE: 'పెండింగ్‌లో ఉంది'
    },
    'Passed': {
      HI: 'उत्तीर्ण / स्वीकृत',
      BN: 'উত্তীর্ণ / অনুমোদিত',
      MR: 'उत्तीर्ण / मंजूर',
      TA: 'தேர்ச்சி பெற்றது',
      TE: 'ఉత్తీర్ణత / ఆమోదించబడింది'
    },
    'Failed': {
      HI: 'विफल / अस्वीकृत',
      BN: 'ব্যর্থ / প্রত্যাখ্যাত',
      MR: 'अयशस्वी / नाकारले',
      TA: 'தோல்வி அடைந்தது',
      TE: 'విఫలమైంది / తిరస్కరించబడింది'
    },
    'Overdue': {
      HI: 'अतिदेय (विलंबित)',
      BN: 'বকেয়া',
      MR: 'थकीत',
      TA: 'தாமதமானது',
      TE: 'గడువు ముగిసింది'
    },
    'Completion Rate': {
      HI: 'पूर्णता दर',
      BN: 'সমাপ্তির হার',
      MR: 'पूर्णता दर',
      TA: 'நிறைவு விகிதம்',
      TE: 'పూర్తి రేటు'
    },
    'Pass Rate': {
      HI: 'उत्तीर्ण दर',
      BN: 'উত্তীর্ণের হার',
      MR: 'उत्तीर्ण दर',
      TA: 'தேர்ச்சி விகிதம்',
      TE: 'ఉత్తీర్ణత రేటు'
    },
    'Average Score': {
      HI: 'औसत गुणवत्ता स्कोर',
      BN: 'গড় স্কোর',
      MR: 'सरासरी स्कोअर',
      TA: 'சராசரி மதிப்பீடு',
      TE: 'సగటు స్కోరు'
    },
    'Total': {
      HI: 'कुल',
      BN: 'মোট',
      MR: 'एकूण',
      TA: 'மொத்தம்',
      TE: 'మొత్తం'
    },
    'This Month': {
      HI: 'इस माह',
      BN: 'চলতি মাসে',
      MR: 'या महिन्यात',
      TA: 'இந்த மாதம்',
      TE: 'ఈ నెల'
    },
    'High/Critical': {
      HI: 'गंभीर / उच्च',
      BN: 'গুরুত্বপূর্ণ / উচ্চ',
      MR: 'गंभीर / उच्च',
      TA: 'முக்கிய / உயர்',
      TE: 'తీవ్రమైన / అధిక'
    },
    'Drafts': {
      HI: 'ड्राफ्ट',
      BN: 'খসড়া',
      MR: 'मसुदा',
      TA: 'வரைவுகள்',
      TE: 'డ్రాఫ్ట్‌లు'
    },

    // ── Table Column Headers & Actions ──
    'Inspection ID': {
      HI: 'निरीक्षण आईडी',
      BN: 'পরিদর্শন আইডি',
      MR: 'तपासणी आयडी',
      TA: 'ஆய்வு ஐடி',
      TE: 'తనిఖీ ఐడి'
    },
    'Asset / Section': {
      HI: 'परिसंपत्ति / खंड',
      BN: 'সম্পদ / বিভাগ',
      MR: 'मालमत्ता / विभाग',
      TA: 'சொத்து / பிரிவு',
      TE: 'ఆస్తి / విభాగం'
    },
    'Department': {
      HI: 'विभाग',
      BN: 'বিভাগ',
      MR: 'विभाग',
      TA: 'துறை',
      TE: 'విభాగం'
    },
    'Technician / Inspector': {
      HI: 'तकनीशियन / निरीक्षक',
      BN: 'প্রকৌশলী / পরিদর্শক',
      MR: 'तंत्रज्ञ / निरीक्षक',
      TA: 'தொழில்நுட்ப வல்லுநர் / ஆய்வாளர்',
      TE: 'సాంకేతిక నిపుణుడు / ఇన్స్పెక్టర్'
    },
    'Date & Time': {
      HI: 'दिनांक एवं समय',
      BN: 'তারিখ ও সময়',
      MR: 'दिनांक आणि वेळ',
      TA: 'தேதி & நேரம்',
      TE: 'తేదీ & సమయం'
    },
    'Score': {
      HI: 'स्कोर',
      BN: 'স্কোর',
      MR: 'गुण / स्कोअर',
      TA: 'மதிப்பீடு',
      TE: 'స్కోరు'
    },
    'Result': {
      HI: 'परिणाम',
      BN: 'ফলাফল',
      MR: 'निकाल',
      TA: 'முடிவு',
      TE: 'ఫలితం'
    },
    'Status': {
      HI: 'स्थिति',
      BN: 'অবস্থা',
      MR: 'स्थिती',
      TA: 'நிலை',
      TE: 'స్థితి'
    },
    'Action': {
      HI: 'कार्रवाई',
      BN: 'পদক্ষেপ',
      MR: 'कृती',
      TA: 'நடவடிக்கை',
      TE: 'చర్య'
    },
    'Incident ID': {
      HI: 'घटना आईडी',
      BN: 'ঘটনা আইডি',
      MR: 'घटना आयडी',
      TA: 'சம்பவ ஐடி',
      TE: 'సంఘటన ఐడి'
    },
    'Incident Type & Summary': {
      HI: 'घटना प्रकार एवं विवरण',
      BN: 'ঘটনার ধরন ও সারসংক্ষেপ',
      MR: 'घटना प्रकार आणि सारांश',
      TA: 'சம்பவ வகை & சுருக்கம்',
      TE: 'సంఘటన రకం & సారాంశం'
    },
    'Associated Asset / Location': {
      HI: 'संबंधित परिसंपत्ति / स्थान',
      BN: 'সম্পর্কিত সম্পদ / অবস্থান',
      MR: 'संबंधित मालमत्ता / स्थान',
      TA: 'தொடர்புடைய சொத்து / இடம்',
      TE: 'సంబంధిత ఆస్తి / స్థానం'
    },
    'Severity': {
      HI: 'गंभीरता',
      BN: 'তীব্রতা',
      MR: 'तीव्रता',
      TA: 'தீவிரம்',
      TE: 'తీవ్రత'
    },
    'Priority': {
      HI: 'प्राथमिकता',
      BN: 'অগ্রাধিকার',
      MR: 'प्राधान्य',
      TA: 'முன்னுரிமை',
      TE: 'ప్రాధాన్యత'
    },
    'Downtime': {
      HI: 'ब्लॉक अवधि',
      BN: 'ডাউনটাইম',
      MR: 'डाउनटाइम',
      TA: 'வேலைநிறுத்த நேரம்',
      TE: 'డౌన్‌టైమ్'
    },
    'Reported At': {
      HI: 'रिपोर्ट समय',
      BN: 'রিপোর্টের সময়',
      MR: 'नोंदणी वेळ',
      TA: 'பதிவு செய்யப்பட்ட நேரம்',
      TE: 'నివేదించబడిన సమయం'
    },

    // ── Common Modal & Button Actions ──
    'Start Inspection': {
      HI: '+ नया निरीक्षण प्रारंभ करें',
      BN: '+ পরিদর্শন শুরু করুন',
      MR: '+ तपासणी सुरू करा',
      TA: '+ ஆய்வு தொடங்கவும்',
      TE: '+ తనిఖీని ప్రారంభించండి'
    },
    'New Inspection': {
      HI: '+ नया निरीक्षण',
      BN: '+ নতুন পরিদর্শন',
      MR: '+ नवीन तपासणी',
      TA: '+ புதிய ஆய்வு',
      TE: '+ కొత్త తనిఖీ'
    },
    'Report Incident': {
      HI: '+ घटना दर्ज करें',
      BN: '+ ঘটনা রিপোর্ট করুন',
      MR: '+ घटना नोंदवा',
      TA: '+ சம்பவம் பதிவு செய்',
      TE: '+ సంఘటనను నమోదు చేయండి'
    },
    'Export': {
      HI: 'निर्यात (Export)',
      BN: 'রপ্তানি',
      MR: 'निर्यात',
      TA: 'ஏற்றுமதி செய்',
      TE: 'ఎగుమతి'
    },
    'Overall': {
      HI: 'समग्र (Overall)',
      BN: 'সার্বিক',
      MR: 'एकूण',
      TA: 'ஒட்டுமொத்த',
      TE: 'మొత్తం'
    },
    'By Technician': {
      HI: 'तकनीशियन अनुसार',
      BN: 'প্রকৌশলী অনুযায়ী',
      MR: 'तंत्रज्ञानुसार',
      TA: 'தொழில்நுட்ப வல்லுநர் வாரியாக',
      TE: 'టెక్నీషియన్ ప్రకారం'
    },
    'All Locations': {
      HI: 'सभी स्थान',
      BN: 'সমস্ত অবস্থান',
      MR: 'सर्व स्थाने',
      TA: 'அனைத்து இடங்களும்',
      TE: 'అన్ని స్థానాలు'
    },
    'All Statuses': {
      HI: 'सभी स्थितियां',
      BN: 'সমস্ত অবস্থা',
      MR: 'सर्व स्थिती',
      TA: 'அனைத்து நிலைகளும்',
      TE: 'అన్ని స్థితులు'
    },
    'All Departments': {
      HI: 'सभी विभाग',
      BN: 'সমস্ত বিভাগ',
      MR: 'सर्व विभाग',
      TA: 'அனைத்து துறைகளும்',
      TE: 'అన్ని విభాగాలు'
    },
    'Civil Engineering': {
      HI: 'सिविल इंजीनियरिंग (पी-वे)',
      BN: 'সিভিল ইঞ্জিনিয়ারিং',
      MR: 'सिव्हिल अभियांत्रिकी',
      TA: 'சிவில் இன்ஜினியரிங்',
      TE: 'సివిల్ ఇంజనీరింగ్'
    },
    'Electrical TRD': {
      HI: 'विद्युत (टीआरडी)',
      BN: 'বৈদ্যুতিক টিআরডি',
      MR: 'विद्युत टीआरडी',
      TA: 'மின்சார டிஆர்டி',
      TE: 'ఎలక్ట్రికల్ టిఆర్డి'
    },
    'Signal & Telecom': {
      HI: 'सिग्नल एवं दूरसंचार (एसएंडटी)',
      BN: 'সিগন্যাল ও টেলিকম',
      MR: 'सिग्नल आणि दूरसंचार',
      TA: 'சிக்னல் & டெலிகாம்',
      TE: 'సిగ్నల్ & టెలికాం'
    },
    'Cancel': {
      HI: 'रद्द करें',
      BN: 'বাতিল',
      MR: 'रद्द करा',
      TA: 'ரத்து செய்',
      TE: 'రద్దు చేయండి'
    },
    'Save': {
      HI: 'सहेजें',
      BN: 'সংরক্ষণ',
      MR: 'जतन करा',
      TA: 'சேமி',
      TE: 'సేవ్ చేయండి'
    },
    'Close': {
      HI: 'बंद करें',
      BN: 'বন্ধ করুন',
      MR: 'बंद करा',
      TA: 'மூடு',
      TE: 'మూసివేయి'
    },
    'Close Dossier': {
      HI: 'डोज़ियर बंद करें',
      BN: 'ডজিয়ার বন্ধ করুন',
      MR: 'डोसियर बंद करा',
      TA: 'கோப்பை மூடு',
      TE: 'డాసియర్‌ను మూసివేయండి'
    },
    'Print IR Safety Certificate': {
      HI: '🖨️ संरक्षा प्रमाणपत्र प्रिंट करें',
      BN: '🖨️ নিরাপত্তা শংসাপত্র প্রিন্ট করুন',
      MR: '🖨️ सुरक्षा प्रमाणपत्र मुद्रित करा',
      TA: '🖨️ பாதுகாப்பு சான்றிதழை அச்சிடுக',
      TE: '🖨️ భద్రతా ధృవీకరణ పత్రాన్ని ముద్రించండి'
    },

    // ── Form Modal Titles & Verdicts ──
    'Asset QA Inspection & Safety Certification': {
      HI: 'परिसंपत्ति गुणवत्ता निरीक्षण एवं संरक्षा प्रमाणन',
      BN: 'সম্পদ গুণমান পরিদর্শন ও নিরাপত্তা প্রশংসাপত্র',
      MR: 'मालमत्ता गुणवत्ता तपासणी आणि सुरक्षा प्रमाणन',
      TA: 'சொத்து தர ஆய்வு & பாதுகாப்பு சான்றிதழ்',
      TE: 'ఆస్తి నాణ్యత తనిఖీ & భద్రతా ధృవీకరణ'
    },
    'Report New Incident': {
      HI: 'नई संरक्षा घटना दर्ज करें',
      BN: 'নতুন ঘটনা রিপোর্ট করুন',
      MR: 'नवीन घटना नोंदवा',
      TA: 'புதிய சம்பவத்தை பதிவு செய்',
      TE: 'కొత్త సంఘటనను నివేదించండి'
    },
    'PASS / APPROVE': {
      HI: '✓ स्वीकृत / उत्तीर्ण',
      BN: '✓ অনুমোদিত / পাস',
      MR: '✓ मंजूर / उत्तीर्ण',
      TA: '✓ ஒப்புதல் / தேர்ச்சி',
      TE: '✓ ఆమోదించబడింది / పాస్'
    },
    'FAIL / REJECT': {
      HI: '⚠️ अस्वीकृत / विफल',
      BN: '⚠️ প্রত্যাখ্যাত / ব্যর্থ',
      MR: '⚠️ नाकारले / अयशस्वी',
      TA: '⚠️ நிராகரிப்பு / தோல்வி',
      TE: '⚠️ తిరస్కరించబడింది / విఫలమైంది'
    },
    'RE-EVALUATE': {
      HI: '🔄 पुनर्मूल्यांकन',
      BN: '🔄 পুনর্মূল্যায়ন',
      MR: '🔄 पुनर्मूल्यांकन',
      TA: '🔄 மறு மதிப்பீடு',
      TE: '🔄 పునఃపరిశీలన'
    },

    // ── Stakeholder & Footer Directory ──
    'Stakeholder & Governance Directory': {
      HI: 'हितधारक एवं प्रशासनिक संपर्क निर्देशिका',
      BN: 'অংশীদার ও প্রশাসনিক ডিরেক্টরি',
      MR: 'भागधारक आणि प्रशासकीय निर्देशिका',
      TA: 'பங்குதாரர்கள் & நிர்வாக அடைவு',
      TE: 'స్టేక్‌హోల్డర్ & పరిపాలన డైరెక్టరీ'
    },
    'Key institutional leadership and operational points of contact across Ministry of Railways and CRIS.': {
      HI: 'रेल मंत्रालय एवं क्रिस (CRIS) के प्रमुख प्रशासनिक एवं परिचालन संपर्क सूत्र।',
      BN: 'রেল মন্ত্রণালয় এবং ক্রিসের (CRIS) মূল প্রাতিষ্ঠানিক ও অপারেশনাল যোগাযোগের তালিকা।',
      MR: 'रेल्वे मंत्रालय आणि क्रिस (CRIS) मधील प्रमुख प्रशासकीय व ऑपरेशनल संपर्क बिंदू.',
      TA: 'ரயில்வே அமைச்சகம் மற்றும் கிரிஸ் (CRIS) இன் முக்கிய நிர்வாக தொடர்பு புள்ளிகள்.',
      TE: 'రైల్వే మంత్రిత్వ శాఖ మరియు క్రిస్ (CRIS) యొక్క ముఖ్య పరిపాలనా మరియు కార్యాచరణ సంప్రదింపు పాయింట్లు.'
    }
  };

  class UniversalTranslator {
    constructor() {
      this.currentLang = 'EN';
      this.observer = null;
      this.init();
    }

    init() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && ['EN', 'HI', 'BN', 'MR', 'TA', 'TE'].includes(saved)) {
          this.currentLang = saved;
        }
      } catch (_) {}

      // Apply saved translation once DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.applyTranslations(this.currentLang));
      } else {
        this.applyTranslations(this.currentLang);
      }

      this.setupMutationObserver();
    }

    setLanguage(langCode) {
      if (!langCode || !['EN', 'HI', 'BN', 'MR', 'TA', 'TE'].includes(langCode)) {
        langCode = 'EN';
      }
      this.currentLang = langCode;
      try {
        localStorage.setItem(STORAGE_KEY, langCode);
      } catch (_) {}

      document.documentElement.lang = langCode.toLowerCase();
      this.applyTranslations(langCode);

      // Trigger custom event for external listeners
      window.dispatchEvent(new CustomEvent('ir:language_changed', { detail: { lang: langCode } }));
    }

    applyTranslations(langCode) {
      if (!langCode) langCode = this.currentLang;

      // Translate all text nodes in the DOM
      this.translateNode(document.body, langCode);

      // Translate inputs, buttons, placeholders, titles
      this.translateAttributes(document.body, langCode);
    }

    translateTextString(str, langCode) {
      if (!str || typeof str !== 'string') return str;
      const clean = str.trim();
      if (!clean) return str;

      if (langCode === 'EN') {
        return clean;
      }

      // 1. Exact Dictionary Match
      if (DICTIONARY[clean] && DICTIONARY[clean][langCode]) {
        return str.replace(clean, DICTIONARY[clean][langCode]);
      }

      // 2. Sub-string match across sorted dictionary keys (longest first)
      let translated = str;
      const keys = Object.keys(DICTIONARY).sort((a, b) => b.length - a.length);
      for (const k of keys) {
        if (translated.includes(k) && DICTIONARY[k][langCode]) {
          translated = translated.split(k).join(DICTIONARY[k][langCode]);
        }
      }
      return translated;
    }

    translateNode(rootNode, langCode) {
      if (!rootNode) return;

      // Skip script, style, code, pre tags
      const skipTags = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT', 'TEXTAREA'];
      if (skipTags.includes(rootNode.nodeName)) return;

      const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function (node) {
            if (!node || !node.nodeValue || !node.nodeValue.trim()) {
              return NodeFilter.FILTER_REJECT;
            }
            if (node.parentElement && skipTags.includes(node.parentElement.nodeName)) {
              return NodeFilter.FILTER_REJECT;
            }
            // Skip numbers only or symbols
            if (/^[0-9\s.,\/#!$%\^&\*;:{}=\-_`~()+-]+$/.test(node.nodeValue.trim())) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        },
        false
      );

      const nodesToTranslate = [];
      let currentNode;
      while ((currentNode = walker.nextNode())) {
        nodesToTranslate.push(currentNode);
      }

      nodesToTranslate.forEach(node => {
        // Save original text if not already saved
        if (typeof node.__ir_original_text === 'undefined') {
          node.__ir_original_text = node.nodeValue;
        }

        const original = node.__ir_original_text;
        if (langCode === 'EN') {
          node.nodeValue = original;
        } else {
          node.nodeValue = this.translateTextString(original, langCode);
        }
      });
    }

    translateAttributes(rootNode, langCode) {
      if (!rootNode) return;

      const elements = rootNode.querySelectorAll('[placeholder], [title]');
      elements.forEach(el => {
        // Placeholder
        if (el.hasAttribute('placeholder')) {
          if (!el.__ir_orig_placeholder) {
            el.__ir_orig_placeholder = el.getAttribute('placeholder');
          }
          const orig = el.__ir_orig_placeholder;
          el.setAttribute('placeholder', langCode === 'EN' ? orig : this.translateTextString(orig, langCode));
        }

        // Title
        if (el.hasAttribute('title')) {
          if (!el.__ir_orig_title) {
            el.__ir_orig_title = el.getAttribute('title');
          }
          const orig = el.__ir_orig_title;
          el.setAttribute('title', langCode === 'EN' ? orig : this.translateTextString(orig, langCode));
        }
      });
    }

    setupMutationObserver() {
      if (this.observer) return;
      this.observer = new MutationObserver((mutations) => {
        if (this.currentLang === 'EN') return;
        let shouldTranslate = false;
        for (const mut of mutations) {
          if (mut.addedNodes && mut.addedNodes.length > 0) {
            for (const node of mut.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Temporarily pause observer to avoid loops
                this.observer.disconnect();
                this.translateNode(node, this.currentLang);
                this.translateAttributes(node, this.currentLang);
                this.observeDOM();
                return;
              }
            }
          }
        }
      });
      this.observeDOM();
    }

    observeDOM() {
      if (this.observer) {
        this.observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    }
  }

  // Instantiate globally
  window.IR_I18N = new UniversalTranslator();

})();
