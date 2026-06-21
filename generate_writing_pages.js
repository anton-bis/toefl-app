import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CLI argument parsing =====
const args = process.argv.slice(2);
let tpoNumber = '01';
let tpoMode = 'all';

for (const arg of args) {
  if (arg.startsWith('--tpo=')) {
    tpoNumber = arg.replace('--tpo=', '').trim();
  }
}

const TEMPLATE_DIR = path.join(__dirname, 'templates', 'Writing');
const OUTPUT_DIR = path.join(__dirname, 'tpo', tpoNumber, 'writing');
const MARKDOWN_PATH = path.join(
  __dirname,
  'assets', 'questions', 'writing', `TPO-${tpoNumber.padStart(2, '0')}`,
  `writing-TPO-${tpoNumber.padStart(2, '0')}.md`
);
const STORAGE_PREFIX = `toefl_tpo${tpoNumber}_`;

// ===== Read templates =====
const bsTpl = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'build-sentence', 'template.html'), 'utf8'
);
const startTpl = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'General', 'start-template.html'), 'utf8'
);
const bsIntroTpl = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'General', 'build-sentence-intro-template.html'), 'utf8'
);
const emailTpl = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'write-email', 'template.html'), 'utf8'
);
const discTpl = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'academic-discussion', 'template.html'), 'utf8'
);
const emailIntroTpl = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'General', 'email-intro-template.html'), 'utf8'
);
const discIntroTpl = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'General', 'academic-discussion-intro-template.html'), 'utf8'
);
const resultsTpl = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'General', 'results-template.html'), 'utf8'
);

// ===== Read markdown =====
const md = fs.readFileSync(MARKDOWN_PATH, 'utf8');
const lines = md.split('\n');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ===== Utility functions =====
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fillTemplate(tpl, vars) {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split('{{' + k + '}}').join(String(v));
  }
  return out;
}

// ===== Stage 1: Parse markdown =====
let mode = null; // 'bs' | 'email' | 'discussion'
const bsQuestions = [];
let emailQuestion = null;
const discQuestions = [];
let currentQ = null;
let inAnswer = false;
let answerLines = [];

function parseBSLine(trimmed) {
  // Already inside BS section, only stop on section boundary
  if (trimmed.startsWith('## ')) return false;

  if (trimmed.startsWith('### Build a Sentence')) {
    if (currentQ) {
      if (answerLines.length > 0) {
        currentQ.answer = answerLines.join(' ').replace(/\\\./g, '.').trim();
      }
      bsQuestions.push(currentQ);
      answerLines = [];
    }
    currentQ = { speakerA: '', speakerB: '', candidates: [], answer: '' };
    return true;
  }

  if (!currentQ) return true;

  if (trimmed === '\\[ANSWER\\]') { inAnswer = true; answerLines = []; return true; }
  if (trimmed === '\\[/ANSWER\\]') { inAnswer = false; return true; }
  if (inAnswer) { answerLines.push(trimmed); return true; }

  if (trimmed.startsWith('Speaker A:')) {
    currentQ.speakerA = trimmed.replace(/^Speaker A:\s*/, '').replace(/\\\./g, '.').trim();
    return true;
  }

  if (trimmed.startsWith('Speaker B:')) {
    currentQ.speakerB = trimmed.replace(/^Speaker B:\s*/, '').replace(/\\\./g, '.').trim();
    return true;
  }

  if (trimmed.startsWith('Candidates:')) {
    const candStr = trimmed.replace(/^Candidates:\s*/, '');
    currentQ.candidates = candStr
      .split('/')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    return true;
  }

  return true;
}

function parseEmailLine(trimmed) {
  if (trimmed.startsWith('## ')) { mode = null; return false; }

  if (trimmed.startsWith('### Write an Email')) {
    if (emailQuestion) {
      // already have one, ignore extras for now
      return true;
    }
    emailQuestion = { identity: '', to: '', subject: '', requirements: [] };
    return true;
  }

  if (!emailQuestion) return true;

  if (trimmed.startsWith('Identity:')) {
    emailQuestion.identity = trimmed.replace(/^Identity:\s*/, '').trim();
    return true;
  }
  if (trimmed.startsWith('To:')) {
    emailQuestion.to = trimmed.replace(/^To:\s*/, '').trim();
    return true;
  }
  if (trimmed.startsWith('Subject:')) {
    emailQuestion.subject = trimmed.replace(/^Subject:\s*/, '').trim();
    return true;
  }
  if (trimmed === 'Requirements:') return true;
  if (trimmed.startsWith('- ')) {
    emailQuestion.requirements.push(trimmed.replace(/^-\s*/, '').trim());
    return true;
  }

  return true;
}

