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

const TEMPLATE_DIR = path.join(__dirname, 'templates', 'Speaking');

// Auto-discover all TPO directories
const questionsDir = path.join(__dirname, 'assets', 'questions', 'speaking');
let tpoNumbers;
if (tpoMode === 'all') {
  const entries = fs.readdirSync(questionsDir, { withFileTypes: true });
  tpoNumbers = [];
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('TPO-')) {
      const num = entry.name.slice(4);
      if (/^\d+$/.test(num)) tpoNumbers.push(num);
    }
  }
  tpoNumbers.sort((a, b) => parseInt(a) - parseInt(b));
  console.log('Discovered ' + tpoNumbers.length + ' Speaking TPO(s): ' + tpoNumbers.map(function (n) { return 'TPO ' + n; }).join(', '));
} else {
  tpoNumbers = [tpoNumber];
}

for (var _tIdx = 0; _tIdx < tpoNumbers.length; _tIdx++) {
var _tpo = tpoNumbers[_tIdx];

var OUTPUT_DIR = path.join(__dirname, 'tpo', _tpo, 'speaking');
var MARKDOWN_PATH = path.join(
  __dirname, 'assets', 'questions', 'speaking',
  'TPO-' + _tpo.padStart(2, '0'),
  'speaking-TPO-' + _tpo.padStart(2, '0') + '.md'
);
var ASSETS_BASE = '../../../assets/questions/speaking/TPO-' + _tpo.padStart(2, '0') + '/';
var STORAGE_PREFIX = 'toefl_tpo' + _tpo + '_';

const TOTAL_SPEAKING_QUESTIONS = 11;

// Read templates
const tplLRScenario = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'listen-repeat-scenario', 'template.html'), 'utf8'
);
const tplLRExercise = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'listen-repeat-exercise', 'template.html'), 'utf8'
);
const tplInterviewScenario = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'take-interview-scenario', 'template.html'), 'utf8'
);
const tplInterviewExercise = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'take-interview-exercise', 'template.html'), 'utf8'
);
const tplResults = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'General', 'results-template.html'), 'utf8'
);

let mdRaw;
try {
  mdRaw = fs.readFileSync(MARKDOWN_PATH, 'utf8');
} catch (e) {
  console.error(`Markdown file not found: ${MARKDOWN_PATH}`);
  console.error('Please create the question bank file first.');
  process.exit(1);
}

const lines = mdRaw.split('\n');

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function timeToSeconds(t) {
  const parts = t.trim().split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function fmtLRPageName(qNum) {
  return `speaking_lr_${String(qNum).padStart(2, '0')}.html`;
}

function fmtInterviewPageName(qNum) {
  return `speaking_interview_${String(qNum).padStart(2, '0')}.html`;
}

function fillTemplate(tpl, vars) {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split('{{' + k + '}}').join(String(v));
  }
  return out;
}

function createTask() {
  return {
    scenarioTitle: '',
    scenarioImage: '',
    audio: '',
    questions: []
  };
}

function parseQuestions(task, startIdx) {
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();

    // Stop at next section header
    if (line.startsWith('### ') || line.startsWith('## ')) break;

    if (!line || line.startsWith('# ') || line === '---') continue;

    if (line.startsWith('scenario_title:')) {
      task.scenarioTitle = line.replace('scenario_title:', '').trim();
      continue;
    }
    if (line.startsWith('scenario_image:')) {
      task.scenarioImage = ASSETS_BASE + line.replace('scenario_image:', '').trim();
      continue;
    }
    if (line.startsWith('audio:')) {
      const audioVal = line.replace('audio:', '').trim();
      if (task.questions.length > 0) {
        task.questions[task.questions.length - 1].audio = audioVal;
      } else {
        task.audio = audioVal;
      }
      continue;
    }
    if (line.startsWith('image:')) {
      task.questions[task.questions.length - 1].image =
        ASSETS_BASE + line.replace('image:', '').trim();
      continue;
    }
    if (line.startsWith('transcript:')) {
      task.questions[task.questions.length - 1].transcript =
        line.replace('transcript:', '').trim();
      continue;
    }
    if (line.startsWith('response_time:')) {
      task.questions[task.questions.length - 1].responseTime =
        parseInt(line.replace('response_time:', '').trim());
      continue;
    }
    const playMatch = line.match(/^>>\s*play:\s*(\d+:\d+)\s*-\s*(\d+:\d+)/);
    if (playMatch && task.questions.length > 0) {
      const lastQ = task.questions[task.questions.length - 1];
      lastQ.audioStart = timeToSeconds(playMatch[1]);
      lastQ.audioEnd = timeToSeconds(playMatch[2]);
      continue;
    }
    const qMatch = line.match(/^(\d+)\.?\s*$/);
    if (qMatch) {
      task.questions.push({
        number: parseInt(qMatch[1]),
        image: '',
        audioStart: 0,
        audioEnd: 0,
        transcript: '',
        responseTime: 0
      });
      continue;
    }
  }
}

