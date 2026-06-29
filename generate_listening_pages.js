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
    if (tpoNumber === 'all') {
      tpoMode = 'all';
    } else {
      tpoMode = 'specific';
    }
  }
}

// ===== Discover listening TPOs from assets/questions/listening/ =====
const listeningBase = path.join(__dirname, 'assets/questions/listening');
const allTpoNums = [];
if (tpoMode === 'all') {
  if (fs.existsSync(listeningBase)) {
    const entries = fs.readdirSync(listeningBase, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const match = entry.name.match(/^TPO-(\d+)$/i);
        if (match) allTpoNums.push(match[1]);
      }
    }
  }
  allTpoNums.sort((a, b) => parseInt(a) - parseInt(b));
  if (allTpoNums.length === 0) {
    console.error('未找到听力题库文件！');
    process.exit(1);
  }
  console.log('可用的听力题库:', allTpoNums.map(n => `TPO ${n}`).join(', '));
}

const TEMPLATE_DIR = path.join(__dirname, 'templates', 'Listening');

// Read templates
const tplA = fs.readFileSync(path.join(TEMPLATE_DIR, 'listen-choose-response', 'template.html'), 'utf8');
const tplB = fs.readFileSync(path.join(TEMPLATE_DIR, 'listen-audio-play', 'template.html'), 'utf8');
const tplC = fs.readFileSync(path.join(TEMPLATE_DIR, 'listen-question', 'template.html'), 'utf8');

