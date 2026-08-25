// Not a Server Action -- copy for Volunteer Sign-Up.dc.html's screens 1
// (language) and 2 (consent), the only two screens that get translated
// ("three things get translated, not the questions... a handful of
// sentences, translated properly once, with nothing to keep in sync").
//
// Best-effort translations for Arabic/Russian/Persian/Ukrainian -- the
// Turkish text below is taken verbatim from the design handoff; the other
// four follow its meaning and register but have not had a native-speaker
// legal review. Worth one pass before this goes in front of real
// volunteers, same as the design doc's own "translated once by a human"
// principle -- this is a first draft, not that pass.
export interface SignupLanguage {
  code: string;
  native: string;
  english: string;
  isFallback?: boolean;
}

export const SIGNUP_LANGUAGES: SignupLanguage[] = [
  { code: "tr", native: "Türkçe", english: "Turkish" },
  { code: "ar", native: "العربية", english: "Arabic" },
  { code: "ru", native: "Русский", english: "Russian" },
  { code: "fa", native: "فارسی", english: "Persian" },
  { code: "uk", native: "Українська", english: "Ukrainian" },
  { code: "en", native: "English", english: "English" },
  { code: "other", native: "My language is not here", english: "Continue in English", isFallback: true },
];

export interface SignupTranslation {
  greeting: string;
  langQuestion: string;
  continueLabel: string;
  languageSub: string;
  consentHeading: string;
  consentIntro: string;
  consentLines: [string, string, string];
  agreeLabel: string;
  answerInEnglishNote: string;
  recordingConsentLine: string;
}