// ---- Parse markdown ----
const lrTask = createTask();
const interviewTask = createTask();

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line === '### Listen and Repeat') {
    parseQuestions(lrTask, i + 1);
  }
  if (line === '### Take an Interview') {
    parseQuestions(interviewTask, i + 1);
  }
}

if (lrTask.questions.length === 0) {
  console.error('No Listen and Repeat questions found in markdown.');
  process.exit(1);
}

console.log(`Parsed Listen and Repeat: ${lrTask.questions.length} questions`);
console.log(`  Scenario: "${lrTask.scenarioTitle}"`);
console.log(`  Audio: ${lrTask.audio}`);
if (interviewTask.questions.length > 0) {
  console.log(`Parsed Take an Interview: ${interviewTask.questions.length} questions`);
  console.log(`  Scenario: "${interviewTask.scenarioTitle}"`);
  console.log(`  Audio: ${interviewTask.audio}`);
}

// ---- Set default response times ----
lrTask.questions.forEach((q, idx) => {
  if (!q.responseTime || q.responseTime <= 0) {
    if (idx < 2) q.responseTime = 8;
    else if (idx < 5) q.responseTime = 10;
    else q.responseTime = 12;
  }
});

interviewTask.questions.forEach((q) => {
  if (!q.responseTime || q.responseTime <= 0) {
    q.responseTime = 45;
  }
});

// ---- Generate pages ----
const allPages = [];

// Listen and Repeat: scenario + exercise pages
const lrAudioBase = lrTask.audio ? ASSETS_BASE + lrTask.audio : '';

const lrScenarioVars = {
  SCENARIO_TITLE: escapeHtml(lrTask.scenarioTitle),
  SCENARIO_IMAGE: lrTask.scenarioImage,
  NEXT_PAGE: fmtLRPageName(1)
};
allPages.push({ fname: 'speaking_lr_scenario.html', html: fillTemplate(tplLRScenario, lrScenarioVars) });

lrTask.questions.forEach((q, idx) => {
  const qNum = idx + 1;
  const responseTimeDisplay = String(q.responseTime).padStart(2, '0');
  const nextPage = idx < lrTask.questions.length - 1
    ? fmtLRPageName(qNum + 1)
    : (interviewTask.questions.length > 0 ? 'take-interview-intro.html' : 'speaking_results.html');

  const qAudioSrc = q.audio ? ASSETS_BASE + q.audio : lrAudioBase;
  const vars = {
    QUESTION_NUMBER: q.number,
    TOTAL_QUESTIONS: TOTAL_SPEAKING_QUESTIONS,
    QUESTION_IMAGE: q.image,
    AUDIO_FILE: qAudioSrc,
    AUDIO_START: q.audio ? 0 : (q.audioStart || 0),
    AUDIO_END: q.audio ? 999 : (q.audioEnd || 999),
    RESPONSE_TIME: q.responseTime,
    RESPONSE_TIME_DISPLAY: responseTimeDisplay,
    TRANSCRIPT: escapeHtml(q.transcript || ''),
    BACK_PAGE: idx === 0 ? 'speaking_lr_scenario.html' : fmtLRPageName(idx),
    BACK_BTN_STYLE: idx === 0 ? 'display:none' : '',
    NEXT_PAGE: nextPage
  };
  allPages.push({ fname: fmtLRPageName(qNum), html: fillTemplate(tplLRExercise, vars) });
});

