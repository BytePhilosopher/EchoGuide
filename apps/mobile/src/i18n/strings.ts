export type Locale = 'am-ET' | 'en-US';

const STRINGS = {
  confirmTitle: { 'am-ET': 'እርግጠኛ ነዎት?', 'en-US': 'Are you sure?' },
  confirmBody: {
    'am-ET': 'ይህ ትእዛዝ መቀልበስ የማይቻል እርምጃ ይፈጽማል። ልቀጥል?',
    'en-US': 'This command performs an action that cannot be undone. Continue?',
  },
  confirmYes: { 'am-ET': 'አዎ፣ ቀጥል', 'en-US': 'Yes, continue' },
  confirmNo: { 'am-ET': 'አይ፣ ተወው', 'en-US': 'No, cancel' },
  confirmYesHint: { 'am-ET': 'እርምጃውን ያከናውናል', 'en-US': 'Performs the action' },
  grantTitle: { 'am-ET': 'የድምጽ ቁጥጥር ይፈቀድ?', 'en-US': 'Allow voice control?' },
  grantBody: {
    'am-ET': 'EchoGuide በዚህ መተግበሪያ ውስጥ የድምጽ ትእዛዞችዎን እንዲፈጽም ይፈቅዳሉ?',
    'en-US': 'Allow EchoGuide to carry out your voice commands in this app?',
  },
  confirmNoHint: { 'am-ET': 'ትእዛዙን ይሰርዛል', 'en-US': 'Cancels the command' },
  listening: { 'am-ET': 'በማዳመጥ ላይ', 'en-US': 'Listening' },
  paused: { 'am-ET': 'ቆሟል', 'en-US': 'Paused' },
  engineListening: { 'am-ET': 'የድምጽ ረዳቱ በማዳመጥ ላይ ነው', 'en-US': 'Voice engine listening' },
  enginePaused: { 'am-ET': 'የድምጽ ረዳቱ ቆሟል', 'en-US': 'Voice engine paused' },
  engineUnavailable: {
    'am-ET': 'የድምጽ ረዳቱ በዚህ ግንባታ ውስጥ የለም',
    'en-US': 'Voice engine unavailable in this build',
  },
  tapToStart: { 'am-ET': 'ለመጀመር ማይክሮፎኑን ይንኩ።', 'en-US': 'Tap the microphone to start.' },
  tapEachTime: {
    'am-ET': 'ትእዛዝ ለመናገር በእያንዳንዱ ጊዜ ማይክሮፎኑን ይንኩ።',
    'en-US': 'Tap the microphone each time you want to speak a command.',
  },
  sayWakeThenCommand: {
    'am-ET': 'የማንቂያ ቃሉን ይናገሩ፣ ከዚያ ትእዛዝዎን።',
    'en-US': 'Say the wake word, then your command.',
  },
  enableInSettings: {
    'am-ET': 'EchoGuide በተደራሽነት ቅንብሮች ውስጥ ያብሩት፣ ስራ እንዲሰራልዎ።',
    'en-US': 'Turn on EchoGuide in Accessibility settings so it can act for you.',
  },
  micTitle: { 'am-ET': 'ማይክሮፎን ያስፈልጋል', 'en-US': 'Microphone needed' },
  micBody: {
    'am-ET': 'EchoGuide ትእዛዞችዎን ለመስማት ማይክሮፎን ያስፈልገዋል። በመተግበሪያ ቅንብሮች ውስጥ ይፍቀዱ።',
    'en-US': 'EchoGuide needs the microphone to hear your commands. Allow it in app settings.',
  },
  openAppSettings: { 'am-ET': 'የመተግበሪያ ቅንብሮችን ክፈት', 'en-US': 'Open app settings' },
  a11yStepOpen: {
    'am-ET': 'የተደራሽነት ቅንብሮችን ይክፈቱ። EchoGuide ን ይፈልጉ (በ"የተጫኑ መተግበሪያዎች" ወይም "የወረዱ መተግበሪያዎች" ስር ሊሆን ይችላል) እና ያብሩት።',
    'en-US': 'Open Accessibility settings. Find EchoGuide (it may be under "Installed apps" or "Downloaded apps") and turn it on.',
  },
  a11yStepConfirm: {
    'am-ET': 'Android ሲጠይቅ "ፍቀድ" ን ይንኩ። ከዚያ ወደ EchoGuide ይመለሱ።',
    'en-US': 'When Android asks, tap "Allow". Then come back to EchoGuide.',
  },
  a11yStepRestricted: {
    'am-ET': '"የተገደበ ቅንብር" የሚል መልዕክት ካዩ "እሺ" ን ይንኩ። Android ከPlay መደብር ውጭ የተጫኑ መተግበሪያዎችን በዚህ መንገድ ይጠብቃል። ስህተት አይደለም።',
    'en-US': 'If you see "Restricted setting", tap "OK". Android does this for apps installed outside the Play Store. Nothing is wrong.',
  },
  a11yStepAllow: {
    'am-ET': 'የመተግበሪያ መረጃን ይክፈቱ። ከላይ በቀኝ ያለውን ⋮ ምናሌ ይንኩ፣ "የተገደቡ ቅንብሮችን ፍቀድ" ን ይምረጡ፣ እና በፒን ወይም በጣት አሻራ ያረጋግጡ።',
    'en-US': 'Open App info. Tap the ⋮ menu at the top right, choose "Allow restricted settings", and confirm with your PIN or fingerprint.',
  },
  a11yStepFinish: {
    'am-ET': 'ወደ የተደራሽነት ቅንብሮች ይመለሱ፣ EchoGuide ን ያብሩ፣ እና "ፍቀድ" ን ይንኩ።',
    'en-US': 'Go back to Accessibility settings, turn on EchoGuide, and tap "Allow".',
  },
  a11yStepDone: {
    'am-ET': 'ሲበራ ይህ መመሪያ ይጠፋል።',
    'en-US': 'Once it is on, this guide disappears.',
  },
  openAppInfo: { 'am-ET': 'የመተግበሪያ መረጃን ክፈት', 'en-US': 'Open App info' },
  openAccessibility: { 'am-ET': 'የተደራሽነት ቅንብሮችን ክፈት', 'en-US': 'Open Accessibility settings' },
  openAccessibilityHint: {
    'am-ET': 'EchoGuide ን ለማብራት የAndroid ቅንብሮችን ይከፍታል',
    'en-US': 'Opens Android settings so you can turn EchoGuide on',
  },
  startListening: { 'am-ET': 'ማዳመጥ ለመጀመር ሁለቴ ይንኩ', 'en-US': 'Double tap to start listening' },
  stopListening: { 'am-ET': 'ማዳመጥ ለማቆም ሁለቴ ይንኩ', 'en-US': 'Double tap to stop listening' },
  commands: { 'am-ET': 'ትእዛዞች', 'en-US': 'Commands' },
  success: { 'am-ET': 'ተሳክቷል', 'en-US': 'Success' },
  avgLatency: { 'am-ET': 'አማካይ ጊዜ', 'en-US': 'Avg Latency' },
  historyTitle: { 'am-ET': 'የትእዛዝ ውጤቶች', 'en-US': 'Command Outcomes' },
  historySubtitle: {
    'am-ET': 'የተናገሩት እያንዳንዱ ትእዛዝ ምን እንደሆነ። ምንም ቅጂ አይቀመጥም።',
    'en-US': 'What happened to each command you spoke. No recordings are kept.',
  },
  historyEmpty: {
    'am-ET': 'እስካሁን ምንም ትእዛዝ የለም። የመጀመሪያውን ሲናገሩ እዚህ ይታያል።',
    'en-US': 'No commands yet. Your first one will appear here.',
  },
  filterAll: { 'am-ET': 'ሁሉም', 'en-US': 'All' },
  outcomeDone: { 'am-ET': 'ተጠናቋል', 'en-US': 'Completed' },
  outcomeFailed: { 'am-ET': 'አልተሳካም', 'en-US': 'Failed' },
  outcomeRejected: { 'am-ET': 'አልተረዳም', 'en-US': 'Not understood' },
  outcomeBlocked: { 'am-ET': 'ታግዷል', 'en-US': 'Blocked' },
  outcomeCancelled: { 'am-ET': 'ተሰርዟል', 'en-US': 'Cancelled' },
  welcomeTitle: { 'am-ET': 'እንኳን ወደ EchoGuide በደህና መጡ', 'en-US': 'Welcome to EchoGuide' },
  welcomeSubtitle: {
    'am-ET': 'በአማርኛ እና በእንግሊዝኛ ስልክዎን በድምጽ ይቆጣጠሩ',
    'en-US': 'Control your phone by voice, in Amharic and English',
  },
  onboardingScreenLabel: { 'am-ET': 'የማዋቀሪያ ማያ ገጽ', 'en-US': 'Setup screen' },
  step1Title: { 'am-ET': 'ደረጃ 1። ቋንቋ ይምረጡ', 'en-US': 'Step 1. Choose your language' },
  step1Subtitle: {
    'am-ET': 'EchoGuide በዚህ ቋንቋ ያዳምጣል እና ይመልሳል። በኋላ መቀየር ይችላሉ።',
    'en-US': 'EchoGuide will listen and reply in this language. You can change it later.',
  },
  amharicName: { 'am-ET': 'አማርኛ', 'en-US': 'Amharic' },
  englishName: { 'am-ET': 'እንግሊዝኛ', 'en-US': 'English' },
  amharicDesc: { 'am-ET': 'በበይነመረብ ይሰራል', 'en-US': 'Works over the internet' },
  englishDesc: { 'am-ET': 'በስልክዎ ላይ ይሰራል', 'en-US': 'Works on your phone' },
  step2Title: { 'am-ET': 'ደረጃ 2። ግላዊነት እና ፈቃድ', 'en-US': 'Step 2. Privacy and consent' },
  step2Body: {
    'am-ET': 'EchoGuide ድምጽዎን የሚጠቀመው የተናገሩትን ትእዛዝ ለመፈጸም ብቻ ነው። ምንም ቅጂ ወይም ጽሑፍ አይቀመጥም።',
    'en-US':
      'EchoGuide uses your voice only to carry out the command you spoke. No recordings and no transcripts are kept.',
  },
  grantConsent: { 'am-ET': 'የድምጽ ፈቃድ ይስጡ', 'en-US': 'Allow voice processing' },
  consentRequired: { 'am-ET': 'ፈቃድ ያስፈልጋል', 'en-US': 'Consent required' },
  consentRequiredBody: {
    'am-ET': 'ትእዛዞችዎን ለመፈጸም EchoGuide ፈቃድዎን ይፈልጋል።',
    'en-US': 'EchoGuide needs your permission before it can carry out commands.',
  },
  step3Title: { 'am-ET': 'ደረጃ 3። የተደራሽነት አገልግሎት', 'en-US': 'Step 3. Accessibility service' },
  step3Body: {
    'am-ET': 'በእርስዎ ምትክ መንካት፣ ማሸብለል እና መዘዋወር እንዲችል EchoGuide ፈቃድ ይፈልጋል።',
    'en-US': 'EchoGuide needs permission to tap, scroll and navigate on your behalf.',
  },
  serviceActive: { 'am-ET': 'ነቅቷል', 'en-US': 'Active' },
  serviceSetupNeeded: { 'am-ET': 'ማዋቀር ያስፈልጋል', 'en-US': 'Setup needed' },
  serviceConnected: { 'am-ET': 'አገልግሎቱ ተገናኝቷል።', 'en-US': 'The service is connected.' },
  finishSetup: { 'am-ET': 'ማዋቀር ጨርስ', 'en-US': 'Finish setup' },
  finishing: { 'am-ET': 'በማዋቀር ላይ...', 'en-US': 'Setting up...' },
  settingsTitle: { 'am-ET': 'ቅንብሮች', 'en-US': 'Settings' },
  language: { 'am-ET': 'ቋንቋ', 'en-US': 'Language' },
  revokeConsent: { 'am-ET': 'ፈቃድ ሰርዝ', 'en-US': 'Revoke consent' },
  revokeConsentTitle: { 'am-ET': 'ፈቃድ ይሰረዝ?', 'en-US': 'Revoke consent?' },
  revokeConsentBody: {
    'am-ET': 'EchoGuide ወዲያውኑ ማዳመጥ ያቆማል። በኋላ እንደገና ማብራት ይችላሉ።',
    'en-US': 'EchoGuide will stop listening immediately. You can turn it back on later.',
  },
  revokeConsentDone: { 'am-ET': 'ፈቃዱ ተሰርዟል።', 'en-US': 'Consent revoked.' },
  notSyncedTitle: { 'am-ET': 'አገልጋዩ ላይ መድረስ አልተቻለም', 'en-US': 'Could not reach the server' },
  revokeNotSynced: {
    'am-ET': 'ፈቃዱ በዚህ መሣሪያ ላይ ተሰርዟል፣ ነገር ግን አገልጋዩ ላይ አልተመዘገበም። መረብ ሲኖር እንደገና ይሞክሩ።',
    'en-US': 'Consent is revoked on this device, but the server did not record it. Try again when you are online.',
  },
  retentionNotSaved: {
    'am-ET': 'ምርጫዎ አልተቀመጠም። መረብ ሲኖር እንደገና ይሞክሩ።',
    'en-US': 'Your choice was not saved. Try again when you are online.',
  },
  deleteData: { 'am-ET': 'መረጃዬን ሰርዝ', 'en-US': 'Delete my data' },
  deleteDataSub: {
    'am-ET': 'መለያዎን እና ከእሱ ጋር የተያያዘውን መረጃ ሁሉ ከአገልጋዩ እና ከዚህ መሣሪያ ይሰርዛል።',
    'en-US': 'Deletes your account and everything tied to it, on the server and on this device.',
  },
  deleteDataTitle: { 'am-ET': 'መረጃዎ ሁሉ ይሰረዝ?', 'en-US': 'Delete all your data?' },
  deleteDataBody: {
    'am-ET': 'ይህ መቀልበስ አይቻልም። EchoGuideን እንደገና ለመጠቀም ከመጀመሪያው ማዋቀር ያስፈልግዎታል።',
    'en-US': 'This cannot be undone. You will need to set EchoGuide up again to keep using it.',
  },
  deleteDataFailed: {
    'am-ET': 'መረጃዎ አልተሰረዘም። መረብ ሲኖር እንደገና ይሞክሩ።',
    'en-US': 'Your data was not deleted. Try again when you are online.',
  },
  planLoading: { 'am-ET': 'እቅድዎን በመጫን ላይ', 'en-US': 'Loading your plan' },
  planUnavailable: {
    'am-ET': 'እቅድዎን መጫን አልተቻለም።',
    'en-US': 'Your plan could not be loaded.',
  },
  planRetry: { 'am-ET': 'እንደገና ሞክር', 'en-US': 'Try again' },
  planFree: { 'am-ET': 'ነፃ አጠቃቀም', 'en-US': 'Free access' },
  planFreeSub: {
    'am-ET': 'አሁን ትእዛዞች ያለ ክፍያ ይሰራሉ።',
    'en-US': 'Commands run without a paid plan for now.',
  },
  cancel: { 'am-ET': 'ተወው', 'en-US': 'Cancel' },
  revoking: { 'am-ET': 'በመሰረዝ ላይ...', 'en-US': 'Revoking...' },
  accountTitle: { 'am-ET': 'መለያ', 'en-US': 'Account' },
  sectionLanguage: { 'am-ET': 'ቋንቋ', 'en-US': 'LANGUAGE' },
  sectionVoice: { 'am-ET': 'የድምጽ መቆጣጠሪያ', 'en-US': 'VOICE CONTROLS' },
  sectionPrivacy: { 'am-ET': 'ግላዊነት', 'en-US': 'PRIVACY' },
  wakeWordLabel: { 'am-ET': 'የማንቂያ ቃል ሁልጊዜ ይስራ', 'en-US': 'Always listen for the wake word' },
  wakeWordSub: {
    'am-ET': 'መተግበሪያው ተዘግቶም EchoGuide ማዳመጡን ይቀጥላል።',
    'en-US': 'EchoGuide keeps listening even when the app is closed.',
  },
  retentionLabel: { 'am-ET': 'ድምጽ እንዲቀመጥ ፍቀድ', 'en-US': 'Allow audio to be kept' },
  retentionSub: {
    'am-ET': 'በነባሪ ምንም ድምጽ አይቀመጥም። የአማርኛ ድምጽ ማወቂያን ለማሻሻል መርዳት ከፈለጉ ብቻ ያብሩት።',
    'en-US':
      'By default nothing is kept. Turn this on only if you want to help improve Amharic speech recognition.',
  },
  revocationLabel: { 'am-ET': 'ፈቃድ እና ደህንነት', 'en-US': 'Consent and security' },
  revocationSub: {
    'am-ET': 'ፈቃዱን ሲሰርዙ EchoGuide ወዲያውኑ ማዳመጥ ያቆማል።',
    'en-US': 'Revoking consent stops EchoGuide listening immediately.',
  },
  amharicEngine: { 'am-ET': 'በበይነመረብ', 'en-US': 'Over the internet' },
  englishEngine: { 'am-ET': 'በስልክዎ ላይ', 'en-US': 'On your phone' },
  accountSubtitle: { 'am-ET': 'የእርስዎ መሣሪያ እና እቅድ', 'en-US': 'Your device and plan' },
  sectionPlan: { 'am-ET': 'እቅድ', 'en-US': 'PLAN' },
  sectionDevice: { 'am-ET': 'መሣሪያ', 'en-US': 'DEVICE' },
  planNone: { 'am-ET': 'ምንም ንቁ እቅድ የለም', 'en-US': 'No active plan' },
  planRenews: { 'am-ET': 'የሚታደሰው', 'en-US': 'Renews' },
  planNoRenewal: { 'am-ET': 'የሚታደስበት ቀን የለም', 'en-US': 'No renewal date' },
  commandsUsed: { 'am-ET': 'በዚህ ወር የተጠቀሙት', 'en-US': 'Used this period' },
  installIdLabel: { 'am-ET': 'የመሣሪያ መለያ', 'en-US': 'Device ID' },
  installIdUnknown: { 'am-ET': 'ገና አልተመዘገበም', 'en-US': 'Not registered yet' },
  statusActive: { 'am-ET': 'ንቁ', 'en-US': 'Active' },
  statusInactive: { 'am-ET': 'ንቁ አይደለም', 'en-US': 'Inactive' },
  voiceMissingTitle: { 'am-ET': 'የአማርኛ ድምጽ አልተጫነም', 'en-US': 'Amharic voice not installed' },
  voiceMissingBody: {
    'am-ET': 'ስልክዎ በአማርኛ መናገር አይችልም፣ ስለዚህ EchoGuide በእንግሊዝኛ ይመልሳል። በቅንብሮች ውስጥ የአማርኛ ድምጽ ይጫኑ።',
    'en-US':
      'Your phone cannot speak Amharic, so EchoGuide will reply in English. Install an Amharic voice in settings.',
  },
  openVoiceSettings: { 'am-ET': 'የድምጽ ቅንብሮችን ክፈት', 'en-US': 'Open voice settings' },
  openVoiceSettingsHint: {
    'am-ET': 'የአማርኛ ድምጽ ለመጫን የAndroid ቅንብሮችን ይከፍታል',
    'en-US': 'Opens Android settings so you can install an Amharic voice',
  },

  sectionWakeWord: { 'am-ET': 'የማንቂያ ቃል', 'en-US': 'WAKE WORD' },
  wakeWordPickerHint: {
    'am-ET': 'EchoGuide የሚያዳምጠው ቃል። ረዘም ያለ ቃል በስህተት የመነሳት እድሉ ያንሳል።',
    'en-US': 'The word EchoGuide listens for. A longer phrase triggers by accident less often.',
  },

  tabHome: { 'am-ET': 'ዋና', 'en-US': 'Home' },
  tabHistory: { 'am-ET': 'ታሪክ', 'en-US': 'History' },
  tabSettings: { 'am-ET': 'ቅንብሮች', 'en-US': 'Settings' },
  tabAccount: { 'am-ET': 'መለያ', 'en-US': 'Account' },
  privacyTitle: { 'am-ET': 'ምንም አይቀመጥም', 'en-US': 'Nothing is kept' },
  privacyDesc: {
    'am-ET': 'የተናገሩት ጽሑፍም ሆነ ድምጽ አይቀመጥም፣ አይላክም።',
    'en-US': 'No transcripts and no recordings are stored or sent.',
  },
  emptyFilter: { 'am-ET': 'በዚህ ማጣሪያ ምንም የለም', 'en-US': 'Nothing matches this filter' },
  latencyLabel: { 'am-ET': 'የፈጀው ጊዜ', 'en-US': 'Took' },
  settingsSubtitle: {
    'am-ET': 'ቋንቋ፣ ማዳመጥ እና ፈቃድ',
    'en-US': 'Language, listening and permissions',
  },
  sectionPerformance: { 'am-ET': 'አጠቃቀም', 'en-US': 'USAGE' },
  sectionTryThese: { 'am-ET': 'እነዚህን ይሞክሩ', 'en-US': 'TRY THESE' },
  tryThesePrompt: { 'am-ET': 'የድምጽ ትእዛዞች', 'en-US': 'Voice commands' },
  exampleOpenApp: { 'am-ET': 'ቴሌግራምን ክፈት', 'en-US': 'open Telegram' },
  tipOpenApp: { 'am-ET': 'መተግበሪያውን ይከፍታል', 'en-US': 'Opens the app' },
  exampleTap: { 'am-ET': 'Wi-Fi ን ንካ', 'en-US': 'tap Wi-Fi' },
  tipTap: {
    'am-ET': 'በማያ ገጹ ላይ የሚታየውን ይነካል',
    'en-US': 'Taps something you can see on the screen',
  },
  exampleScroll: { 'am-ET': 'ወደ ታች አሸብልል', 'en-US': 'scroll down' },
  tipScroll: { 'am-ET': 'ገጹን ያሸብልላል', 'en-US': 'Scrolls the page' },
  howToUse: {
    'am-ET': 'ወደ ማንኛውም መተግበሪያ ይሂዱ፣ ከዚያ የማንቂያ ቃሉን ይናገሩ ወይም የተደራሽነት አዝራሩን ይንኩ፣ እና በዚያ ማያ ገጽ ላይ ያለውን ይናገሩ። EchoGuide የሚሰራው አሁን በሚያዩት ማያ ገጽ ላይ ነው።',
    'en-US': 'Go to any app, then say the wake word or tap the Accessibility button, and say what to do on that screen. EchoGuide acts on the screen you are looking at.',
  },
  modelSetupTitle: { 'am-ET': 'ድምጽ በማዘጋጀት ላይ', 'en-US': 'Setting up voice' },
  modelSetupBody: {
    'am-ET': 'ይህ በመጀመሪያ ጊዜ ብቻ ነው። እስኪጠናቀቅ ድረስ ማይክሮፎኑን ይንኩ።',
    'en-US': 'This happens once. Until it finishes, tap the microphone to speak.',
  },
} as const;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, locale: Locale): string {
  return STRINGS[key][locale];
}
