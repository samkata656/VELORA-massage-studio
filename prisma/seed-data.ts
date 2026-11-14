export interface SeedProcedure {
  slug: string;
  nameEn: string;
  nameBg: string;
  summaryEn: string;
  summaryBg: string;
  therapistsRequired?: number;
  variants: { durationMin: number; price: number }[];
  article: { titleEn: string; titleBg: string; bodyEn: string; bodyBg: string };
}

export const procedures: SeedProcedure[] = [
  {
    slug: "swedish-relaxation",
    nameEn: "Relaxation (Swedish) massage",
    nameBg: "Релаксиращ (шведски) масаж",
    summaryEn: "Long, flowing strokes with warm oil to calm the nervous system.",
    summaryBg: "Дълги, плавни движения с топло масло, които успокояват нервната система.",
    variants: [
      { durationMin: 30, price: 45 },
      { durationMin: 60, price: 75 },
      { durationMin: 90, price: 105 },
    ],
    article: {
      titleEn: "Why a Swedish massage feels like a reset",
      titleBg: "Защо шведският масаж действа като рестарт",
      bodyEn:
        "Swedish massage uses long gliding strokes, gentle kneading and rhythmic movements to help the body shift out of its stress response.\n\n- Lowers muscle tension and the feeling of heaviness after long days at a desk\n- Supports better sleep by calming the nervous system\n- Improves circulation, so tired muscles recover faster\n- A gentle first choice if you are new to massage\n\nChoose 30 minutes for a quick pause, 60 minutes for full-body relaxation, or 90 minutes when you want time to truly let go.",
      bodyBg:
        "Шведският масаж използва дълги плъзгащи движения, леко месене и ритмични техники, които помагат на тялото да излезе от състоянието на стрес.\n\n- Намалява мускулното напрежение и усещането за тежест след дълги дни пред бюрото\n- Подпомага по-добрия сън, като успокоява нервната система\n- Подобрява кръвообращението, така че уморените мускули се възстановяват по-бързо\n- Нежен първи избор, ако за първи път посещавате масаж\n\nИзберете 30 минути за кратка пауза, 60 минути за пълна релаксация на тялото или 90 минути, когато искате истински да се отпуснете.",
    },
  },
  {
    slug: "deep-tissue",
    nameEn: "Deep tissue massage",
    nameBg: "Дълбокотъканен масаж",
    summaryEn: "Slow, firm pressure that reaches deeper muscle layers and stubborn knots.",
    summaryBg: "Бавен, силен натиск, който достига до дълбоките мускулни слоеве и упоритите възли.",
    variants: [
      { durationMin: 60, price: 85 },
      { durationMin: 90, price: 115 },
    ],
    article: {
      titleEn: "Deep tissue massage: relief for chronic tension",
      titleBg: "Дълбокотъканен масаж: облекчение при хронично напрежение",
      bodyEn:
        "Deep tissue massage works slowly and deliberately on the deeper layers of muscle and fascia, where long-term tension tends to settle.\n\n- Eases chronic neck, shoulder and lower-back tightness\n- Helps break up adhesions that limit movement\n- Can reduce pain linked to posture and repetitive strain\n- Restores a fuller range of motion\n\nPressure is firm but always agreed with you. Drink water afterwards and expect a pleasant tiredness the next day.",
      bodyBg:
        "Дълбокотъканният масаж работи бавно и целенасочено върху дълбоките слоеве на мускулите и фасцията, където се натрупва дълготрайното напрежение.\n\n- Облекчава хроничното стягане във врата, раменете и кръста\n- Помага за освобождаване на сраствания, които ограничават движението\n- Може да намали болката, свързана с позата и повтарящото се натоварване\n- Възстановява по-пълния обхват на движение\n\nНатискът е силен, но винаги съобразен с вас. Пийте вода след процедурата и очаквайте приятна умора на следващия ден.",
    },
  },
  {
    slug: "sports",
    nameEn: "Sports massage",
    nameBg: "Спортен масаж",
    summaryEn: "Targeted work for active bodies — before events, after training or during recovery.",
    summaryBg: "Целенасочена работа за активни хора — преди състезание, след тренировка или при възстановяване.",
    variants: [{ durationMin: 60, price: 85 }],
    article: {
      titleEn: "Sports massage for performance and recovery",
      titleBg: "Спортен масаж за постижения и възстановяване",
      bodyEn:
        "Sports massage combines stretching, compression and focused deep work on the muscles you use most.\n\n- Speeds up recovery and reduces post-workout soreness\n- Improves flexibility and joint mobility\n- Helps prevent overuse injuries\n- Prepares muscles before a race or competition\n\nIdeal for runners, gym regulars, cyclists and anyone training several times a week.",
      bodyBg:
        "Спортният масаж съчетава разтягане, компресия и фокусирана дълбока работа върху най-натоварените мускули.\n\n- Ускорява възстановяването и намалява мускулната треска след тренировка\n- Подобрява гъвкавостта и подвижността на ставите\n- Помага за предотвратяване на травми от претоварване\n- Подготвя мускулите преди бягане или състезание\n\nПодходящ за бегачи, редовно трениращи във фитнеса, колоездачи и всеки, който тренира няколко пъти седмично.",
    },
  },
  {
    slug: "hot-stone",
    nameEn: "Hot stone massage",
    nameBg: "Масаж с горещи камъни",
    summaryEn: "Smooth heated basalt stones melt tension and warm you to the core.",
    summaryBg: "Гладки затоплени базалтови камъни, които разтапят напрежението и ви стоплят изцяло.",
    variants: [{ durationMin: 75, price: 110 }],
    article: {
      titleEn: "The quiet power of hot stones",
      titleBg: "Тихата сила на горещите камъни",
      bodyEn:
        "Warm basalt stones are placed on key points and used as an extension of the therapist's hands. The heat lets muscles relax faster and more deeply.\n\n- Deep muscle relaxation with less pressure\n- Soothes stiffness, especially in colder months\n- Encourages a calm, meditative state\n- Improves circulation and a feeling of warmth that lasts for hours\n\nNot recommended during pregnancy or with certain circulatory conditions — let us know when booking.",
      bodyBg:
        "Топли базалтови камъни се поставят върху ключови точки и се използват като продължение на ръцете на терапевта. Топлината позволява на мускулите да се отпуснат по-бързо и по-дълбоко.\n\n- Дълбока мускулна релаксация с по-малък натиск\n- Облекчава скованост, особено през студените месеци\n- Насърчава спокойно, медитативно състояние\n- Подобрява кръвообращението и усещането за топлина, което трае с часове\n\nНе се препоръчва по време на бременност или при някои проблеми с кръвообращението — уведомете ни при резервация.",
    },
  },
  {
    slug: "aromatherapy",
    nameEn: "Aromatherapy massage",
    nameBg: "Ароматерапевтичен масаж",
    summaryEn: "A gentle full-body massage with essential oils chosen for your mood.",
    summaryBg: "Нежен масаж на цялото тяло с етерични масла, подбрани според настроението ви.",
    variants: [{ durationMin: 60, price: 80 }],
    article: {
      titleEn: "Aromatherapy massage: calm through the senses",
      titleBg: "Ароматерапевтичен масаж: спокойствие чрез сетивата",
      bodyEn:
        "Before your massage you choose a blend of essential oils — lavender to unwind, citrus to uplift or eucalyptus to breathe freely.\n\n- Reduces stress and anxiety\n- Lifts mood and mental fatigue\n- Supports restful sleep\n- Nourishes the skin with plant oils\n\nA soft, enveloping treatment that works on both body and mind.",
      bodyBg:
        "Преди масажа избирате смес от етерични масла — лавандула за отпускане, цитрусови за повече енергия или евкалипт за свободно дишане.\n\n- Намалява стреса и тревожността\n- Подобрява настроението и облекчава умствената умора\n- Подпомага спокойния сън\n- Подхранва кожата с растителни масла\n\nМека, обгръщаща процедура, която действа едновременно на тялото и ума.",
    },
  },
  {
    slug: "lymphatic-anti-cellulite",
    nameEn: "Anti-cellulite / lymphatic drainage massage",
    nameBg: "Антицелулитен / лимфодренажен масаж",
    summaryEn: "Rhythmic techniques that reduce fluid retention and refine the skin.",
    summaryBg: "Ритмични техники, които намаляват задържането на течности и изглаждат кожата.",
    variants: [
      { durationMin: 45, price: 65 },
      { durationMin: 60, price: 80 },
    ],
    article: {
      titleEn: "Lighter legs and smoother skin",
      titleBg: "По-леки крака и по-гладка кожа",
      bodyEn:
        "Lymphatic drainage uses light, rhythmic movements that follow the lymph pathways; anti-cellulite techniques add more intensive work on problem areas.\n\n- Reduces swelling and the feeling of heavy legs\n- Supports the body's natural detox processes\n- Visibly smooths the skin over a course of treatments\n- Helps after long flights or periods of inactivity\n\nBest results come from a series of 6–10 sessions, one or two per week.",
      bodyBg:
        "Лимфодренажът използва леки, ритмични движения по хода на лимфните пътища, а антицелулитните техники добавят по-интензивна работа върху проблемните зони.\n\n- Намалява отоците и усещането за тежки крака\n- Подпомага естествените процеси на детоксикация на тялото\n- Видимо изглажда кожата при курс от процедури\n- Помага след дълги полети или периоди на обездвижване\n\nНай-добри резултати се постигат с курс от 6–10 процедури, една или две седмично.",
    },
  },
  {
    slug: "back-neck-shoulders",
    nameEn: "Back, neck and shoulders massage",
    nameBg: "Масаж на гръб, врат и рамене",
    summaryEn: "A focused 30-minute release for the areas that carry the most tension.",
    summaryBg: "Фокусирано 30-минутно освобождаване на зоните, които носят най-много напрежение.",
    variants: [{ durationMin: 30, price: 45 }],
    article: {
      titleEn: "Thirty minutes for your shoulders",
      titleBg: "Тридесет минути за вашите рамене",
      bodyEn:
        "Screens, phones and stress all end up in the same place: the neck and shoulders. This short treatment goes straight there.\n\n- Relieves stiffness and tension headaches\n- Improves posture awareness\n- Fits easily into a lunch break\n- A great add-on before or after work\n\nPerfect when you need relief, but don't have an hour.",
      bodyBg:
        "Екраните, телефоните и стресът се натрупват на едно и също място: врата и раменете. Тази кратка процедура отива направо там.\n\n- Облекчава скованост и главоболие от напрежение\n- Подобрява осъзнаването на стойката\n- Лесно се вмества в обедната почивка\n- Чудесен избор преди или след работа\n\nИдеален, когато имате нужда от облекчение, но нямате цял час.",
    },
  },
  {
    slug: "foot-reflexology",
    nameEn: "Foot reflexology",
    nameBg: "Рефлексотерапия на стъпалата",
    summaryEn: "Precise pressure on reflex points of the feet for whole-body balance.",
    summaryBg: "Прецизен натиск върху рефлексните точки на стъпалата за баланс на цялото тяло.",
    variants: [
      { durationMin: 30, price: 40 },
      { durationMin: 45, price: 55 },
    ],
    article: {
      titleEn: "Foot reflexology: small points, big relief",
      titleBg: "Рефлексотерапия: малки точки, голямо облекчение",
      bodyEn:
        "Reflexology applies precise thumb and finger pressure to specific points on the feet, traditionally linked to different areas of the body.\n\n- Deeply relaxing, even for those who dislike full-body massage\n- Relieves tired, aching feet\n- Promotes calm and better sleep\n- Can be enjoyed fully clothed\n\nA wonderful treatment after long days on your feet.",
      bodyBg:
        "Рефлексотерапията прилага прецизен натиск с палци и пръсти върху конкретни точки на стъпалата, традиционно свързани с различни части на тялото.\n\n- Дълбоко отпускаща, дори за хора, които не обичат масаж на цялото тяло\n- Облекчава уморените и болезнени стъпала\n- Насърчава спокойствието и по-добрия сън\n- Може да се прави изцяло облечени\n\nПрекрасна процедура след дълги дни на крак.",
    },
  },
  {
    slug: "prenatal",
    nameEn: "Prenatal massage",
    nameBg: "Масаж за бременни",
    summaryEn: "Safe, side-lying massage for comfort during pregnancy (from the second trimester).",
    summaryBg: "Безопасен масаж в странично положение за комфорт по време на бременност (от втория триместър).",
    variants: [{ durationMin: 60, price: 85 }],
    article: {
      titleEn: "Gentle care for mothers-to-be",
      titleBg: "Нежна грижа за бъдещите майки",
      bodyEn:
        "Our prenatal massage is performed side-lying with supportive cushions and gentle, safe techniques adapted to each stage of pregnancy.\n\n- Eases lower-back and hip discomfort\n- Reduces swelling in legs and feet\n- Helps with sleep and relaxation\n- A calm hour to connect with yourself and your baby\n\nRecommended from the second trimester. Please mention your pregnancy week when booking.",
      bodyBg:
        "Масажът за бременни се извършва в странично положение с поддържащи възглавници и нежни, безопасни техники, съобразени с всеки етап на бременността.\n\n- Облекчава дискомфорта в кръста и бедрата\n- Намалява отоците на краката и стъпалата\n- Помага за съня и отпускането\n- Спокоен час за връзка със себе си и бебето\n\nПрепоръчва се от втория триместър. Моля, посочете седмицата на бременността при резервация.",
    },
  },
  {
    slug: "couples",
    nameEn: "Couples massage",
    nameBg: "Масаж за двама",
    summaryEn: "Two therapists, two adjoining rooms, one shared moment of calm.",
    summaryBg: "Двама терапевти, две съседни стаи, един споделен момент на спокойствие.",
    therapistsRequired: 2,
    variants: [
      { durationMin: 60, price: 150 },
      { durationMin: 90, price: 210 },
    ],
    article: {
      titleEn: "Couples massage: relax together",
      titleBg: "Масаж за двама: отпуснете се заедно",
      bodyEn:
        "Two therapists work at the same time in adjoining rooms, so you and your partner, friend or family member start and finish your ritual together.\n\n- A shared experience and a thoughtful gift\n- Each guest chooses their own pressure and focus\n- Time to slow down together, away from screens\n- Available as 60 or 90 minutes\n\nPerfect for anniversaries, birthdays or simply a calm afternoon for two.",
      bodyBg:
        "Двама терапевти работят едновременно в съседни стаи, така че вие и вашият партньор, приятел или член на семейството започвате и завършвате ритуала си заедно.\n\n- Споделено преживяване и внимателен подарък\n- Всеки гост избира своя натиск и фокус\n- Време да забавите темпото заедно, далеч от екраните\n- Предлага се за 60 или 90 минути\n\nИдеален за годишнини, рождени дни или просто за спокоен следобед за двама.",
    },
  },
];