function parseDiscussionLine(trimmed) {
  if (trimmed.startsWith('## ')) { mode = null; return false; }

  if (trimmed.startsWith('### Write for an Academic Discussion')) {
    if (discQuestions.length > 0) return true;
    discQuestions.push({ subject: '', instructor: '', professor: '', students: [], requirements: [], hint: '' });
    return true;
  }

  const dq = discQuestions[discQuestions.length - 1];
  if (!dq) return true;

  if (trimmed.startsWith('Subject:')) {
    dq.subject = trimmed.replace(/^Subject:\s*/, '').trim();
    return true;
  }
  if (trimmed.startsWith('Instructor:')) {
    dq.instructor = trimmed.replace(/^Instructor:\s*/, '').trim();
    return true;
  }
  if (trimmed.startsWith('Professor:')) {
    dq.professor = trimmed.replace(/^Professor:\s*/, '').trim();
    return true;
  }
  if (trimmed === 'Requirements:') return true;
  if (trimmed.startsWith('- ')) {
    dq.requirements.push(trimmed.replace(/^-\s*/, '').trim());
    return true;
  }
  if (trimmed.startsWith('Hint:')) {
    dq.hint = trimmed.replace(/^Hint:\s*/, '').trim();
    return true;
  }
  // Student perspectives: Name: Text
  if (/^[A-Z][a-z]+:/.test(trimmed)) {
    const idx = trimmed.indexOf(':');
    dq.students.push({
      name: trimmed.substring(0, idx).trim(),
      text: trimmed.substring(idx + 1).trim()
    });
    return true;
  }

  return true;
}

function switchMode(trimmed) {
  if (trimmed === '## Build a Sentence') { mode = 'bs'; return true; }
  if (trimmed === '## Write an Email') { mode = 'email'; return true; }
  if (trimmed === '## Write for an Academic Discussion') { mode = 'discussion'; return true; }
  return false;
}

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('# writing') || trimmed === '---') continue;

  if (switchMode(trimmed)) continue;

  let consumed = false;
  if (mode === 'bs') consumed = parseBSLine(trimmed);
  else if (mode === 'email') consumed = parseEmailLine(trimmed);
  else if (mode === 'discussion') consumed = parseDiscussionLine(trimmed);

  // If the line is a new section start but was caught by sub-parser, let it fall through
  if (!consumed && trimmed.startsWith('## ')) {
    switchMode(trimmed);
  }
}

// Finalize last BS question
if (currentQ) {
  if (answerLines.length > 0) {
    currentQ.answer = answerLines.join(' ').replace(/\\\./g, '.').trim();
  }
  bsQuestions.push(currentQ);
}

console.log(`Stage 1: Parsed ${bsQuestions.length} BS, ${emailQuestion ? 1 : 0} Email, ${discQuestions.length} Discussion questions\n`);

// ===== Stage 2: Generate BS slots + answerOrder =====
function generateSlotsAndAnswers(q) {
  const segments = q.speakerB.split('____');
  const slots = [];

  segments.forEach((seg, i) => {
    const cleaned = seg.replace(/\\\./g, '.');
    if (i > 0) {
      slots.push({ type: 'blank', answer: '' });
    }
    if (cleaned.trim()) {
      slots.push({ type: 'text', value: cleaned });
    }
  });

  const preText = segments[0].replace(/\\\./g, '.').trim();
  const postText = segments[segments.length - 1].replace(/\\\./g, '.').trim();

  let remaining = q.answer;

  if (preText && remaining.toLowerCase().startsWith(preText.toLowerCase())) {
    remaining = remaining.substring(preText.length).trim();
  }

  if (postText && remaining.toLowerCase().endsWith(postText.toLowerCase())) {
    remaining = remaining.substring(0, remaining.length - postText.length).trim();
  }

  if (remaining.endsWith('.')) {
    remaining = remaining.substring(0, remaining.length - 1).trim();
  }

  const answerWords = [];
  const candidates = [...q.candidates];

  while (remaining.length > 0) {
    remaining = remaining.trim();
    let matched = null;

    for (const cand of candidates) {
      const regex = new RegExp('^' + escapeRegex(cand) + '\\b', 'i');
      if (regex.test(remaining)) {
        matched = cand;
        break;
      }
    }

    if (matched) {
      answerWords.push(matched);
      remaining = remaining.substring(matched.length);
    } else {
      const spaceIdx = remaining.indexOf(' ');
      if (spaceIdx === -1) break;
      remaining = remaining.substring(spaceIdx + 1);
    }
  }

  const blankSlots = slots.filter(s => s.type === 'blank');
  blankSlots.forEach((s, i) => {
    s.answer = answerWords[i] || '';
  });

  q.slots = slots;
  q.answerOrder = answerWords;
  q.blankCount = blankSlots.length;
}