export const SIGNUP_TRANSLATIONS: Record<string, SignupTranslation> = {
  tr: {
    greeting: "Hoş geldiniz",
    langQuestion: "Hangi dilde okumak istersiniz?",
    continueLabel: "Devam et",
    languageSub: "You will answer in English, but everything we explain is in your language.",
    consentHeading: "Başlamadan önce",
    consentIntro: "Lütfen aşağıdaki hususları dikkate alın.",
    consentLines: [
      "Sağladığınız bilgiler, öğretmen eğitimi amacıyla merkezle paylaşılacaktır.",
      "Öğretmen adayları bu bilgilere ödevlerinde başvurabilir. Bilgileriniz başka hiçbir tarafla paylaşılmayacaktır.",
      "Kurstan istediğiniz zaman ayrılabilirsiniz.",
    ],
    agreeLabel: "Kabul ediyorum",
    answerInEnglishNote: "İngilizce cevap vereceksiniz, ancak açıkladığımız her şey kendi dilinizde.",
    recordingConsentLine: "Eğitim amaçlı kaydedilmeyi kabul ediyorum.",
  },
  ar: {
    greeting: "مرحبًا",
    langQuestion: "بأي لغة تفضل القراءة؟",
    continueLabel: "متابعة",
    languageSub: "You will answer in English, but everything we explain is in your language.",
    consentHeading: "قبل أن نبدأ",
    consentIntro: "يُرجى مراعاة ما يلي.",
    consentLines: [
      "سيتم مشاركة المعلومات التي تقدمها مع المركز لأغراض تدريب المعلمين.",
      "يجوز للمتدربين الرجوع إليها في أعمالهم الدراسية. لن تُشارك مع أي طرف آخر.",
      "يجوز لك الانسحاب من الدورة في أي وقت.",
    ],
    agreeLabel: "أوافق",
    answerInEnglishNote: "ستجيب باللغة الإنجليزية، لكن كل ما نشرحه هو بلغتك.",
    recordingConsentLine: "أوافق على التسجيل لأغراض تدريبية.",
  },
  ru: {
    greeting: "Добро пожаловать",
    langQuestion: "На каком языке вы хотите читать?",
    continueLabel: "Продолжить",
    languageSub: "You will answer in English, but everything we explain is in your language.",
    consentHeading: "Прежде чем начать",
    consentIntro: "Пожалуйста, ознакомьтесь со следующим.",
    consentLines: [
      "Предоставленная вами информация будет передана центру в целях подготовки преподавателей.",
      "Стажёры-преподаватели могут использовать её в учебных целях. Она не будет передана никакой другой стороне.",
      "Вы можете прекратить участие в курсе в любое время.",
    ],
    agreeLabel: "Я согласен",
    answerInEnglishNote: "Вы будете отвечать по-английски, но всё, что мы объясняем, — на вашем языке.",
    recordingConsentLine: "Я согласен на аудиозапись в учебных целях.",
  },
  fa: {
    greeting: "خوش آمدید",
    langQuestion: "می‌خواهید به چه زبانی بخوانید؟",
    continueLabel: "ادامه",
    languageSub: "You will answer in English, but everything we explain is in your language.",
    consentHeading: "پیش از شروع",
    consentIntro: "لطفاً به موارد زیر توجه فرمایید.",
    consentLines: [
      "اطلاعاتی که ارائه می‌دهید به‌منظور آموزش مربیان در اختیار مرکز قرار خواهد گرفت.",
      "کارآموزان معلمی ممکن است در تکالیف درسی خود به آن استناد کنند. این اطلاعات با هیچ طرف دیگری به اشتراک گذاشته نخواهد شد.",
      "شما می‌توانید در هر زمان از دوره انصراف دهید.",
    ],
    agreeLabel: "موافقم",
    answerInEnglishNote: "شما به انگلیسی پاسخ خواهید داد، اما هرچه توضیح می‌دهیم به زبان شماست.",
    recordingConsentLine: "من با ضبط صدا برای اهداف آموزشی موافقم.",
  },
  uk: {
    greeting: "Ласкаво просимо",
    langQuestion: "Якою мовою ви хочете читати?",
    continueLabel: "Продовжити",
    languageSub: "You will answer in English, but everything we explain is in your language.",
    consentHeading: "Перш ніж почати",
    consentIntro: "Будь ласка, ознайомтеся з наведеною нижче інформацією.",
    consentLines: [
      "Надана вами інформація буде передана центру з метою підготовки викладачів.",
      "Стажери-викладачі можуть використовувати її у своїх навчальних роботах. Вона не буде передана жодній іншій стороні.",
      "Ви можете припинити участь у курсі в будь-який час.",
    ],
    agreeLabel: "Погоджуюсь",
    answerInEnglishNote: "Ви відповідатимете англійською, але все, що ми пояснюємо, — вашою мовою.",
    recordingConsentLine: "Я погоджуюсь на аудіозапис із навчальною метою.",
  },
  en: {
    greeting: "Welcome",
    langQuestion: "Which language would you like to read in?",
    continueLabel: "Continue",
    languageSub: "You will answer in English throughout.",
    consentHeading: "Before we begin",
    consentIntro: "Please note the following.",
    consentLines: [
      "The information you provide will be shared with the centre for teacher-training purposes.",
      "Trainee teachers may reference it in their coursework. It will not be shared with any other party.",
      "You may withdraw from the course at any time.",
    ],
    agreeLabel: "I agree",
    answerInEnglishNote: "You will answer in English throughout.",
    recordingConsentLine: "I agree to being recorded for training purposes.",
  },
  other: {
    greeting: "Welcome",
    langQuestion: "Which language would you like to read in?",
    continueLabel: "Continue in English",
    languageSub: "The centre can help you in person if English is difficult here.",
    consentHeading: "Before we begin",
    consentIntro: "Please note the following.",
    consentLines: [
      "The information you provide will be shared with the centre for teacher-training purposes.",
      "Trainee teachers may reference it in their coursework. It will not be shared with any other party.",
      "You may withdraw from the course at any time.",
    ],
    agreeLabel: "I agree",
    answerInEnglishNote: "You will answer in English throughout.",
    recordingConsentLine: "I agree to being recorded for training purposes.",
  },
};