export const therapists = [
  {
    name: "Georgi Petrov",
    titleEn: "Senior therapist · Deep tissue & sports",
    titleBg: "Старши терапевт · Дълбокотъканен и спортен масаж",
    bioEn: "Former athlete with 12 years of experience in sports recovery and deep tissue work.",
    bioBg: "Бивш спортист с 12 години опит в спортното възстановяване и дълбокотъканния масаж.",
    color: "#8C6A43",
  },
  {
    name: "Maria Ivanova",
    titleEn: "Therapist · Aromatherapy & prenatal",
    titleBg: "Терапевт · Ароматерапия и масаж за бременни",
    bioEn: "Certified prenatal therapist known for her calm, gentle touch.",
    bioBg: "Сертифициран терапевт за бременни, известна със спокойното си и нежно докосване.",
    color: "#6E7350",
  },
  {
    name: "Ivana Dimitrova",
    titleEn: "Therapist · Hot stone & Swedish",
    titleBg: "Терапевт · Горещи камъни и шведски масаж",
    bioEn: "Trained in Bali and Vienna; loves slow, ritual treatments.",
    bioBg: "Обучавала се в Бали и Виена; обича бавните, ритуални процедури.",
    color: "#B07D62",
  },
  {
    name: "Petar Kolev",
    titleEn: "Therapist · Lymphatic drainage & reflexology",
    titleBg: "Терапевт · Лимфодренаж и рефлексотерапия",
    bioEn: "Physiotherapy graduate focused on lymphatic drainage and foot reflexology.",
    bioBg: "Завършил физиотерапия, с фокус върху лимфодренажа и рефлексотерапията.",
    color: "#7A8B8C",
  },
  {
    name: "Elena Stoyanova",
    titleEn: "Therapist · Relaxation & couples rituals",
    titleBg: "Терапевт · Релаксация и ритуали за двама",
    bioEn: "Creates warm, unhurried experiences — a favourite for couples rituals.",
    bioBg: "Създава топли, спокойни преживявания — любимка на гостите за масажите за двама.",
    color: "#A67C46",
  },
];

export const rooms = [
  { id: 1, name: "Olive", sort: 1 },
  { id: 2, name: "Linen", sort: 2 },
  { id: 3, name: "Amber", sort: 3 },
];