bsQuestions.forEach(q => generateSlotsAndAnswers(q));

// Debug
bsQuestions.forEach((q, i) => {
  console.log(`  BS Q${i + 1}: ${q.blankCount} blanks → ${q.answerOrder.join(' | ')}`);
});
if (emailQuestion) {
  console.log(`  Email: to=${emailQuestion.to}, subj=${emailQuestion.subject}, reqs=${emailQuestion.requirements.length}`);
}
if (discQuestions.length > 0) {
  console.log(`  Discussion: ${discQuestions[0].students.length} students, ${discQuestions[0].requirements.length} reqs`);
}

// ===== Stage 3: Generate BS question pages =====
const bsTotal = bsQuestions.length;

for (let i = 0; i < bsTotal; i++) {
  const q = bsQuestions[i];
  const num = i + 1;
  const isFirst = (num === 1);
  const isLast = (num === bsTotal);

  const backBtnHtml = isFirst
    ? ''
    : '<button class="nav-button dark" id="back-btn"><span>Back</span><i class="fas fa-arrow-left"></i></button>';

  const prevPage = isFirst
    ? 'null'
    : '"build-sentence-' + String(num - 1).padStart(2, '0') + '.html"';

  // Last BS question → email intro (if email exists)
  const nextPage = isLast
    ? (emailQuestion ? 'email-intro.html' : 'start.html')
    : 'build-sentence-' + String(num + 1).padStart(2, '0') + '.html';

  const emailIntroPage = emailQuestion ? 'email-intro.html' : 'start.html';

  const vars = {
    QUESTION_TITLE_SUFFIX: 'Q' + num,
    QUESTION_NUMBER: String(num),
    TOTAL_QUESTIONS: String(bsTotal),
    BACK_BUTTON_HTML: backBtnHtml,
    SPEAKER_A_TEXT: q.speakerA,
    SLOTS_JSON: JSON.stringify(q.slots),
    CANDIDATES_JSON: JSON.stringify(q.candidates),
    ANSWER_ORDER_JSON: JSON.stringify(q.answerOrder),
    BLANK_COUNT: String(q.blankCount),
    NEXT_PAGE: nextPage,
    PREV_PAGE: prevPage,
    EMAIL_INTRO_PAGE: emailIntroPage,
    RESUME_PAGE_KEY: 'toefl_tpo' + tpoNumber + '_writing_resume_page',
    CSP_NONCE: ''
  };

  const html = fillTemplate(bsTpl, vars);
  const fname = 'build-sentence-' + String(num).padStart(2, '0') + '.html';
  fs.writeFileSync(path.join(OUTPUT_DIR, fname), html, 'utf8');
  console.log(`  ${fname}`);
}

// Inject start_time tracker into first BS page (other modules inject on first question page)
const startTimeKey = STORAGE_PREFIX + 'writing_start_time';
const firstQPath = path.join(OUTPUT_DIR, 'build-sentence-01.html');
if (fs.existsSync(firstQPath)) {
  let firstQHtml = fs.readFileSync(firstQPath, 'utf8');
  const injectScript = '<script>(function(){var k="' + startTimeKey + '";if(!localStorage.getItem(k))localStorage.setItem(k,Date.now());})();<\/script>';
  firstQHtml = firstQHtml.replace('</head>', injectScript + '</head>');
  fs.writeFileSync(firstQPath, firstQHtml, 'utf8');
}