function generateListeningTPO(tpoNumber) {
  const OUTPUT_DIR = path.join(__dirname, 'tpo', tpoNumber, 'listening');
  const MARKDOWN_PATH = path.join(__dirname, 'assets', 'questions', 'listening', `TPO-${tpoNumber.padStart(2, '0')}`, `listening-TPO-${tpoNumber.padStart(2, '0')}.md`);
  const AUDIO_BASE = `../../../assets/questions/listening/TPO-${tpoNumber.padStart(2, '0')}/`;
  const STORAGE_PREFIX = `toefl_tpo${tpoNumber}_`;

  if (!fs.existsSync(MARKDOWN_PATH)) {
    console.error(`  未找到 TPO ${tpoNumber} 的听力题库文件，跳过`);
    return;
  }

  const md = fs.readFileSync(MARKDOWN_PATH, 'utf8');
  const lines = md.split('\n');

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function timeToSeconds(t) {
  const parts = t.trim().split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function fmtPageName(moduleNum, taskSlug, subType, localQ) {
  const m = 'm' + moduleNum;
  if (subType === 'play') return `listening_${m}_${taskSlug}_play.html`;
  return `listening_${m}_${taskSlug}_${String(localQ).padStart(2, '0')}.html`;
}

function detectTaskType(title) {
  const t = title.toLowerCase();
  if (t.includes('listen and choose a response')) return 'lcar';
  if (t.includes('listen to a conversation')) return 'conversation';
  if (t.includes('listen to an announcement')) return 'announcement';
  if (t.includes('listen to a talk') || t.includes('listen to an academic talk')) return 'talk';
  return 'unknown';
}

function fillTemplate(tpl, vars) {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split('{{' + k + '}}').join(String(v));
  }
  return out;
}

// ---- Parse markdown ----

let currentModule = null;
let currentTask = null;
const tasks = [];
let i = 0;

function startTask(taskTitle, lineIdx) {
  if (currentTask) tasks.push(currentTask);
  const type = detectTaskType(taskTitle);
  // Extract question range: e.g., "Listen and Choose a Response – Questions 1-8"
  const rangeMatch = taskTitle.match(/Questions?\s+(\d+)[–-](\d+)/i);
  currentTask = {
    title: taskTitle.trim(),
    type,
    module: currentModule,
    audio: '',
    audioStart: 0,
    audioEnd: 999,
    dialogueLines: [],   // Woman:/Man: lines before questions
    textLines: [],        // plain text lines before questions (announcement/talk)
    questions: [],
    answers: [],
    rangeStart: rangeMatch ? parseInt(rangeMatch[1]) : 0,
    rangeEnd: rangeMatch ? parseInt(rangeMatch[2]) : 0,
    taskIndex: tasks.length + 1
  };
}

function finishTask() {
  if (currentTask && currentTask.questions.length > 0) tasks.push(currentTask);
  currentTask = null;
}

// Parse line by line
let inAnswerBlock = false;
let answerLines = [];

for (i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // Module header
  if (line.startsWith('## Module') || line === 'Module 2') {
    finishTask();
    const m = line.replace('## ', '').trim();
    const numMatch = m.match(/(\d+)/);
    currentModule = numMatch ? parseInt(numMatch[1]) : 1;
    continue;
  }

  // Task header
  if (line.startsWith('### ')) {
    const taskTitle = line.replace('### ', '').trim();
    startTask(taskTitle, i);
    continue;
  }

  // Skip empty lines, title lines, separators
  if (!line || line.startsWith('# ') || line === '---') continue;

  // Answer block
  if (line === '[ANSWER]') {
    inAnswerBlock = true;
    answerLines = [];
    continue;
  }
  if (line === '[/ANSWER]') {
    inAnswerBlock = false;
    if (currentTask) currentTask.answers = answerLines.filter(l => l);
    continue;
  }
  if (inAnswerBlock) {
    answerLines.push(line);
    continue;
  }

  // Audio metadata (per-question for LCAR, task-level otherwise)
  if (line.startsWith('audio:')) {
    if (currentTask) {
      const audioVal = line.replace('audio:', '').trim();
      if (currentTask.type === 'lcar' && currentTask.questions.length > 0) {
        currentTask.questions[currentTask.questions.length - 1].audio = audioVal;
      } else {
        currentTask.audio = audioVal;
      }
    }
    continue;
  }

  // Dialogue lines (Woman: / Man:)
  const diaMatch = line.match(/^(Woman|Man):\s*(.+)$/);
  if (diaMatch && currentTask && currentTask.questions.length === 0) {
    currentTask.dialogueLines.push(line);
    continue;
  }

  // Numbered question line (e.g., "9. What does the woman imply...")
  const qMatch = line.match(/^(\d+)\.\s+(.+)/);
  if (qMatch && currentTask) {
    const qNum = parseInt(qMatch[1]);
    const qText = qMatch[2];
    if (qText.startsWith('Woman:') || qText.startsWith('Man:')) {
      // LCAR: question text is dialogue itself, NO separate question text
      // But we need to store the dialogue as transcript
      if (!currentTask.dialogueLines.length) currentTask.dialogueLines.push(qText);
      currentTask.questions.push({
        id: qNum,
        question: '',  // No question text for LCAR
        options: [],
        dialogue: qText
      });
    } else {
      // Conversation/Announcement/Talk: this IS the question text
      currentTask.questions.push({
        id: qNum,
        question: qText,
        options: [],
        dialogue: ''
      });
    }
    continue;
  }

  // Option lines (A. ... B. ... C. ... D. ...)
  const optMatch = line.match(/^([A-D])\.\s(.+)/);
  if (optMatch && currentTask && currentTask.questions.length > 0) {
    const lastQ = currentTask.questions[currentTask.questions.length - 1];
    lastQ.options.push({ letter: optMatch[1], text: optMatch[2] });
    continue;
  }

  // Time range metadata: >> play: MM:SS-MM:SS
  const playMatch = line.match(/^>>\s*play:\s*(\d+:\d+)\s*-\s*(\d+:\d+)/);
  if (playMatch && currentTask) {
    const start = timeToSeconds(playMatch[1]);
    const end = timeToSeconds(playMatch[2]);
    if (currentTask.questions.length > 0) {
      // Per-question timestamp (LCAR: each question has its own segment)
      const lastQ = currentTask.questions[currentTask.questions.length - 1];
      lastQ.audioStart = start;
      lastQ.audioEnd = end;
    } else {
      // Task-level timestamp (conversation/announcement/talk: one segment for all questions)
      currentTask.audioStart = start;
      currentTask.audioEnd = end;
    }
    continue;
  }

  // Dialogue lines after questions start (context for transcript)
  if (diaMatch && currentTask) {
    currentTask.dialogueLines.push(line);
    continue;
  }

  // Any other text line (announcement/talk body) before questions start
  if (currentTask && currentTask.questions.length === 0 && line.length > 0) {
    currentTask.textLines.push(line);
  }
}
finishTask();

// Assign answers to questions
tasks.forEach(task => {
  task.questions.forEach((q, idx) => {
    q.answer = task.answers[idx] || '';
  });
});

// Determine transcript for each task
tasks.forEach(task => {
  if (task.type === 'lcar') {
    task.transcript = task.dialogueLines.join('\n');
  } else {
    const allLines = [...task.dialogueLines, ...task.textLines];
    task.transcript = allLines.join('\n');
  }
});

console.log(`Parsed ${tasks.length} tasks across modules`);

// ---- Compute module-level totals and assign global question numbers ----
const moduleTotals = {};
tasks.forEach(task => {
  const mod = task.module;
  if (!moduleTotals[mod]) moduleTotals[mod] = { total: 0, offset: 0 };
  task.moduleTotalQuestions = moduleTotals[mod].total + task.questions.length;
  moduleTotals[mod].total += task.questions.length;
});

// Assign per-module globalNum for page display (X of Y), plus globalKey for results
const moduleQuestionCounters = {};
let globalKeyCounter = 0;
tasks.forEach(task => {
  const mod = task.module;
  task.questions.forEach((q, idx) => {
    globalKeyCounter++;
    if (!moduleQuestionCounters[mod]) moduleQuestionCounters[mod] = 0;
    moduleQuestionCounters[mod]++;
    q.globalNum = moduleQuestionCounters[mod];
    q.globalKey = globalKeyCounter;
    q.moduleTotal = moduleTotals[mod].total;
  });
});

// ---- Generate pages ----

let module1Pages = [];
let module2Pages = [];
const urlMap = {};

// Track task counters per module for unique slugs
const taskCounters = {};

tasks.forEach(task => {
  const mod = task.module;
  const type = task.type;
  const totalQ = task.questions.length;
  const audioFile = AUDIO_BASE + task.audio;
  const transcript = escapeHtml(task.transcript);

  // Unique task slug per module
  const key = mod + '_' + type;
  if (!taskCounters[key]) taskCounters[key] = 0;
  taskCounters[key]++;
  const counter = taskCounters[key];

  let taskSlug;
  if (type === 'lcar') {
    taskSlug = 'lcar';
  } else if (type === 'conversation') {
    taskSlug = 'conv' + counter;
  } else if (type === 'announcement') {
    taskSlug = 'ann' + counter;
  } else if (type === 'talk') {
    taskSlug = 'talk' + counter;
  } else {
    taskSlug = type;
  }

  const pages = [];

  if (type === 'lcar') {
    // Generate Template A pages for each LCAR question
    task.questions.forEach((q, idx) => {
      const localQ = idx + 1;
      const globalNum = q.globalNum;
      const modTotal = q.moduleTotal;
      const isFirstQ = (globalNum === 1);
      const qTranscript = escapeHtml(q.dialogue || '');
      const lcarAudio = q.audio || task.audio || '';
      const lcarAudioFile = lcarAudio ? AUDIO_BASE + lcarAudio : '';
      const vars = {
        QUESTION_NUMBER: globalNum,
        QUESTION_KEY: q.globalKey,
        TOTAL_QUESTIONS: modTotal,
        TIMER_SECONDS: 20,
        AUDIO_FILE: lcarAudioFile,
        AUDIO_START: 0,
        AUDIO_END: 999,
        TRANSCRIPT: qTranscript,
        OPTION_A: escapeHtml(q.options[0]?.text || ''),
        OPTION_B: escapeHtml(q.options[1]?.text || ''),
        OPTION_C: escapeHtml(q.options[2]?.text || ''),
        OPTION_D: escapeHtml(q.options[3]?.text || ''),
        CORRECT_A: q.answer === 'A' ? 'true' : 'false',
        CORRECT_B: q.answer === 'B' ? 'true' : 'false',
        CORRECT_C: q.answer === 'C' ? 'true' : 'false',
        CORRECT_D: q.answer === 'D' ? 'true' : 'false',
        ANSWER: q.answer,
        BACK_PAGE: '__BACK__',
        NEXT_PAGE: (localQ < totalQ)
          ? fmtPageName(mod, taskSlug, 'q', localQ + 1)
          : '__NEXT_TASK__'
      };
      urlMap[q.globalKey] = fmtPageName(mod, taskSlug, 'q', localQ);
      pages.push({ fname: fmtPageName(mod, taskSlug, 'q', localQ), html: fillTemplate(tplA, vars), type: 'A', isFirstQ: isFirstQ });
    });
  } else {
    // Generate Template B (audio play page) first
    const playVars = {
      TASK_TITLE: task.title.replace(/\s*[–-]\s*Questions?\s+\d+[–-]\d+.*$/i, '').trim(),
      AUDIO_FILE: audioFile,
      AUDIO_START: task.audioStart ?? 0,
      AUDIO_END: task.audioEnd ?? 999,
      TRANSCRIPT: transcript,
      BACK_PAGE: '__BACK__',
      NEXT_PAGE: fmtPageName(mod, taskSlug, 'q', 1)
    };
    pages.push({ fname: fmtPageName(mod, taskSlug, 'play', 0), html: fillTemplate(tplB, playVars), type: 'B' });

    // Generate Template C pages for each question
    const timerSec = (type === 'talk') ? 30 : 20;
    task.questions.forEach((q, idx) => {
      const localQ = idx + 1;
      const globalNum = q.globalNum;
      const modTotal = q.moduleTotal;
      const vars = {
        QUESTION_NUMBER: globalNum,
        QUESTION_KEY: q.globalKey,
        TOTAL_QUESTIONS: modTotal,
        TIMER_SECONDS: timerSec,
        AUDIO_FILE: audioFile,
        TRANSCRIPT: transcript,
        QUESTION_TEXT: escapeHtml(q.question),
        OPTION_A: escapeHtml(q.options[0]?.text || ''),
        OPTION_B: escapeHtml(q.options[1]?.text || ''),
        OPTION_C: escapeHtml(q.options[2]?.text || ''),
        OPTION_D: escapeHtml(q.options[3]?.text || ''),
        CORRECT_A: q.answer === 'A' ? 'true' : 'false',
        CORRECT_B: q.answer === 'B' ? 'true' : 'false',
        CORRECT_C: q.answer === 'C' ? 'true' : 'false',
        CORRECT_D: q.answer === 'D' ? 'true' : 'false',
        ANSWER: q.answer,
        BACK_PAGE: '__BACK__',
        NEXT_PAGE: (localQ < totalQ)
          ? fmtPageName(mod, taskSlug, 'q', localQ + 1)
          : '__NEXT_TASK__'
      };
      urlMap[q.globalKey] = fmtPageName(mod, taskSlug, 'q', localQ);
      pages.push({ fname: fmtPageName(mod, taskSlug, 'q', localQ), html: fillTemplate(tplC, vars), type: 'C' });
    });
  }

  if (mod === 2) {
    module2Pages.push(...pages);
  } else {
    module1Pages.push(...pages);
  }
});

// ---- Resolve cross-task NEXT_PAGE and BACK_PAGE links ----
function resolvePageLinks(pages, nextModuleFirstPage, backFirstPage) {
  const fnames = pages.map(p => p.fname);
  pages.forEach((p, idx) => {
    // NEXT_PAGE
    if (p.html.includes('__NEXT_TASK__')) {
      const nextFname = idx + 1 < fnames.length ? fnames[idx + 1] : nextModuleFirstPage;
      p.html = p.html.split('__NEXT_TASK__').join(nextFname);
    }
    // BACK_PAGE
    if (p.html.includes('__BACK__')) {
      const backFname = idx > 0 ? fnames[idx - 1] : backFirstPage;
      p.html = p.html.split('__BACK__').join(backFname);
    }
  });
}

// Module 1's last page → Module 2's first page
// Module 1's first page BACK_PAGE → module2-intro.html? No, that's wrong.
// First question in each module has BACK_PAGE pointing to module intro.
// Last question in Module 1 → Module 2 first page
// Last question in Module 2 → results page
const allModule1 = module1Pages;
const allModule2 = module2Pages;

if (allModule1.length > 0 && allModule2.length > 0) {
  resolvePageLinks(allModule1, 'module2-intro.html', 'module1-intro.html');
}
if (allModule2.length > 0) {
  resolvePageLinks(allModule2, 'listening_results.html', 'module2-intro.html');
}

// Also update the start → module1-intro link
// The start.html already points to module1-intro.html
// And module1-intro.html already points to listening_m1_task1.html (which we'll overwrite)

// ---- Write all files ----
const allPages = [...allModule1, ...allModule2];

allPages.forEach(p => {
  const filePath = path.join(OUTPUT_DIR, p.fname);
  let html = p.html;
  if (!html.includes(STORAGE_PREFIX)) {
    html = html.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);
  }
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  ${p.fname} (${p.type})`);
});

// ---- Update module1-intro Begin link ----
// The module1-intro Begin button links to 'listening_m1_task1.html'
// Our first LCAR page is listening_m1_lcar_01.html
// Need to update module1-intro.html

const module1IntroPath = path.join(OUTPUT_DIR, 'module1-intro.html');
const existingIntro = path.join(__dirname, 'tpo', tpoNumber, 'listening', 'module1-intro.html');
const startPage = path.join(__dirname, 'tpo', tpoNumber, 'listening', 'start.html');

// Copy start.html (it's fine as-is)
if (!fs.existsSync(startPage)) {
  let startTpl = fs.readFileSync(path.join(TEMPLATE_DIR, 'General', 'start-template.html'), 'utf8');
  startTpl = startTpl.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);
  fs.writeFileSync(startPage, startTpl, 'utf8');
  console.log('  start.html (copied)');
}

// Copy and update module1-intro.html
let introTpl, firstPage;
if (fs.existsSync(existingIntro)) {
  introTpl = fs.readFileSync(existingIntro, 'utf8');
  firstPage = allModule1.length > 0 ? allModule1[0].fname : 'listening_m1_lcar_01.html';
  introTpl = introTpl.split("listening_m1_task1.html").join(firstPage);
} else {
  introTpl = fs.readFileSync(path.join(TEMPLATE_DIR, 'General', 'module1-intro-template.html'), 'utf8');
  firstPage = allModule1.length > 0 ? allModule1[0].fname : 'listening_m1_lcar_01.html';
  introTpl = introTpl.replace(/{{FIRST_QUESTION_PAGE}}/g, firstPage);
  introTpl = introTpl.split("listening_m1_task1.html").join(firstPage);
}
introTpl = introTpl.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);
fs.writeFileSync(module1IntroPath, introTpl, 'utf8');
console.log('  module1-intro.html (updated Begin → ' + firstPage + ')');

// ---- Copy module2-intro.html ----
const module2IntroPath = path.join(OUTPUT_DIR, 'module2-intro.html');
const existingM2Intro = path.join(__dirname, 'tpo', tpoNumber, 'listening', 'module2-intro.html');

let m2IntroTpl, m2FirstPage;
if (fs.existsSync(existingM2Intro)) {
  m2IntroTpl = fs.readFileSync(existingM2Intro, 'utf8');
  m2FirstPage = allModule2.length > 0 ? allModule2[0].fname : 'listening_m2_lcar_01.html';
  m2IntroTpl = m2IntroTpl.split("listening_m2_task1.html").join(m2FirstPage);
} else {
  const m2templatePath = path.join(TEMPLATE_DIR, 'General', 'module2-intro-template.html');
  if (fs.existsSync(m2templatePath)) {
    m2IntroTpl = fs.readFileSync(m2templatePath, 'utf8');
    m2FirstPage = allModule2.length > 0 ? allModule2[0].fname : 'listening_m2_lcar_01.html';
    m2IntroTpl = m2IntroTpl.replace(/{{FIRST_QUESTION_PAGE}}/g, m2FirstPage);
    m2IntroTpl = m2IntroTpl.split("listening_m2_task1.html").join(m2FirstPage);
  }
}
if (m2IntroTpl) {
  m2IntroTpl = m2IntroTpl.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);
  fs.writeFileSync(module2IntroPath, m2IntroTpl, 'utf8');
  console.log('  module2-intro.html (updated Begin → ' + m2FirstPage + ')');
}

// ---- Generate results page ----
const resultsTplPath = path.join(TEMPLATE_DIR, 'General', 'results-template.html');
if (fs.existsSync(resultsTplPath)) {
  let resultsTpl = fs.readFileSync(resultsTplPath, 'utf8');

  const headerStyles = `
        html, body { margin: 0; padding: 0; }
        .header { background-color: #008080; color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; position: fixed; top: 0; left: 0; right: 0; z-index: 1000; }
        .logo { font-size: 36px; font-weight: bold; color: white; }
        .nav-buttons { display: flex; gap: 12px; }
        .nav-button { padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; border: 3px solid transparent; transition: all 0.3s ease; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .nav-button.dark { background-color: rgba(255, 255, 255, 0.15); color: white; border-color: rgba(255, 255, 255, 0.3); }
        .nav-button.dark:hover { background-color: rgba(255, 255, 255, 0.25); border-color: rgba(255, 255, 255, 0.6); box-shadow: 0 4px 8px rgba(255, 255, 255, 0.2); transform: translateY(-1px); }
        .nav-button.light { background-color: rgba(255, 255, 255, 0.15); color: white; border-color: rgba(255, 255, 255, 0.3); }
        .nav-button.light:hover { background-color: rgba(255, 255, 255, 0.25); border-color: rgba(255, 255, 255, 0.6); box-shadow: 0 4px 8px rgba(255, 255, 255, 0.2); transform: translateY(-1px); }
`;
  resultsTpl = resultsTpl.replace('<style>', '<style>\n' + headerStyles + '\n');

  const mod1Tasks = tasks.filter(t => t.module === 1);
  const mod2Tasks = tasks.filter(t => t.module === 2);
  const mod1Total = mod1Tasks.reduce((sum, t) => sum + t.questions.length, 0);
  const mod2Total = mod2Tasks.reduce((sum, t) => sum + t.questions.length, 0);
  const mod1TaskCount = mod1Tasks.length;
  const mod2TaskCount = mod2Tasks.length;

  const mod1Start = 1;
  const mod1End = mod1Total;
  const mod2Start = 1;
  const mod2End = mod2Total;

  const mod1Title = 'Module 1 (Questions 1-' + mod1End + ')';
  const mod2Title = 'Module 2 (Questions 1-' + mod2Total + ')';

  const urlMapJson = JSON.stringify(urlMap);

  resultsTpl = resultsTpl.replace(/{{MODULE1_TITLE}}/g, mod1Title);
  resultsTpl = resultsTpl.replace(/{{MODULE1_START}}/g, String(mod1Start));
  resultsTpl = resultsTpl.replace(/{{MODULE1_END}}/g, String(mod1End));
  resultsTpl = resultsTpl.replace(/{{MODULE1_TOTAL}}/g, String(mod1Total));
  resultsTpl = resultsTpl.replace(/{{MODULE2_TITLE}}/g, mod2Title);
  resultsTpl = resultsTpl.replace(/{{MODULE2_START}}/g, String(mod2Start));
  resultsTpl = resultsTpl.replace(/{{MODULE2_END}}/g, String(mod2End));
  resultsTpl = resultsTpl.replace(/{{MODULE2_TOTAL}}/g, String(mod2Total));
  resultsTpl = resultsTpl.replace(/{{M1_TASK_COUNT}}/g, String(mod1TaskCount));
  resultsTpl = resultsTpl.replace(/{{M2_TASK_COUNT}}/g, String(mod2TaskCount));
  resultsTpl = resultsTpl.replace(/{{TASK_URL_MAP}}/g, urlMapJson);
  resultsTpl = resultsTpl.replace(/{{CSP_NONCE}}/g, '');
  resultsTpl = resultsTpl.replace(/toefl_(?!tpo\d+_)/g, STORAGE_PREFIX);

  const resultsPath = path.join(OUTPUT_DIR, 'listening_results.html');
  fs.writeFileSync(resultsPath, resultsTpl, 'utf8');
  console.log('  listening_results.html (generated)');
}

// ---- Inject start time recording into first question page ----
const firstQPage = allModule1.find(p => p.type !== 'B');
if (firstQPage) {
  const firstQPath = path.join(OUTPUT_DIR, firstQPage.fname);
  let firstQHtml = fs.readFileSync(firstQPath, 'utf8');
  const startTimeKey = STORAGE_PREFIX + 'listening_start_time';
  const injectScript = '<script>(function(){var k="' + startTimeKey + '";if(!localStorage.getItem(k))localStorage.setItem(k,Date.now());})();<\/script>';
  firstQHtml = firstQHtml.replace('</head>', injectScript + '</head>');
  fs.writeFileSync(firstQPath, firstQHtml, 'utf8');
  console.log('  (injected start time tracking into ' + firstQPage.fname + ')');
}

  console.log(`\nDone! ${allPages.length} pages generated in ${OUTPUT_DIR}`);
}

// ===== Main execution =====
if (tpoMode === 'all') {
  for (const num of allTpoNums) {
    console.log(`\n=== 生成听力 TPO ${num} ===`);
    generateListeningTPO(num);
  }
} else {
  generateListeningTPO(tpoNumber);
}
