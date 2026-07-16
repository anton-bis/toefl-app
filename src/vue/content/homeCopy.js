export const taskTypes = [
  ['Reading', ['Complete the Words', 'Read in Daily Life', 'Read an Academic Passage']],
  [
    'Listening',
    [
      'Listen and Choose a Response',
      'Listen to a Conversation',
      'Listen to an Announcement',
      'Listen to an Academic Talk'
    ]
  ],
  ['Writing', ['Build a Sentence', 'Write an Email', 'Write for an Academic Discussion']],
  ['Speaking', ['Listen and Repeat', 'Take an Interview']]
];

export const cefrRows = [
  ['C2', '6'],
  ['C1', '5–5.5'],
  ['B2', '4–4.5'],
  ['B1', '3–3.5'],
  ['A2', '2–2.5'],
  ['A1', '1–1.5']
];

export const scoreConversionRows = [
  ['6', '29–30', '28–30', '29–30', '28–30', '114–120'],
  ['5.5', '26–28', '26–27', '27–28', '27', '106–113'],
  ['5', '24–25', '22–25', '24–26', '25–26', '95–105'],
  ['4.5', '21–23', '19–21', '23', '23–24', '86–94'],
  ['4', '18–20', '17–18', '17–22', '20–22', '72–85'],
  ['3.5', '12–17', '13–16', '15–16', '18–19', '58–71'],
  ['3', '6–11', '9–12', '13–14', '16–17', '44–57'],
  ['2.5', '4–5', '6–8', '11–12', '14–15', '35–43'],
  ['2', '3', '4–5', '7–10', '10–13', '24–34'],
  ['1.5', '2', '2–3', '3–6', '5–9', '12–23'],
  ['1', '1–1.5', '0–1', '0–2', '0–4', '0–11']
];

export const changelog = [
  [
    'V1.4.1',
    '2026-07-17',
    'Refreshes Typing and Vocabulary practice with a cleaner design and clearer navigation. ' +
      'Also improves English wording and fixes issues when restarting Typing practice or navigating Vocabulary sessions.'
  ],
  [
    'V1.4.0',
    '2026-07-15',
    'Improves performance, local data reliability, and overall stability. Exam, Typing, and Vocabulary practice are smoother, with fixes for Reading layouts, answer matching, and TPO numbering.'
  ],
  [
    'V1.3.2',
    '2026-07-06',
    'Improves Reading answer matching and insertion questions, restores missing TPO 06 Module 2 content, and corrects question-set titles.'
  ],
  [
    'V1.3.1',
    '2026-07-06',
    'Fixes audio segment timing for Listen and Choose a Response questions in TPO 01–04.'
  ],
  [
    'V1.3.0',
    '2026-07-03',
    'Adds Vocabulary practice for all four sections, with four study modes, spaced repetition, word-part groups, daily reminders, and focused review sessions. Also improves word details, spelling input, and app packaging.'
  ],
  [
    'V1.2.6',
    '2026-06-29',
    'Adds TPO 05–09, including five Reading and Writing sets and three complete four-section tests. Also adds Advertisement questions and improves per-question audio support.'
  ],
  [
    'V1.2.5',
    '2026-06-24',
    'Aligns version information and completes the release history for V1.2.1–V1.2.5.'
  ],
  ['V1.2.4', '2026-06-24', 'Removes obsolete release files and aligns version information.'],
  ['V1.2.3', '2026-06-24', 'Fixes Typing passages not loading in the packaged desktop app.'],
  [
    'V1.2.2',
    '2026-06-24',
    'Adds 15 TOEFL-style Typing passages across three difficulty levels and restores Writing and Speaking content for TPO 02–04.'
  ],
  [
    'V1.2.1',
    '2026-06-24',
    'Adds Typing practice with three difficulty levels, timers, pause and retry controls, detailed results, and progress history. Also adds TPO 04, fixes section timers, improves desktop development support, and checks for updates automatically.'
  ],
  [
    'V1.1.7',
    '2026-06-21',
    'Adds macOS builds and improves automatic updates on Windows and macOS. Also restores missing exam content and images in packaged releases.'
  ],
  [
    'V1.1.6',
    '2026-06-20',
    'Fixes blank score reports in packaged builds and incorrect elapsed time on Writing result pages.'
  ],
  [
    'V1.1.5',
    '2026-06-18',
    'Confirms the full automatic update flow, from detection through installation.'
  ],
  [
    'V1.1.4',
    '2026-06-18',
    'Restores missing update actions and improves automatic update reliability.'
  ],
  [
    'V1.1.3',
    '2026-06-18',
    'Completes automatic updates for both the app and exam content, with visible download and installation progress.'
  ],
  [
    'V1.1.2',
    '2026-06-18',
    'Fixes app update checks in packaged builds and improves update reliability.'
  ],
  [
    'V1.1.1',
    '2026-06-18',
    'Unifies app and content updates, avoids duplicate content downloads, and improves image loading.'
  ],
  [
    'V1.1.0',
    '2026-06-18',
    'Fixes answer isolation, Speaking recordings and permissions, resume behavior, Listening help, and perfect-score results. Also improves session cleanup and microphone setup.'
  ],
  [
    'V1.0.0',
    '2026-06',
    'First stable release with complete TOEFL practice for Reading, Listening, Writing, and Speaking, including timers, autosave, score reports, and answer review.'
  ],
  [
    'V0.0 (Beta)',
    '2026-05',
    'Initial beta release with complete four-section TOEFL practice. This early version established the core exam experience and will continue to improve with user feedback.'
  ]
];