// Take an Interview: intro + scenario + exercise pages
if (interviewTask.questions.length > 0) {
  const interviewAudioBase = interviewTask.audio ? ASSETS_BASE + interviewTask.audio : '';

  // Interview Intro
  let interviewIntroTpl = fs.readFileSync(
    path.join(TEMPLATE_DIR, 'General', 'take-interview-intro-template.html'), 'utf8'
  );
  interviewIntroTpl = interviewIntroTpl.replace(
    /{{FIRST_QUESTION_PAGE}}/g, 'speaking_interview_scenario.html'
  );
  interviewIntroTpl = interviewIntroTpl.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);
  allPages.push({ fname: 'take-interview-intro.html', html: interviewIntroTpl, isIntro: true });

  // Interview Scenario
  const intScenarioVars = {
    SCENARIO_TITLE: escapeHtml(interviewTask.scenarioTitle),
    SCENARIO_IMAGE: interviewTask.scenarioImage,
    NEXT_PAGE: fmtInterviewPageName(8)
  };
  allPages.push({
    fname: 'speaking_interview_scenario.html',
    html: fillTemplate(tplInterviewScenario, intScenarioVars)
  });

  // Interview Exercise pages (Q8-Q11)
  interviewTask.questions.forEach((q, idx) => {
    const qDisplayNum = 8 + idx;
    const responseTimeDisplay = String(q.responseTime).padStart(2, '0');
    const nextPage = idx < interviewTask.questions.length - 1
      ? fmtInterviewPageName(qDisplayNum + 1)
      : 'speaking_results.html';

    const qAudioSrc = q.audio ? ASSETS_BASE + q.audio : interviewAudioBase;
    const vars = {
      QUESTION_NUMBER: qDisplayNum,
      TOTAL_QUESTIONS: TOTAL_SPEAKING_QUESTIONS,
      QUESTION_IMAGE: q.image,
      AUDIO_FILE: qAudioSrc,
      AUDIO_START: q.audio ? 0 : (q.audioStart || 0),
      AUDIO_END: q.audio ? 999 : (q.audioEnd || 999),
      RESPONSE_TIME: q.responseTime,
      RESPONSE_TIME_DISPLAY: responseTimeDisplay,
      TRANSCRIPT: escapeHtml(q.transcript || ''),
      BACK_PAGE: idx === 0 ? 'speaking_interview_scenario.html' : fmtInterviewPageName(qDisplayNum - 1),
      BACK_BTN_STYLE: idx === 0 ? 'display:none' : '',
      NEXT_PAGE: nextPage
    };
    allPages.push({
      fname: fmtInterviewPageName(qDisplayNum),
      html: fillTemplate(tplInterviewExercise, vars)
    });
  });
}

// ---- Write all pages ----
allPages.forEach(p => {
  let html = p.html;
  if (p.isIntro) {
    // Already handled storage prefix in intro generation
  } else if (!html.includes(STORAGE_PREFIX)) {
    html = html.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);
  }
  const filePath = path.join(OUTPUT_DIR, p.fname);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  ${p.fname}`);
});

// ---- Generate Start page ----
let startTpl = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'General', 'start-template.html'), 'utf8'
);
startTpl = startTpl.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);
fs.writeFileSync(path.join(OUTPUT_DIR, 'start.html'), startTpl, 'utf8');
console.log('  start.html');

// ---- Generate Listen and Repeat Intro page ----
let lrIntroTpl = fs.readFileSync(
  path.join(TEMPLATE_DIR, 'General', 'listen-repeat-intro-template.html'), 'utf8'
);
lrIntroTpl = lrIntroTpl.replace(/{{FIRST_QUESTION_PAGE}}/g, 'speaking_lr_scenario.html');
lrIntroTpl = lrIntroTpl.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);
fs.writeFileSync(path.join(OUTPUT_DIR, 'listen-repeat-intro.html'), lrIntroTpl, 'utf8');
console.log('  listen-repeat-intro.html');

// ---- Generate Results page ----
const lrQuestionsForResults = lrTask.questions.map(q => ({
  number: q.number,
  transcript: q.transcript || '',
  audioFile: q.audio ? (ASSETS_BASE + q.audio) : '',
  audioStart: q.audioStart || 0,
  audioEnd: q.audioEnd || 999
}));

const interviewQuestionsForResults = interviewTask.questions.map((q, idx) => ({
  number: 8 + idx,
  transcript: q.transcript || '',
  audioFile: q.audio ? (ASSETS_BASE + q.audio) : '',
  audioStart: q.audioStart || 0,
  audioEnd: q.audioEnd || 999
}));

const resultsVars = {
  STORAGE_PREFIX: STORAGE_PREFIX,
  AUDIO_LR: ASSETS_BASE + lrTask.audio,
  AUDIO_INTERVIEW: (interviewTask.audio
    ? ASSETS_BASE + interviewTask.audio
    : ''),
  LR_QUESTIONS_JSON: JSON.stringify(lrQuestionsForResults),
  INTERVIEW_QUESTIONS_JSON: JSON.stringify(interviewQuestionsForResults)
};

let resultsHtml = fillTemplate(tplResults, resultsVars);
resultsHtml = resultsHtml.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);
fs.writeFileSync(path.join(OUTPUT_DIR, 'speaking_results.html'), resultsHtml, 'utf8');
console.log('  speaking_results.html');

// ---- Inject start time tracking into first LR question page ----
const firstQIdx = allPages.findIndex(p => p.fname === 'speaking_lr_01.html');
if (firstQIdx >= 0) {
  const startTimeKey = STORAGE_PREFIX + 'speaking_start_time';
  const injectScript = '<script>(function(){var k="' + startTimeKey + '";if(!localStorage.getItem(k))localStorage.setItem(k,Date.now());})();<\/script>';
  allPages[firstQIdx].html = allPages[firstQIdx].html.replace('</head>', injectScript + '\n</head>');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'speaking_lr_01.html'),
    allPages[firstQIdx].html.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX), 'utf8');
}

var totalFiles = allPages.length + 3;
console.log('\nDone! ' + totalFiles + ' files generated in ' + OUTPUT_DIR);

}