// ===== Stage 4: Generate Email pages =====
if (emailQuestion) {
  const eq = emailQuestion;

  // email-intro.html
  let emailIntroHtml = emailIntroTpl.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);
  emailIntroHtml = emailIntroHtml.replace(
    /email-questions\.html/g,
    'email-questions.html'
  );
  fs.writeFileSync(path.join(OUTPUT_DIR, 'email-intro.html'), emailIntroHtml, 'utf8');
  console.log('  email-intro.html');

  // email-questions.html
  const requirementsHtml = eq.requirements
    .map(r => '<li>' + r.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</li>')
    .join('');

  const emailVars = {
    IDENTITY_INFO: eq.identity,
    TO_NAME: eq.to,
    REQUIREMENTS: requirementsHtml,
    SUBJECT_TEXT: eq.subject,
    QUESTION_NUMBER: '1',
    TOTAL_QUESTIONS: '2',
    TIMER_SECONDS: '420',
    NEXT_PAGE: 'discussion-intro.html',
    PREV_PAGE: 'email-intro.html',
    RESUME_PAGE_KEY: 'toefl_tpo' + tpoNumber + '_writing_resume_page',
    CSP_NONCE: ''
  };

  const emailHtml = fillTemplate(emailTpl, emailVars);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'email-questions.html'), emailHtml, 'utf8');
  console.log('  email-questions.html');
}

// ===== Stage 5: Generate Discussion pages =====
if (discQuestions.length > 0) {
  // discussion-intro.html
  let discIntroHtml = discIntroTpl.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);
  discIntroHtml = discIntroHtml.replace(
    /discussion-questions\.html/g,
    'discussion-questions.html'
  );
  fs.writeFileSync(path.join(OUTPUT_DIR, 'discussion-intro.html'), discIntroHtml, 'utf8');
  console.log('  discussion-intro.html');

  // discussion-questions.html
  const dq = discQuestions[0];
  const s1 = dq.students[0] || { name: '', text: '' };
  const s2 = dq.students[1] || { name: '', text: '' };

  const discVars = {
    SUBJECT: dq.subject || '',
    PROFESSOR_NAME: dq.instructor || '',
    PROFESSOR_CONTENT: dq.professor || '',
    STUDENT1_NAME: s1.name,
    STUDENT1_TEXT: s1.text,
    STUDENT2_NAME: s2.name,
    STUDENT2_TEXT: s2.text,
    QUESTION_NUMBER: '2',
    TOTAL_QUESTIONS: '2',
    TIMER_SECONDS: '600',
    NEXT_PAGE: 'writing_results.html',
    PREV_PAGE: 'discussion-intro.html',
    RESUME_PAGE_KEY: 'toefl_tpo' + tpoNumber + '_writing_resume_page',
    CSP_NONCE: ''
  };

  const discHtml = fillTemplate(discTpl, discVars);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'discussion-questions.html'), discHtml, 'utf8');
  console.log('  discussion-questions.html');
}

// ===== Stage 6: Auxiliary pages =====

// start.html
let startHtml = startTpl.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);
fs.writeFileSync(path.join(OUTPUT_DIR, 'start.html'), startHtml, 'utf8');
console.log('  start.html');

// build-sentence-intro.html
let bsIntroHtml = bsIntroTpl.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);
bsIntroHtml = bsIntroHtml.replace(
  /build-sentence-questions\.html/g,
  'build-sentence-01.html'
);
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'build-sentence-intro.html'),
  bsIntroHtml,
  'utf8'
);
console.log('  build-sentence-intro.html');

// ===== Stage 7: Generate results page =====
const bsQuestionsData = bsQuestions.map((q, i) => ({
  questionNumber: String(i + 1),
  speakerA: q.speakerA || '',
  speakerB: q.speakerB || '',
  slots: q.slots || [],
  candidates: q.candidates || [],
  answerOrder: q.answerOrder || [],
  blankCount: q.blankCount || 0,
  taskTitle: ('Build a Sentence ' + (i + 1))
}));

const resultsVars = {
  TOTAL_QUESTIONS: String(bsTotal),
  BS_QUESTIONS_JSON: JSON.stringify(bsQuestionsData),
  STORAGE_PREFIX: STORAGE_PREFIX
};
const resultsHtml = fillTemplate(resultsTpl, resultsVars);
fs.writeFileSync(path.join(OUTPUT_DIR, 'writing_results.html'), resultsHtml, 'utf8');
console.log('  writing_results.html');

// ===== Done =====
const totalPages = bsTotal + (emailQuestion ? 2 : 0) + (discQuestions.length > 0 ? 2 : 0) + 3;
console.log(`\nDone! ${totalPages} pages generated in ${OUTPUT_DIR}`);
