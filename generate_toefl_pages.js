import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CLI argument parsing =====
const args = process.argv.slice(2);
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

// ===== Discover TPO files =====
const questionsDir = path.join(__dirname, 'assets/questions/reading');

const allTpoNums = [];
if (fs.existsSync(questionsDir)) {
  const entries = fs.readdirSync(questionsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const match = entry.name.match(/^TPO-(\d+)$/i);
      if (match) allTpoNums.push(match[1]);
    }
  }
}
allTpoNums.sort((a, b) => parseInt(a) - parseInt(b));

if (allTpoNums.length === 0) {
  console.error('未找到题库文件！');
  process.exit(1);
}

console.log('可用的题库文件:', allTpoNums.map(n => `TPO ${n}`));

let filesToProcess = [];
if (tpoMode === 'all') {
  for (const num of allTpoNums) {
    const relativePath = path.join(`TPO-${num.padStart(2, '0')}`, `reading-TPO-${num.padStart(2, '0')}.md`);
    const fullPath = path.join(questionsDir, relativePath);
    if (fs.existsSync(fullPath)) {
      filesToProcess.push({ filename: relativePath, tpoNum: num });
    }
  }
} else {
  const relativePath = path.join(`TPO-${tpoNumber.padStart(2, '0')}`, `reading-TPO-${tpoNumber.padStart(2, '0')}.md`);
  const fullPath = path.join(questionsDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`未找到TPO ${tpoNumber}的题库文件！`);
    process.exit(1);
  }
  filesToProcess.push({ filename: relativePath, tpoNum: tpoNumber });
}

// ===== Templates definition =====
const TEMPLATES = {
  fill: {
    path: path.join(__dirname, 'templates/Reading/fill-in-missing-letters/template.html')
  },
  email: {
    path: path.join(__dirname, 'templates/Reading/read-an-email/template.html')
  },
  textchain: {
    path: path.join(__dirname, 'templates/Reading/read-a-text-chain/template.html')
  },
  academic: {
    path: path.join(__dirname, 'templates/Reading/read-academic-passage/template.html')
  },
  notice: {
    path: path.join(__dirname, 'templates/Reading/read-a-notice/template.html')
  },
  'social-media-post': {
    path: path.join(__dirname, 'templates/Reading/read-a-social-media-post/template.html')
  },
  start: {
    path: path.join(__dirname, 'templates/Reading/general/start-page-template.html')
  },
  'module1-intro': {
    path: path.join(__dirname, 'templates/Reading/general/module1-intro-template.html')
  },
  'module2-intro': {
    path: path.join(__dirname, 'templates/Reading/general/module2-intro-template.html')
  },
  results: {
    path: path.join(__dirname, 'templates/Reading/general/results-page-template.html')
  }
};

const templateContent = {};
for (const [key, config] of Object.entries(TEMPLATES)) {
  if (!fs.existsSync(config.path)) {
    console.warn(`模板文件不存在: ${config.path}`);
    continue;
  }
  let html = fs.readFileSync(config.path, 'utf-8');

  const questionPageKeys = ['fill', 'email', 'textchain', 'academic', 'results', 'notice', 'social-media-post'];
    
    if (questionPageKeys.includes(key)) {
      const headerStyles = `
        html, body { margin: 0; padding: 0; }
        .header { background-color: #008080; color: white; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; position: fixed; top: 0; left: 0; right: 0; z-index: 1000; height: 60px; }
        .logo { font-size: 36px; font-weight: bold; color: white; }
        .nav-buttons { display: flex; gap: 12px; }
        .nav-button { padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 16px; cursor: pointer; border: 3px solid transparent; transition: all 0.3s ease; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .nav-button.dark { background-color: rgba(255, 255, 255, 0.15); color: white; border-color: rgba(255, 255, 255, 0.3); }
        .nav-button.dark:hover { background-color: rgba(255, 255, 255, 0.25); border-color: rgba(255, 255, 255, 0.6); box-shadow: 0 4px 8px rgba(255, 255, 255, 0.2); transform: translateY(-1px); }
        .nav-button.light { background-color: rgba(255, 255, 255, 0.15); color: white; border-color: rgba(255, 255, 255, 0.3); }
        .nav-button.light:hover { background-color: rgba(255, 255, 255, 0.25); border-color: rgba(255, 255, 255, 0.6); box-shadow: 0 4px 8px rgba(255, 255, 255, 0.2); transform: translateY(-1px); }
        .timer-info-row { position: relative; margin-top: 60px; margin-bottom: 0; }
        .main-content { max-width: 1200px; margin: 0 auto 30px; padding: 0 30px; width: 100%; background-color: white; box-sizing: border-box; }
`;
      html = html.replace('<style>', '<style>\n' + headerStyles + '\n');
      html = html.replace(/href="assets\/score\/score\.css"/g, 'href="../../../assets/score/score.css"');
      html = html.replace(/href="font-awesome\.css"/g, 'href="../../../font-awesome.css"');
      html = html.replace(/'\\.\\.\\.\\.\'index\\.html\'/g, "'../../../dist/index.html'");
      templateContent[key] = html;
    } else {
      html = html.replace(/href="font-awesome\.css"/g, 'href="../../../font-awesome.css"');
      html = html.replace(/href="styles\.css"/g, 'href="../../../styles.css"');
      templateContent[key] = html;
    }
}

// ===== Parsing functions =====
function parseMarkdown(markdownText) {
  const modules = [];
  const moduleSections = markdownText.split('## Module ');
  moduleSections.shift();

  for (const section of moduleSections) {
    const firstNewline = section.indexOf('\n');
    const moduleTitle = section.substring(0, firstNewline).trim();
    const moduleContent = section.substring(firstNewline + 1);

    const tasks = [];
    const taskSections = moduleContent.split('### Task ');
    taskSections.shift();

    for (const taskSection of taskSections) {
      const taskFirstNewline = taskSection.indexOf('\n');
      const taskTitleLine = taskSection.substring(0, taskFirstNewline).trim();
      const taskContent = taskSection.substring(taskFirstNewline + 1);

      const taskMatch = taskTitleLine.match(/^(\d+)\s+(.+?)\s*\(Questions\s*(\d+)[–-](\d+)\)/);
      if (!taskMatch) {
        console.warn('无法解析任务标题:', taskTitleLine);
        continue;
      }

      const taskNumber = parseInt(taskMatch[1]);
      const taskDescription = taskMatch[2];
      const questionStart = parseInt(taskMatch[3]);
      const questionEnd = parseInt(taskMatch[4]);

      let templateType = null;
      if (taskDescription.includes('Complete the Words')) {
        templateType = 'fill';
      } else if (taskDescription.includes('Email')) {
        templateType = 'email';
      } else if (taskDescription.includes('Text Chain')) {
        templateType = 'textchain';
      } else if (taskDescription.includes('Academic Passage')) {
        templateType = 'academic';
      } else if (taskDescription.includes('Notice')) {
        templateType = 'notice';
      } else if (taskDescription.includes('Social Media Post')) {
        templateType = 'social-media-post';
      } else {
        console.warn('未知题型:', taskDescription);
        continue;
      }

      if (templateType === 'fill') {
        const answerStart = taskContent.indexOf('[ANSWER]');
        const answerEnd = taskContent.indexOf('[/ANSWER]');

        if (answerStart === -1 || answerEnd === -1) {
          console.warn('填空任务缺少答案部分:', taskTitleLine);
          continue;
        }

        const paragraph = taskContent.substring(0, answerStart).trim();
        const firstNewline = paragraph.indexOf('\n');
        const actualParagraph =
          firstNewline > -1 ? paragraph.substring(firstNewline + 1).trim() : paragraph;
        const answerBlock = taskContent.substring(answerStart + 8, answerEnd).trim();

        const answers = {};
        const answerLines = answerBlock.split('\n').filter(line => line.trim());
        const numberedAnswers = [];
        for (const line of answerLines) {
          const colonPos = line.indexOf(':');
          if (colonPos > -1) {
            const questionNumRaw = line.substring(0, colonPos).trim();
            const answer = line.substring(colonPos + 1).trim();
            if (!/^\d+$/.test(questionNumRaw)) {
              numberedAnswers.push(answer);
            } else {
              answers[questionNumRaw] = answer;
            }
          }
        }
        numberedAnswers.forEach((ans, idx) => {
          answers[(idx + 1).toString()] = ans;
        });

        tasks.push({
          type: 'fill',
          templateType,
          number: taskNumber,
          description: taskDescription,
          questionStart,
          questionEnd,
          paragraph: actualParagraph,
          answers
        });
      } else {
        const questionStartIndex = taskContent.search(/\n\d+\./);
        let passage = '';
        let questionsContent = '';

        if (questionStartIndex !== -1) {
          passage = taskContent.substring(0, questionStartIndex).trim();
          questionsContent = taskContent.substring(questionStartIndex).trim();
        } else {
          passage = taskContent.trim();
        }

        const questions = [];
        const questionSections = questionsContent.split(/\n(?=\d+\.)/);

        for (const qSection of questionSections) {
          if (!qSection.trim()) continue;

          const qMatch = qSection.match(/^(\d+)\.\s*(.+?)(?=\nA\.|\n[ABCD]\.|\n\[ANSWER\]|$)/s);
          if (!qMatch) continue;

          const qNum = parseInt(qMatch[1]);
          const qText = qMatch[2].trim();

          const options = {};
          const optionRegex = /([ABCD])\.\s*(.+?)(?=\n[ABCD]\.|\n\[ANSWER\]|$)/gs;
          let optionMatch;
          while ((optionMatch = optionRegex.exec(qSection)) !== null) {
            const optLetter = optionMatch[1];
            const optText = optionMatch[2].trim();
            options[optLetter] = optText;
          }

          const answerStart = qSection.indexOf('[ANSWER]');
          const answerEnd = qSection.indexOf('[/ANSWER]');
          let correctAnswer = '';
          if (answerStart !== -1 && answerEnd !== -1) {
            correctAnswer = qSection.substring(answerStart + 8, answerEnd).trim();
          }

          questions.push({
            number: qNum,
            text: qText,
            options,
            correctAnswer
          });
        }

        tasks.push({
          type: 'reading',
          templateType,
          number: taskNumber,
          description: taskDescription,
          questionStart,
          questionEnd,
          passage,
          questions
        });
      }
    }

    modules.push({
      title: moduleTitle,
      tasks
    });
  }

  return modules;
}

function parseEmailContent(passage) {
  const lines = passage.split('\n');
  const result = { date: '', subject: '', body: '', sender: '' };

  let bodyStartIndex = -1;
  let signatureIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('Date:')) {
      result.date = line.replace(/^Date:/, '').trim();
    } else if (line.startsWith('Subject:')) {
      result.subject = line.replace(/^Subject:/, '').trim();
    } else if (line.match(/^Dear\s+/i) && bodyStartIndex === -1) {
      bodyStartIndex = i;
    } else if (
      bodyStartIndex !== -1 &&
      signatureIndex === -1 &&
      (line.match(/^Best regards,?\s*$/i) ||
       line.match(/^Regards,?\s*$/i) ||
       line.match(/^Sincerely,?\s*$/i))
    ) {
      signatureIndex = i;
      result.sender = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
      break;
    }
  }

  if (bodyStartIndex === -1) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('Date:') && !line.startsWith('Subject:')) {
        bodyStartIndex = i;
        break;
      }
    }
  }

  if (bodyStartIndex !== -1) {
    const endIdx = signatureIndex !== -1 ? signatureIndex : lines.length;
    const bodyLines = lines.slice(bodyStartIndex, endIdx);
    result.body = bodyLines
      .filter(l => l.trim())
      .map(l => `<p class="email-paragraph">${l.trim()}</p>`)
      .join('\n');
  }

  return result;
}

function parseTextChain(passage) {
  const messages = [];
  const lines = passage.split('\n').map(l => l.trim()).filter(l => l);

  for (let i = 0; i < lines.length; i += 2) {
    const header = lines[i];
    const text = lines[i + 1];
    if (!header || !text) continue;

    const match = header.match(/^(.+?)\s*\((.+?)\)$/);
    if (match) {
      const sender = match[1].trim();
      const time = match[2].trim();
      messages.push({
        sender,
        time,
        text,
        isSent: sender.toLowerCase().includes('sanjay')
      });
    }
  }

  return messages
    .map(m => `
<div class="message-group ${m.isSent ? 'sent-align' : ''}">
  <div class="message-sender-label">${m.sender}</div>
  <div class="message-bubble ${m.isSent ? 'sent' : 'received'}">
    <div class="message-text">${m.text}</div>
  </div>
  <div class="message-time-label">${m.time}</div>
</div>`)
    .join('\n');
}

function parseNoticeContent(passage) {
  const lines = passage.split('\n').map(l => l.trim()).filter(l => l);
  let title = '';
  let subtitle = '';

  for (const line of lines) {
    const titlePrefix = line.match(/^Title[：:]\s*(.+)/);
    if (titlePrefix) { title = titlePrefix[1].trim(); continue; }
    const subtitlePrefix = line.match(/^Subtitle[：:]\s*(.+)/);
    if (subtitlePrefix) { subtitle = subtitlePrefix[1].trim(); }
  }

  if (!title) {
    for (let i = 0; i < lines.length; i++) {
      const titleMatch = lines[i].match(/^\*\*(.+?)\*\*/);
      if (titleMatch) {
        title = titleMatch[1].trim();
        if (i + 1 < lines.length && !lines[i + 1].startsWith('*') && !lines[i + 1].match(/^\d+\./)) {
          subtitle = lines[i + 1];
        }
        break;
      }
    }
  }

  const contentLines = lines.filter(l => !l.match(/^Title[：:]/) && !l.match(/^Subtitle[：:]/) && !l.startsWith('**') && !l.match(/^\d+\./));
  const content = contentLines.join('\n');

  return { title, subtitle, content };
}

function parseSocialContent(passage) {
  const lines = passage.split('\n').map(l => l.trim()).filter(l => l);
  let username = '';

  for (const line of lines) {
    const namePrefix = line.match(/^username[：:]\s*(.+)/i);
    if (namePrefix) { username = namePrefix[1].trim(); break; }
  }

  if (!username) {
    for (const line of lines) {
      const nameMatch = line.match(/^\*\*(.+?)\*\*/);
      if (nameMatch) { username = nameMatch[1].trim(); break; }
    }
  }

  const contentLines = lines.filter(l => !l.match(/^username[：:]/i) && !l.startsWith('**') && !l.match(/^\d+\./));
  const content = contentLines.join('<br>');

  return { username, content };
}

function generateFillBlocks(paragraph, answers) {
  let fillIndex = 1;
  let s = paragraph.replace(/\\"/g, '"');

  const answerList = [];
  for (let i = 1; i <= 100; i++) {
    if (answers[i.toString()]) {
      answerList.push(answers[i.toString()]);
    }
  }

  const fillRegex = /([a-zA-Z]+)(?:\\_)+/g;

  let result = s.replace(fillRegex, (match, prefix) => {
    const fullWord = answerList[fillIndex - 1];
    if (!fullWord) {
      console.warn(`No answer found for fill index ${fillIndex}`);
      fillIndex++;
      return match;
    }

    if (!fullWord.startsWith(prefix)) {
      console.warn(`Prefix mismatch: "${prefix}" does not start "${fullWord}" at index ${fillIndex}`);
    }

    const missingPart = fullWord.slice(prefix.length);

    let block = `<span class="word-fill-container">
            <span class="word-prefix">${prefix}</span>
            <div class="letter-box-container" data-answer="${missingPart}">`;

    for (let j = 0; j < missingPart.length; j++) {
      block += `<input type="text" class="letter-box" maxlength="1" data-index="${j + 1}" />`;
    }

    block += `</div>
            <span class="fill-question-number">${fillIndex}</span>
          </span>`;

    fillIndex++;
    return block;
  });

  return result;
}

// ===== Generation function (runs once per TPO) =====
function generateTPO(tpoNum, markdownFile) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`开始生成 TPO ${tpoNum}`);
  console.log(`${'='.repeat(60)}`);

  const cspNonce = `nonce-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const markdownText = fs.readFileSync(markdownFile, 'utf-8');
  const modules = parseMarkdown(markdownText);

  const titleMatch = markdownText.match(/^#\s*(.+)/m);
  const rawTitle = titleMatch ? titleMatch[1].trim() : `2026新托福样题（${tpoNum}）`;

  console.log(`解析完成: ${modules.length} 个模块`);
  console.log(`模块1: ${modules[0]?.tasks.length} 个任务`);
  console.log(`模块2: ${modules[1]?.tasks.length} 个任务`);

  const tpoDir = path.join(__dirname, 'tpo', tpoNum);
  const readingDir = path.join(tpoDir, 'reading');
  if (!fs.existsSync(readingDir)) {
    fs.mkdirSync(readingDir, { recursive: true });
  }
  
  // Calculate module boundaries once (needed for getFilename and question templates)
  let module1Start = Infinity, module1End = -Infinity;
  let module2Start = Infinity, module2End = -Infinity;
  for (let mIdx = 0; mIdx < modules.length; mIdx++) {
    for (const task of modules[mIdx].tasks) {
      if (mIdx === 0) {
        module1Start = Math.min(module1Start, task.questionStart);
        module1End = Math.max(module1End, task.questionEnd);
      } else {
        module2Start = Math.min(module2Start, task.questionStart);
        module2End = Math.max(module2End, task.questionEnd);
      }
    }
  }
  const module1Total = module1End - module1Start + 1;
  const module2Total = module2End - module2Start + 1;

  function getFilename(moduleIndex, taskNumber, questionIndex) {
    if (moduleIndex === 0) {
      if (questionIndex === undefined) {
        return `reading_m1_task${taskNumber}.html`;
      } else {
        return `reading_m1_task${taskNumber}_${questionIndex + 1}.html`;
      }
    } else {
      if (questionIndex === undefined) {
        return `reading_m2_task${taskNumber}.html`;
      } else {
        return `reading_m2_task${taskNumber}_${questionIndex + 1}.html`;
      }
    }
  }

  function buildPageList(modules) {
    const pages = [];
    for (let mIdx = 0; mIdx < modules.length; mIdx++) {
      const module = modules[mIdx];
      for (const task of module.tasks) {
        if (task.type === 'fill') {
          pages.push({
            filename: getFilename(mIdx, task.number),
            mIdx,
            taskNumber: task.number,
            qIndex: undefined,
            totalInTask: 1
          });
        } else {
          const readingTasks = task.questions || [];
          for (let i = 0; i < readingTasks.length; i++) {
            pages.push({
              filename: getFilename(mIdx, task.number, i),
              mIdx,
              taskNumber: task.number,
              qIndex: i,
              totalInTask: readingTasks.length
            });
          }
        }
      }
    }
    return pages;
  }

  function getBackPageFromIndex(pages, currentPageIdx) {
    if (currentPageIdx <= 0) return null;
    return pages[currentPageIdx - 1].filename;
  }

  function getNextPageFromIndex(pages, currentPageIdx) {
    if (currentPageIdx >= pages.length - 1) {
      return 'reading_results.html';
    }
    const nextPage = pages[currentPageIdx + 1];
    const currentPage = pages[currentPageIdx];
    if (currentPage.mIdx === 0 && nextPage.mIdx === 1) {
      return 'module2-intro.html';
    }
    return nextPage.filename;
  }

  function getPageIndex(pages, mIdx, taskNumber, qIndex) {
    return pages.findIndex(p => p.mIdx === mIdx && p.taskNumber === taskNumber && p.qIndex === qIndex);
  }

  const pages = buildPageList(modules);
  let generatedFiles = [];
  
  // Build URL map: global question ID → filename
  const urlMap = {};
  for (const page of pages) {
    const mIdx = page.mIdx;
    const task = modules[mIdx].tasks.find(t => t.number === page.taskNumber);
    if (!task) continue;
    if (page.qIndex === undefined) {
      // Fill task: all questions point to the same page
      for (let q = task.questionStart; q <= task.questionEnd; q++) {
        const gId = mIdx === 0 ? q : module1End + q;
        urlMap[gId] = page.filename;
      }
    } else {
      // Reading task: one question per page
      const localQ = task.questionStart + page.qIndex;
      const gId = mIdx === 0 ? localQ : module1End + localQ;
      urlMap[gId] = page.filename;
    }
  }
  const urlMapJson = JSON.stringify(urlMap);
  
  const firstQuestionPage = pages[0]?.filename || 'reading_m1_task1.html';
  const firstModule2Page = pages.find(p => p.mIdx === 1)?.filename || 'reading_m2_task1.html';
  
  for (let mIdx = 0; mIdx < modules.length; mIdx++) {
    const module = modules[mIdx];
    const modulePrefix = mIdx === 0 ? 'Module 1' : 'Module 2';

    console.log(`\n处理${modulePrefix}: ${module.tasks.length} 个任务`);

    let moduleQuestionStart = Infinity;
    let moduleQuestionEnd = -Infinity;
    for (const task of module.tasks) {
      moduleQuestionStart = Math.min(moduleQuestionStart, task.questionStart);
      moduleQuestionEnd = Math.max(moduleQuestionEnd, task.questionEnd);
    }
    const moduleTotalQuestions = moduleQuestionEnd - moduleQuestionStart + 1;

    for (const task of module.tasks) {
      console.log(
        `  任务 ${task.number}: ${task.description} (Q${task.questionStart}-${task.questionEnd}) -> ${task.templateType}`
      );

      if (task.type === 'fill') {
        const timerSeconds = mIdx === 0 ? 690 : 540;
        let html = templateContent[task.templateType];

        html = html.replace(/{{QUESTION_NUMBER}}/g, task.number);
        html = html.replace(/{{QUESTION_START}}/g, task.questionStart);
        html = html.replace(/{{QUESTION_END}}/g, task.questionEnd);
        html = html.replace(/{{TOTAL_QUESTIONS}}/g, moduleTotalQuestions);
        html = html.replace(/{{MODULE1_TOTAL}}/g, module1Total);
        html = html.replace(/{{M1_TASK_COUNT}}/g, modules[0].tasks.length);
        html = html.replace(/{{M2_TASK_COUNT}}/g, modules[1].tasks.length);
        html = html.replace(/{{FILL_COUNT}}/g, Object.keys(task.answers).length);
        html = html.replace(/{{TIMER_SECONDS}}/g, timerSeconds);

        const paragraphWithBlocks = generateFillBlocks(task.paragraph, task.answers);
        html = html.replace(/{{PARAGRAPH_WITH_FILL_BLOCKS}}/g, paragraphWithBlocks);

        const pageIdx = getPageIndex(pages, mIdx, task.number, undefined);
        const backPage = getBackPageFromIndex(pages, pageIdx) || (mIdx === 0 ? 'module1-intro.html' : 'module2-intro.html');
        const nextPage = getNextPageFromIndex(pages, pageIdx);

        html = html.replace(/{{BACK_PAGE_URL}}/g, backPage);
        html = html.replace(/{{NEXT_PAGE_URL}}/g, nextPage);

        html = html.replace(/{{CSP_NONCE}}/g, cspNonce);

        const prefix = `toefl_tpo${tpoNum}_`;
        if (!html.includes(prefix)) {
          html = html.replace(/toefl_/g, prefix);
        }

        const uniqueAnswerKey = `answers_task${task.number}_m${mIdx + 1}`;
        html = html.replace(/answers_module1/g, uniqueAnswerKey);

        const filename = getFilename(mIdx, task.number);
        fs.writeFileSync(path.join(readingDir, filename), html);
        generatedFiles.push(filename);
        console.log(`    生成: ${filename}`);
      } else if (task.type === 'reading') {
        const readingTasks = task.questions || [];
        const timerSeconds = mIdx === 0 ? 690 : 540;

        for (let i = 0; i < readingTasks.length; i++) {
          const question = readingTasks[i];
          const questionNumber = task.questionStart + i;

          let html = templateContent[task.templateType];

          html = html.replace(/{{QUESTION_NUMBER}}/g, questionNumber);
          html = html.replace(/{{TASK_NUMBER}}/g, task.number);
          html = html.replace(/{{QUESTION_COUNT}}/g, moduleTotalQuestions);
          html = html.replace(/{{MODULE1_END}}/g, module1End);
          html = html.replace(/{{MODULE1_TOTAL}}/g, module1Total);
          html = html.replace(/{{M1_TASK_COUNT}}/g, modules[0].tasks.length);
  html = html.replace(/{{M2_TASK_COUNT}}/g, modules[1].tasks.length);
  html = html.replace(/{{TASK_URL_MAP}}/g, urlMapJson);
          html = html.replace(/{{MODULE2_START}}/g, module2Start);

          if (task.templateType === 'email') {
            const emailData = parseEmailContent(task.passage);
            html = html.replace(/{{EMAIL_DATE}}/g, emailData.date);
            html = html.replace(/{{EMAIL_SUBJECT}}/g, emailData.subject);
            html = html.replace(/{{EMAIL_BODY}}/g, emailData.body);
            html = html.replace(/{{EMAIL_SENDER}}/g, emailData.sender);
          } else if (task.templateType === 'textchain') {
            html = html.replace(/{{TEXT_CHAIN_CONTENT}}/g, parseTextChain(task.passage));
          } else if (task.templateType === 'notice') {
            const noticeData = parseNoticeContent(task.passage);
            html = html.replace(/{{NOTICE_TITLE}}/g, noticeData.title);
            html = html.replace(/{{NOTICE_SUBTITLE}}/g, noticeData.subtitle);
            html = html.replace(/{{NOTICE_CONTENT}}/g, noticeData.content);
          } else if (task.templateType === 'social-media-post') {
            const socialData = parseSocialContent(task.passage);
            html = html.replace(/{{USERNAME}}/g, socialData.username);
            html = html.replace(/{{SOCIAL_MEDIA_CONTENT}}/g, socialData.content);
          } else if (task.templateType === 'academic') {
            const titleMatch = task.description.match(/[-–—]\s*(.+)$/);
            const passageTitle = titleMatch ? titleMatch[1].trim() : task.description;
            html = html.replace(/{{PASSAGE_TITLE}}/g, passageTitle);

            let passageHTML = task.passage;
            const vocabMatch = question.text.match(/The word\s+[^a-zA-Z]*([a-zA-Z-]+)[^a-zA-Z]*/);
            if (vocabMatch) {
              const targetWord = vocabMatch[1];
              const escapedWord = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
              passageHTML = passageHTML.replace(
                regex,
                '<span style="background-color:#008080;color:white;font-weight:bold;padding:1px 4px;border-radius:3px;">$1</span>'
              );
            }

            // Click on the sentence 题型检测
            const clickSentenceMatch = question.text.match(/Click on the sentence in paragraph (\d+)/i);
            let sentenceOptionsHTML = '';
            if (clickSentenceMatch) {
              const paraNum = parseInt(clickSentenceMatch[1]);
              const paras = passageHTML.split(/\n\s*\n/).filter(p => p.trim());
              if (paras.length >= paraNum) {
                const targetPara = paras[paraNum - 1];
                const sentences = targetPara
                  .split('. ')
                  .map(s => s.trim())
                  .filter(s => s.length > 3)
                  .map((s, j, arr) => (j === arr.length - 1 ? s.replace(/\.$/, '') + '.' : s + '.'));

                let markedPara = '';
                for (let j = 0; j < sentences.length; j++) {
                  markedPara += `<span class="passage-sentence-hl">${sentences[j]}</span> `;
                }
                paras[paraNum - 1] = markedPara.trim();
                passageHTML = paras.join('\n\n');

                const correctAnswer = (question.correctAnswer || '').trim();
                sentenceOptionsHTML = '<div class="sentence-options-container">' + sentences.map((s, j) => {
                  const isCorrect = s === correctAnswer;
                  return `<div class="sentence-option-row" data-sentence-index="${j}" data-correct="${isCorrect}" onclick="selectSentence(this,${j},${paraNum})">
                    <div class="sentence-number">${j + 1}</div>
                    <div class="sentence-text">${s}</div>
                  </div>`;
                }).join('') + '</div>';
              }
            }

            html = html.replace(/{{PASSAGE_CONTENT}}/g, passageHTML);
            html = html.replace(/{{SENTENCE_OPTIONS_HTML}}/g, sentenceOptionsHTML);
          }

          html = html.replace(/{{QUESTION_TEXT}}/g, question.text);
          html = html.replace(/{{OPTION_A}}/g, question.options.A || '');
          html = html.replace(/{{OPTION_B}}/g, question.options.B || '');
          html = html.replace(/{{OPTION_C}}/g, question.options.C || '');
          html = html.replace(/{{OPTION_D}}/g, question.options.D || '');

          html = html.replace(/{{CORRECT_A}}/g, question.correctAnswer === 'A' ? 'true' : 'false');
          html = html.replace(/{{CORRECT_B}}/g, question.correctAnswer === 'B' ? 'true' : 'false');
          html = html.replace(/{{CORRECT_C}}/g, question.correctAnswer === 'C' ? 'true' : 'false');
          html = html.replace(/{{CORRECT_D}}/g, question.correctAnswer === 'D' ? 'true' : 'false');

          html = html.replace(/{{TIMER_SECONDS}}/g, timerSeconds);

          const pageIdx = getPageIndex(pages, mIdx, task.number, i);
          const backPage = getBackPageFromIndex(pages, pageIdx) || (mIdx === 0 ? 'module1-intro.html' : 'module2-intro.html');
          const nextPage = getNextPageFromIndex(pages, pageIdx);

          html = html.replace(/{{BACK_PAGE}}/g, backPage);
          html = html.replace(/{{NEXT_PAGE}}/g, nextPage);
          html = html.replace(/{{BACK_PAGE_URL}}/g, backPage);
          html = html.replace(/{{NEXT_PAGE_URL}}/g, nextPage);

          html = html.replace(/{{CSP_NONCE}}/g, cspNonce);

          const prefix = `toefl_tpo${tpoNum}_`;
          if (!html.includes(prefix)) {
            html = html.replace(/toefl_/g, prefix);
          }

          const filename = getFilename(mIdx, task.number, i);
          fs.writeFileSync(path.join(readingDir, filename), html);
          generatedFiles.push(filename);
          console.log(`    生成: ${filename} (Q${questionNumber})`);
        }
      }
    }
  }

  // Generate results page
  console.log('\n生成结果页面...');
  const resultsTemplate = templateContent.results;
   
  let html = resultsTemplate;
  html = html.replace(/{{CSP_NONCE}}/g, cspNonce);
  html = html.replace(/{{MODULE1_TITLE}}/g, `Module 1 (Questions ${module1Start}-${module1End})`);
  html = html.replace(/{{MODULE2_TITLE}}/g, `Module 2 (Questions ${module2Start}-${module2End})`);
  html = html.replace(/{{MODULE1_START}}/g, module1Start);
  html = html.replace(/{{MODULE1_END}}/g, module1End);
  html = html.replace(/{{MODULE1_TOTAL}}/g, module1Total);
  html = html.replace(/{{MODULE2_START}}/g, module2Start);
  html = html.replace(/{{MODULE2_END}}/g, module2End);
  html = html.replace(/{{MODULE2_TOTAL}}/g, module2Total);
  html = html.replace(/{{M1_TASK_COUNT}}/g, modules[0].tasks.length);
  html = html.replace(/{{M2_TASK_COUNT}}/g, modules[1].tasks.length);
  html = html.replace(/{{TASK_URL_MAP}}/g, urlMapJson);

  const prefix = `toefl_tpo${tpoNum}_`;
  if (!html.includes(prefix)) {
    html = html.replace(/toefl_/g, prefix);
  }

  const resultsFilename = 'reading_results.html';
  fs.writeFileSync(path.join(readingDir, resultsFilename), html);
  generatedFiles.push(resultsFilename);
  console.log(`  生成: ${resultsFilename}`);

  // Generate static pages
  console.log('\n生成静态页面...');

  let startHtml = templateContent.start;
  startHtml = startHtml.replace(/{{NEXT_PAGE_URL}}/g, 'module1-intro.html');
  startHtml = startHtml.replace(/'toefl_/g, `'toefl_tpo${tpoNum}_`);
  startHtml = startHtml.replace(/"toefl_/g, `"toefl_tpo${tpoNum}_`);
  fs.writeFileSync(path.join(readingDir, 'start.html'), startHtml);
  generatedFiles.push('start.html');
  console.log(`  生成: start.html`);

  let module1IntroHtml = templateContent['module1-intro'];
  module1IntroHtml = module1IntroHtml.replace(/{{FIRST_QUESTION_PAGE}}/g, firstQuestionPage);
  module1IntroHtml = module1IntroHtml.replace(/'toefl_/g, `'toefl_tpo${tpoNum}_`);
  module1IntroHtml = module1IntroHtml.replace(/"toefl_/g, `"toefl_tpo${tpoNum}_`);
  fs.writeFileSync(path.join(readingDir, 'module1-intro.html'), module1IntroHtml);
  generatedFiles.push('module1-intro.html');
  console.log(`  生成: module1-intro.html`);

  let module2IntroHtml = templateContent['module2-intro'];
  module2IntroHtml = module2IntroHtml.replace(/{{FIRST_QUESTION_PAGE}}/g, firstModule2Page);
  module2IntroHtml = module2IntroHtml.replace(/'toefl_/g, `'toefl_tpo${tpoNum}_`);
  module2IntroHtml = module2IntroHtml.replace(/"toefl_/g, `"toefl_tpo${tpoNum}_`);
  fs.writeFileSync(path.join(readingDir, 'module2-intro.html'), module2IntroHtml);
  generatedFiles.push('module2-intro.html');
  console.log(`  生成: module2-intro.html`);

  console.log(`\nTPO ${tpoNum} 生成完成！共生成 ${generatedFiles.length} 个文件`);

  // Inject start time tracking into first question page
  const firstQPath = path.join(readingDir, firstQuestionPage);
  if (fs.existsSync(firstQPath)) {
    let firstQHtml = fs.readFileSync(firstQPath, 'utf8');
    const startTimeKey = prefix + 'reading_start_time';
    const injectScript = '<script>(function(){var k="' + startTimeKey + '";if(!localStorage.getItem(k))localStorage.setItem(k,Date.now());})();<\/script>';
    firstQHtml = firstQHtml.replace('</head>', injectScript + '</head>');
    fs.writeFileSync(firstQPath, firstQHtml, 'utf8');
  }

  return {
    tpoNum,
    title: rawTitle,
    totalFiles: generatedFiles.length,
    questionRange: `${module1Start}-${module2End}`,
    totalQuestions: module1Total + module2Total,
    module1Total,
    module2Total
  };
}

// ===== Generate main index page (Apple style with sidebar) =====
function generateMainIndexPage(tpoSummaries) {
  // Discover listening TPOs from assets/questions/listening/
  const listeningDir = path.join(__dirname, 'assets/questions/listening');
  const listeningTpoNums = new Set();
  if (fs.existsSync(listeningDir)) {
    const entries = fs.readdirSync(listeningDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const match = entry.name.match(/^TPO-(\d+)$/i);
        if (match) listeningTpoNums.add(match[1]);
      }
    }
  }

  // Discover writing TPOs from assets/questions/writing/
  const writingDir = path.join(__dirname, 'assets/questions/writing');
  const writingTpoNums = new Set();
  if (fs.existsSync(writingDir)) {
    const entries = fs.readdirSync(writingDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const match = entry.name.match(/^TPO-(\d+)$/i);
        if (match) writingTpoNums.add(match[1]);
      }
    }
  }

  // Discover reading TPOs from assets/questions/reading/
  const readingDir = path.join(__dirname, 'assets/questions/reading');
  const readingTpoNums = new Set();
  if (fs.existsSync(readingDir)) {
    const entries = fs.readdirSync(readingDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const match = entry.name.match(/^TPO-(\d+)$/i);
        if (match) readingTpoNums.add(match[1]);
      }
    }
  }

  // Discover speaking TPOs from assets/questions/speaking/
  const speakingDir = path.join(__dirname, 'assets/questions/speaking');
  const speakingTpoNums = new Set();
  if (fs.existsSync(speakingDir)) {
    const entries = fs.readdirSync(speakingDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const match = entry.name.match(/^TPO-(\d+)$/i);
        if (match) speakingTpoNums.add(match[1]);
      }
    }
  }

  // Build a map of existing summaries keyed by tpoNum
  const summaryMap = {};
  tpoSummaries.forEach(s => { summaryMap[s.tpoNum] = s; });

  // Union all TPOs discovered from all four modules
  const allTpoNums = new Set([
    ...readingTpoNums,
    ...listeningTpoNums,
    ...writingTpoNums,
    ...speakingTpoNums
  ]);
  allTpoNums.forEach(num => {
    if (!summaryMap[num]) summaryMap[num] = { tpoNum: num };
  });

  // Generate table rows sorted by tpoNum
  const sortedNums = [...allTpoNums].sort((a, b) => parseInt(a) - parseInt(b));
  const tableRows = sortedNums.map(num => {
    const s = summaryMap[num];
    const hasReading = readingTpoNums.has(num);
    const hasListening = listeningTpoNums.has(num);
    const hasWriting = writingTpoNums.has(num);
    const hasSpeaking = speakingTpoNums.has(num);

    const readingCell = hasReading
      ? `<a href="../tpo/${num}/reading/start.html" class="mod-btn available" data-tpo="${num}" data-module="reading">Reading</a>`
      : '<span class="mod-na">&mdash;</span>';

    const listeningCell = hasListening
      ? `<a href="../tpo/${num}/listening/start.html" class="mod-btn available" data-tpo="${num}" data-module="listening">Listening</a>`
      : '<span class="mod-na">&mdash;</span>';

    const writingCell = hasWriting
      ? `<a href="../tpo/${num}/writing/start.html" class="mod-btn available" data-tpo="${num}" data-module="writing">Writing</a>`
      : '<span class="mod-na">&mdash;</span>';

    const speakingCell = hasSpeaking
      ? `<a href="../tpo/${num}/speaking/start.html" class="mod-btn available" data-tpo="${num}" data-module="speaking">Speaking</a>`
      : '<span class="mod-na">&mdash;</span>';

    const reportCell = hasReading
      ? `<a href="../tpo/${num}/reading/reading_results.html?mode=report" class="mod-btn available">测试报告</a>`
      : hasListening
        ? `<a href="../tpo/${num}/listening/listening_results.html" class="mod-btn available">测试报告</a>`
        : hasWriting
          ? `<a href="../tpo/${num}/writing/writing_results.html" class="mod-btn available">测试报告</a>`
          : hasSpeaking
            ? `<a href="../tpo/${num}/speaking/speaking_results.html" class="mod-btn available">测试报告</a>`
            : '<span class="mod-na">&mdash;</span>';

    return `
        <tr>
          <td class="id-cell"><span class="tpo-id">TPO ${num}</span></td>
          <td class="desc-cell">2026 新托福样题</td>
          <td class="module-cell">${readingCell}</td>
          <td class="module-cell">${listeningCell}</td>
          <td class="module-cell">${writingCell}</td>
          <td class="module-cell">${speakingCell}</td>
          <td class="report-cell">${reportCell}</td>
        </tr>`;
  }).join('');

  const indexHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TOEFL iBT Practice</title>
    <link rel="stylesheet" href="font-awesome.css" />
    <link rel="stylesheet" href="styles.css" />
    <style>
      :root {
        --bg: #f5f5f7;
        --surface: #ffffff;
        --text: #1d1d1f;
        --muted: #86868b;
        --teal: #008080;
        --teal-light: rgba(0,128,128,0.08);
        --border: #e5e5e7;
        --sidebar-w: 220px;
        --header-h: 60px;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: var(--bg);
        color: var(--text);
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }

      .app-header {
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        height: var(--header-h);
        display: flex;
        align-items: center;
        padding: 0 28px;
        position: sticky;
        top: 0;
        z-index: 100;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }
      .logo-text {
        font-family: 'Georgia', 'Times New Roman', 'Palatino', serif;
        font-style: italic;
        font-weight: bold;
        font-size: 32px;
        letter-spacing: 1.5px;
        color: var(--teal);
        user-select: none;
      }

      .app-layout {
        display: flex;
        flex: 1;
        min-height: calc(100vh - var(--header-h));
      }

      .sidebar {
        width: var(--sidebar-w);
        background: #fafafa;
        border-right: 1px solid var(--border);
        padding: 20px 0;
        flex-shrink: 0;
        overflow-y: auto;
      }
      .sidebar-section {
        margin-bottom: 12px;
      }
      .sidebar-section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 20px 8px;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--muted);
      }
      .sidebar-section-header i {
        font-size: 14px;
        color: var(--muted);
      }
      .sidebar-nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 20px;
        font-size: 16px;
        font-weight: 450;
        color: var(--text);
        cursor: pointer;
        transition: all 0.15s;
        border-left: 3px solid transparent;
        text-decoration: none !important;
        user-select: none;
      }
      .sidebar-nav-item:hover {
        background: #f0f0f2;
        text-decoration: none !important;
      }
      .sidebar-nav-item.active {
        background: var(--teal-light);
        color: var(--teal);
        font-weight: 600;
        border-left-color: var(--teal);
      }
      .sidebar-nav-item .nav-icon {
        width: 18px;
        text-align: center;
        font-size: 15px;
      }

      .main-content {
        flex: 1;
        padding: 32px 36px;
        overflow-y: auto;
      }

      .panel {
        display: none;
      }
      .panel.active {
        display: block;
      }

      .panel-header {
        margin-bottom: 24px;
      }
      .panel-header h2 {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 4px;
      }
      .panel-header p {
        font-size: 16px;
        color: var(--muted);
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        background: var(--surface);
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid var(--border);
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      }
      .data-table thead {
        background: var(--teal);
      }
      .data-table th {
        color: white;
        font-weight: 600;
        font-size: 15px;
        padding: 14px 16px;
        text-align: center;
        letter-spacing: 0.4px;
        white-space: nowrap;
      }
      .data-table tbody tr {
        border-bottom: 1px solid #f0f0f2;
        transition: background 0.15s;
      }
      .data-table tbody tr:last-child {
        border-bottom: none;
      }
      .data-table tbody tr:hover {
        background: #f9fafb;
      }
      .data-table td {
        padding: 14px 16px;
        text-align: center;
        font-size: 16px;
        color: var(--text);
      }
      .data-table .id-cell {
        text-align: left;
        padding-left: 20px;
      }
      .tpo-id {
        font-weight: 600;
        font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
        font-size: 15px;
        color: var(--teal);
      }
      .desc-cell {
        text-align: left;
        color: #333;
        font-size: 15px;
      }
      .mod-btn {
        display: inline-block;
        padding: 6px 18px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.15s;
        cursor: pointer;
        min-width: 90px;
        text-align: center;
      }
      .mod-btn.available {
        background: var(--teal);
        color: white;
      }
      .mod-btn.available:hover {
        background: #006666;
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(0,128,128,0.25);
        text-decoration: none !important;
        color: white;
      }
      .mod-na {
        color: #c0c0c0;
        font-size: 16px;
        user-select: none;
      }
      .report-link {
        color: var(--muted);
        font-size: 15px;
        text-decoration: none;
        transition: color 0.15s;
      }
      .report-link:hover {
        color: var(--teal);
        text-decoration: underline;
      }

      .empty-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 20px;
        text-align: center;
      }
      .empty-panel .empty-icon {
        font-size: 50px;
        margin-bottom: 16px;
        color: #d0d0d0;
      }
      .empty-panel h3 {
        font-size: 20px;
        font-weight: 600;
        color: #999;
      }
      .empty-panel p {
        font-size: 16px;
        color: #bbb;
        margin-top: 6px;
      }

      /* Modal */
      .modal-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.35);
        z-index: 200;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }
      .modal-overlay.open {
        display: flex;
      }
      .modal-card {
        background: var(--surface);
        border-radius: 14px;
        width: 760px;
        max-width: 92vw;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 20px 50px rgba(0,0,0,0.18);
        padding: 0;
      }
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 24px;
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        background: var(--surface);
        z-index: 1;
      }
      .modal-header h3 {
        font-size: 19px;
        font-weight: 700;
      }
      .modal-close {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: none;
        background: #f0f0f2;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        color: var(--muted);
        transition: all 0.15s;
      }
      .modal-close:hover {
        background: #e0e0e2;
        color: var(--text);
      }
      .modal-body {
        padding: 24px;
        font-size: 16px;
        line-height: 1.7;
        color: #444;
      }
      .modal-body .log-entry {
        padding: 10px 0;
        border-bottom: 1px solid #f0f0f2;
      }
      .modal-body .log-entry:last-child {
        border-bottom: none;
      }
      .log-version {
        font-weight: 700;
        color: var(--teal);
        font-size: 15px;
        margin-bottom: 4px;
      }
      .log-date {
        font-size: 13px;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .log-detail {
        font-size: 15px;
        color: #555;
        line-height: 1.6;
      }

      .modal-body h4 {
        font-size: 17px;
        font-weight: 700;
        color: var(--text);
        margin: 18px 0 8px;
      }
      .modal-body h4:first-child {
        margin-top: 0;
      }
      .modal-body .info-table {
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0 16px;
        font-size: 15px;
        border: 1px solid var(--border);
        border-radius: 6px;
        overflow: hidden;
      }
      .modal-body .info-table thead {
        background: var(--teal);
      }
      .modal-body .info-table thead th {
        color: white;
        font-weight: 600;
        padding: 8px 12px;
        text-align: center;
        font-size: 14px;
      }
      .modal-body .info-table tbody td {
        padding: 7px 12px;
        border-bottom: 1px solid #f0f0f2;
        text-align: center;
      }
      .modal-body .info-table tbody tr:last-child td {
        border-bottom: none;
      }
      .modal-body ul {
        margin: 6px 0 12px 18px;
        color: #444;
        line-height: 1.8;
        font-size: 15px;
      }
      .modal-body .note {
        font-size: 14px;
        color: #999;
        margin-top: 16px;
        border-top: 1px solid var(--border);
        padding-top: 12px;
      }
      .modal-body .img-block {
        text-align: center;
        margin: 16px 0;
      }
      .modal-body .img-block img {
        width: 240px;
        border-radius: 8px;
        border: 1px solid var(--border);
        display: block;
        margin: 0 auto 6px;
      }
      .modal-body .img-block .img-label {
        font-size: 14px;
        color: var(--muted);
      }

      @media (max-width: 768px) {
        .sidebar { display: none; }
        .main-content { padding: 20px 12px; }
        .data-table { font-size: 14px; }
        .data-table th, .data-table td { padding: 10px 8px; }
      }

      .practice-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.35);
        z-index: 300;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }
      .practice-overlay.open {
        display: flex;
      }
      .practice-box {
        background: var(--surface);
        border-radius: 14px;
        width: 460px;
        max-width: 92vw;
        padding: 28px 30px 24px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.18);
        position: relative;
      }
      .practice-box h2 {
        font-size: 20px;
        font-weight: 700;
        color: var(--text);
        margin: 0 0 6px;
        text-align: center;
      }
      .practice-box .practice-sub {
        font-size: 15px;
        color: var(--muted);
        text-align: center;
        margin: 0 0 20px;
      }
      .practice-option-card {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 18px;
        border-radius: 10px;
        border: 1px solid var(--border);
        margin-bottom: 10px;
        cursor: pointer;
        transition: all 0.15s;
        text-decoration: none;
        color: var(--text);
      }
      .practice-option-card:last-child {
        margin-bottom: 0;
      }
      .practice-option-card.active:hover {
        border-color: var(--teal);
        box-shadow: 0 2px 10px rgba(0,128,128,0.1);
      }
      .practice-option-card.danger.active:hover {
        border-color: #dc3545;
        box-shadow: 0 2px 10px rgba(220,53,69,0.12);
      }
      .practice-option-card .opt-icon {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        flex-shrink: 0;
      }
      .practice-option-card.active .opt-icon {
        background: rgba(0,128,128,0.1);
        color: var(--teal);
      }
      .practice-option-card.danger.active .opt-icon {
        background: rgba(220,53,69,0.1);
        color: #dc3545;
      }
      .practice-option-card .opt-body {
        flex: 1;
      }
      .practice-option-card .opt-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
      }
      .practice-option-card .opt-hint {
        font-size: 14px;
        color: var(--muted);
        margin-top: 2px;
      }
      .practice-option-card.disabled {
        opacity: 0.4;
        cursor: not-allowed;
        pointer-events: none;
      }
      .practice-option-card.disabled .opt-icon {
        background: #f0f0f2;
        color: #bbb;
      }
      .practice-option-card.disabled .opt-title {
        color: #bbb;
      }

      /* ===== Nav Badge ===== */
      .nav-badge {
        margin-left: auto;
        background: #ff3b30;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        min-width: 18px;
        height: 18px;
        border-radius: 9px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 5px;
        line-height: 1;
      }

      /* ===== Update Banner ===== */
      .update-banner { margin-bottom: 24px; }
      .update-card {
        background: #fff;
        border-radius: 12px;
        border: 1px solid #e5e5ea;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      }
      .update-card-header {
        padding: 20px 20px 0;
        display: flex; align-items: flex-start; gap: 12px;
      }
      .update-card-dot {
        width: 10px; height: 10px; border-radius: 50%;
        background: #ff3b30; flex-shrink: 0; margin-top: 7px;
      }
      .update-card-info { flex: 1; min-width: 0; }
      .update-card-version {
        font-size: 17px; font-weight: 600; color: #1d1d1f; margin-bottom: 2px;
      }
      .update-card-date { font-size: 13px; color: #86868b; margin-bottom: 6px; }
      .update-card-summary { font-size: 14px; color: #555; line-height: 1.5; }
      .update-card-footer {
        padding: 16px 20px; border-top: 1px solid #f0f0f2;
        margin-top: 16px; display: flex; align-items: center; justify-content: space-between;
      }
      .update-download-btn {
        background: var(--teal); color: #fff; border: none;
        padding: 10px 24px; border-radius: 8px;
        font-size: 14px; font-weight: 600; cursor: pointer;
        transition: background 0.2s;
      }
      .update-download-btn:hover { background: #006666; }
      .update-download-btn:disabled { background: #a0d0d0; cursor: default; }
      .update-download-btn.done { background: #34c759; }
      .update-progress {
        font-size: 13px; color: #86868b;
        font-variant-numeric: tabular-nums;
      }
    </style>
  </head>
  <body>
    <header class="app-header">
      <span class="logo-text">Toefl</span>
    </header>

    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-section">
          <div class="sidebar-section-header"><i class="fas fa-layer-group"></i> 题目</div>
          <div class="sidebar-nav-item active" data-panel="mock">
            <span class="nav-icon"><i class="fas fa-pencil-alt"></i></span> 模考
          </div>
          <div class="sidebar-nav-item" data-panel="real">
            <span class="nav-icon"><i class="fas fa-scroll"></i></span> 真题
          </div>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-section-header"><i class="fas fa-ellipsis-h"></i> 其他</div>
          <div class="sidebar-nav-item" data-modal="modalNews">
            <span class="nav-icon"><i class="fas fa-newspaper"></i></span> 托福动态
          </div>
          <div class="sidebar-nav-item" data-modal="modalAbout">
            <span class="nav-icon"><i class="fas fa-handshake"></i></span> 关注/合作
          </div>
          <div class="sidebar-nav-item" data-modal="modalLog">
            <span class="nav-icon"><i class="fas fa-history"></i></span> 日志
            <span class="nav-badge" id="update-badge" style="display:none;">1</span>
          </div>
        </div>
      </aside>

      <main class="main-content">
        <div class="panel active" id="panel-mock">
          <div class="panel-header">
            <h2>模考</h2>
            <p>2026年reform ETS官方样题 &middot; official</p>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="text-align:left;padding-left:20px;">ID</th>
                <th>描述</th>
                <th>阅读</th>
                <th>听力</th>
                <th>写作</th>
                <th>口语</th>
                <th>测试报告</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>

        <div class="panel" id="panel-real">
          <div class="empty-panel">
            <div class="empty-icon"><i class="fas fa-inbox"></i></div>
            <h3>真题数据即将上线</h3>
            <p>敬请期待</p>
          </div>
        </div>
      </main>
    </div>

    <div class="modal-overlay" id="modalNews">
      <div class="modal-card">
        <div class="modal-header">
          <h3><i class="fas fa-newspaper"></i> 托福动态</h3>
          <button class="modal-close" onclick="closeModal('modalNews')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <h4>2026年1月21日 · 托福iBT改革要点</h4>
          <p style="font-size:13px;color:#555;line-height:1.7;">新版托福 iBT 采用<strong>多阶段自适应（multistage）</strong>形式，考试顺序固定为：阅读 → 听力 → 写作 → 口语。</p>

          <h4>考试题量与时长</h4>
          <table class="info-table">
            <thead><tr><th>考试部分</th><th>题型数量</th><th>预估时长</th></tr></thead>
            <tbody>
              <tr><td>阅读（自适应）</td><td>35–48 题</td><td>约 18–27 分钟</td></tr>
              <tr><td>听力（自适应）</td><td>35–45 题</td><td>约 18–27 分钟</td></tr>
              <tr><td>写作</td><td>12 题</td><td>约 23 分钟</td></tr>
              <tr><td>口语</td><td>12 题</td><td>约 8 分钟</td></tr>
            </tbody>
          </table>

          <h4>各部分任务类型</h4>
          <p style="font-size:13px;color:#333;font-weight:600;">阅读</p>
          <ul><li>Complete the Words（补全单词）</li><li>Read in Daily Life（日常生活阅读）</li><li>Read an Academic Passage（学术文章阅读）</li></ul>
          <p style="font-size:13px;color:#333;font-weight:600;">听力</p>
          <ul><li>Listen and Choose a Response</li><li>Listen to a Conversation</li><li>Listen to an Announcement</li><li>Listen to an Academic Talk</li></ul>
          <p style="font-size:13px;color:#333;font-weight:600;">写作</p>
          <ul><li>Build a Sentence（造句）</li><li>Write an Email（写邮件）</li><li>Write for an Academic Discussion（学术讨论写作）</li></ul>
          <p style="font-size:13px;color:#333;font-weight:600;">口语</p>
          <ul><li>Listen and Repeat（听并复述）</li><li>Take an Interview（面试式问答）</li></ul>

          <h4>评分体系</h4>
          <p style="font-size:13px;color:#555;line-height:1.7;">采用<strong>1–6 分制分段评分</strong>，与 CEFR 直接对齐。四个单项及总分均以 <strong>0.5 分为增量</strong>，总分由四项平均值计算得出。成绩报告包含 <strong>MyBest® 分数</strong>（过去 2 年内各单项最高分平均值）。</p>

          <h4>原始分与 1–6 分制对照</h4>
          <table class="info-table">
            <thead><tr><th>考试部分</th><th>原始分范围</th><th>1–6 分制范围</th></tr></thead>
            <tbody>
              <tr><td>阅读</td><td>0–35</td><td>1–6</td></tr>
              <tr><td>听力</td><td>0–30</td><td>1–6</td></tr>
              <tr><td>写作</td><td>0–15</td><td>1–6</td></tr>
              <tr><td>口语</td><td>0–50</td><td>1–6</td></tr>
            </tbody>
          </table>

          <h4>CEFR 等级对应</h4>
          <table class="info-table">
            <thead><tr><th>CEFR</th><th>阅读</th><th>听力</th><th>写作</th><th>口语</th><th>总分</th></tr></thead>
            <tbody>
              <tr><td>C2</td><td>6</td><td>6</td><td>6</td><td>6</td><td>6</td></tr>
              <tr><td>C1</td><td>5–5.5</td><td>5–5.5</td><td>5–5.5</td><td>5–5.5</td><td>5–5.5</td></tr>
              <tr><td>B2</td><td>4–4.5</td><td>4–4.5</td><td>4–4.5</td><td>4–4.5</td><td>4–4.5</td></tr>
              <tr><td>B1</td><td>3–3.5</td><td>3–3.5</td><td>3–3.5</td><td>3–3.5</td><td>3–3.5</td></tr>
              <tr><td>A2</td><td>2–2.5</td><td>2–2.5</td><td>2–2.5</td><td>2–2.5</td><td>2–2.5</td></tr>
              <tr><td>A1</td><td>1–1.5</td><td>1–1.5</td><td>1–1.5</td><td>1–1.5</td><td>1–1.5</td></tr>
            </tbody>
          </table>

          <h4>新旧分制换算（1–6 ↔ 0–30/0–120）</h4>
          <table class="info-table">
            <thead><tr><th>新制</th><th>阅读(0–30)</th><th>听力(0–30)</th><th>写作(0–30)</th><th>口语(0–30)</th><th>总分(0–120)</th></tr></thead>
            <tbody>
              <tr><td>6</td><td>29–30</td><td>28–30</td><td>29–30</td><td>28–30</td><td>114–120</td></tr>
              <tr><td>5.5</td><td>26–28</td><td>26–27</td><td>27–28</td><td>27</td><td>106–113</td></tr>
              <tr><td>5</td><td>24–25</td><td>22–25</td><td>24–26</td><td>25–26</td><td>95–105</td></tr>
              <tr><td>4.5</td><td>21–23</td><td>19–21</td><td>23</td><td>23–24</td><td>86–94</td></tr>
              <tr><td>4</td><td>18–20</td><td>17–18</td><td>17–22</td><td>20–22</td><td>72–85</td></tr>
              <tr><td>3.5</td><td>12–17</td><td>13–16</td><td>15–16</td><td>18–19</td><td>58–71</td></tr>
              <tr><td>3</td><td>6–11</td><td>9–12</td><td>13–14</td><td>16–17</td><td>44–57</td></tr>
              <tr><td>2.5</td><td>4–5</td><td>6–8</td><td>11–12</td><td>14–15</td><td>35–43</td></tr>
              <tr><td>2</td><td>3</td><td>4–5</td><td>7–10</td><td>10–13</td><td>24–34</td></tr>
              <tr><td>1.5</td><td>2</td><td>2–3</td><td>3–6</td><td>5–9</td><td>12–23</td></tr>
              <tr><td>1</td><td>1–1.5</td><td>0–1</td><td>0–2</td><td>0–4</td><td>0–11</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="modalAbout">
      <div class="modal-card">
        <div class="modal-header">
          <h3><i class="fas fa-handshake"></i> 关注/合作</h3>
          <button class="modal-close" onclick="closeModal('modalAbout')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <p>本软件由 AI 辅助开发，致力于为托福考生提供高质量的模拟练习体验。</p>

          <h4><i class="fab fa-weixin" style="color:#07C160;"></i> 微信平台</h4>
          <p style="font-size:13px;color:#555;">扫描下方二维码添加好友</p>
          <div class="img-block">
            <img src="assets/images/wechat-qr.jpg" alt="微信二维码" />
            <div class="img-label">扫码添加好友</div>
          </div>

          <h4><i class="fab fa-x-twitter"></i> X 社交平台</h4>
          <p style="font-size:13px;color:#555;">访问我的个人主页</p>
          <div class="img-block">
            <img src="assets/images/x-profile.jpg" alt="X 平台主页" />
            <div class="img-label">访问主页</div>
          </div>

          <h4><i class="fas fa-book-open" style="color:#FF2442;"></i> 小红书</h4>
          <p style="font-size:13px;color:#555;">关注我的小红书账号</p>
          <div class="img-block">
            <img src="assets/images/rednote-qr.jpg" alt="小红书二维码" />
            <div class="img-label">扫码关注</div>
          </div>

          <p class="note">如有合作意向或反馈建议，请通过以上方式联系我们。</p>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="modalLog">
      <div class="modal-card">
        <div class="modal-header">
          <h3><i class="fas fa-history"></i> 更新日志</h3>
          <button class="modal-close" onclick="closeModal('modalLog')"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="update-banner" id="update-banner" style="display:none;">
            <div class="update-card">
              <div class="update-card-header">
                <span class="update-card-dot"></span>
                <div class="update-card-info">
                  <div class="update-card-version">V<span id="update-version"></span></div>
                  <div class="update-card-date" id="update-release-date"></div>
                  <div class="update-card-summary" id="update-desc"></div>
                </div>
              </div>
              <div class="update-card-footer">
                <button class="update-download-btn" id="update-btn">
                  <span id="update-btn-text">下载并安装</span>
                </button>
                <span class="update-progress" id="update-progress" style="display:none;"></span>
              </div>
            </div>
          </div>
          <div class="log-entry">
            <div class="log-version">V1.1.3</div>
            <div class="log-date">2026-06-18</div>
            <div class="log-detail">正式打通自动更新全流程。App 更新与内容更新均走日志卡片 → 下载进度 → 安装可见流程。清理历史构建残留。</div>
          </div>
          <div class="log-entry">
            <div class="log-version">V1.1.2</div>
            <div class="log-date">2026-06-18</div>
            <div class="log-detail">修复 App 更新功能（process.env.NODE_ENV → app.isPackaged）。验证自动更新日志流程，为后续版本提供可靠基础。</div>
          </div>
          <div class="log-entry">
            <div class="log-version">V1.1.1</div>
            <div class="log-date">2026-06-18</div>
            <div class="log-detail">优化更新体验：App 更新与内容更新统一走日志卡片 → 下载进度 → 安装可见流程。内容更新下载去重（仅写 userData），已有文件自动跳过并同步版本号，消除红圈误弹。添加协议拦截器实现图片资源回退加载。</div>
          </div>
          <div class="log-entry">
            <div class="log-version">V1.1.0</div>
            <div class="log-date">2026-06-18</div>
            <div class="log-detail">修复 5 项问题：Listening/Reading 答案存储隔离、Speaking 录音计时与权限、继续练习路径、LCAR 题型 Help 按钮、Result 全对检测与庆祝动画。新增四模块 localStorage 前缀隔离，优化 Clear & Exit 逻辑与 Speaking 录音体验，添加 Electron 麦克风预授权。</div>
          </div>
          <div class="log-entry">
            <div class="log-version">V1.0.0</div>
            <div class="log-date">2026-06</div>
            <div class="log-detail">首个正式版本。全面支持 TPO 模考，涵盖阅读、听力、写作、口语全科练习。实现答题计时、自动保存、结果统计、错题回顾等核心功能。采用 Electron 桌面应用架构，支持自动更新。</div>
          </div>
          <div class="log-entry">
            <div class="log-version">V0.0（测试版）</div>
            <div class="log-date">2026-05</div>
            <div class="log-detail">初始版本正式发布。核心功能上线：全面支持 TPO 模考，涵盖阅读、听力、写作、口语全科练习。</div>
            <div class="log-detail" style="margin-top:8px;">开发者寄语：本版本为初版测试，旨在为考生提供高效的模考体验。一切内容以后续测试者的实际反馈为准，我们将持续进行优化与改进。</div>
          </div>
          <p class="note">很荣幸为您服务。</p>
        </div>
      </div>
    </div>

    <script>
      function switchPanel(panelName) {
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        const target = document.getElementById('panel-' + panelName);
        if (target) target.classList.add('active');
      }

      function openModal(id) {
        document.getElementById(id).classList.add('open');
      }

      function closeModal(id) {
        document.getElementById(id).classList.remove('open');
      }

      document.querySelectorAll('.sidebar-nav-item').forEach(item => {
        item.addEventListener('click', function() {
          const panel = this.dataset.panel;
          const modal = this.dataset.modal;

          if (panel) {
            document.querySelectorAll('.sidebar-nav-item[data-panel]').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            switchPanel(panel);
          }

          if (modal) {
            openModal(modal);
          }
        });
      });

      document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
          if (e.target === this) closeModal(this.id);
        });
      });

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
        }
      });

      (function() {
        function hasSavedProgress(tpoNum) {
          var prefix = 'toefl_tpo' + tpoNum + '_';
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k.indexOf(prefix) === 0 && k.indexOf('resume_page') === -1) return true;
          }
          return false;
        }

        function clearTpoData(tpoNum) {
          var prefix = 'toefl_tpo' + tpoNum + '_';
          var keys = [];
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && k.indexOf(prefix) === 0) keys.push(k);
          }
          keys.forEach(function(k) { localStorage.removeItem(k); });
        }

        function showPracticeModal(tpoNum, moduleName, targetUrl, hasData) {
          var overlay = document.createElement('div');
          overlay.className = 'practice-overlay open';

          var box = document.createElement('div');
          box.className = 'practice-box';

          var closeBtn = document.createElement('button');
          closeBtn.className = 'modal-close';
          closeBtn.style.cssText = 'position:absolute;top:12px;right:14px;';
          closeBtn.innerHTML = '<i class="fas fa-times"></i>';
          closeBtn.onclick = function() { overlay.remove(); };
          box.appendChild(closeBtn);

          var h2 = document.createElement('h2');
          h2.textContent = 'TPO ' + tpoNum + ' \u00b7 ' + (moduleName === 'reading' ? 'Reading' : moduleName);
          box.appendChild(h2);

          var sub = document.createElement('div');
          sub.className = 'practice-sub';
          sub.textContent = hasData ? '\u68c0\u6d4b\u5230\u5df2\u6709\u7b54\u9898\u8bb0\u5f55\uff0c\u8bf7\u9009\u62e9\u7ec3\u4e60\u6a21\u5f0f' : '\u8bf7\u9009\u62e9\u7ec3\u4e60\u6a21\u5f0f';
          box.appendChild(sub);

          function makeOption(title, hint, cls, enabled, onClick) {
            var card = document.createElement('div');
            card.className = 'practice-option-card' + (enabled ? ' ' + cls + ' active' : ' disabled');

            var icon = document.createElement('div');
            icon.className = 'opt-icon';
            icon.innerHTML = enabled ? (cls === 'danger' ? '<i class="fas fa-redo-alt"></i>' : '<i class="fas fa-play"></i>') : '<i class="fas fa-lock"></i>';
            card.appendChild(icon);

            var body = document.createElement('div');
            body.className = 'opt-body';
            var t = document.createElement('div');
            t.className = 'opt-title';
            t.textContent = title;
            body.appendChild(t);
            var h = document.createElement('div');
            h.className = 'opt-hint';
            h.textContent = hint;
            body.appendChild(h);
            card.appendChild(body);

            if (enabled) {
              card.addEventListener('click', function() {
                overlay.remove();
                onClick();
              });
            }

            return card;
          }

          box.appendChild(makeOption('\u5f00\u59cb\u7ec3\u4e60', '\u5168\u65b0\u5f00\u59cb\uff0c\u4ece\u7b2c\u4e00\u9898\u505a\u8d77', '', true, function() {
            clearTpoData(tpoNum);
            window.location.href = targetUrl;
          }));

          box.appendChild(makeOption('\u7ee7\u7eed\u7ec3\u4e60', '\u4ece\u4e0a\u6b21\u9000\u51fa\u7684\u4f4d\u7f6e\u7ee7\u7eed\u7b54\u9898', '', hasData, function() {
            var resumePage = localStorage.getItem('toefl_tpo' + tpoNum + '_' + moduleName + '_resume_page');
            window.location.href = resumePage ? '../tpo/' + tpoNum + '/' + moduleName + '/' + resumePage : targetUrl;
          }));

          box.appendChild(makeOption('\u91cd\u65b0\u7ec3\u4e60', '\u6e05\u9664\u5f53\u524d\u8bb0\u5f55\uff0c\u5168\u65b0\u5f00\u59cb', 'danger', hasData, function() {
            clearTpoData(tpoNum);
            window.location.href = targetUrl;
          }));

          overlay.appendChild(box);
          document.body.appendChild(overlay);

          overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
          });
        }

        document.querySelectorAll('.mod-btn.available[data-tpo]').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            var tpoNum = this.dataset.tpo;
            var targetUrl = this.getAttribute('href');
            var hasData = hasSavedProgress(tpoNum);
            showPracticeModal(tpoNum, this.dataset.module, targetUrl, hasData);
          });
        });
      })();
    </script>
    <script>
      (function() {
        console.log('[update] script loaded, electronAPI:', typeof window.electronAPI);

        var domReady = false;
        var els = {};
        function el(id) {
          if (!els[id]) els[id] = document.getElementById(id);
          return els[id];
        }

        function showBadge(n) {
          var b = el('update-badge');
          if (!b) { console.log('[update] badge element not found'); return; }
          b.textContent = String(n || 1);
          b.style.display = 'inline-flex';
          console.log('[update] badge shown:', n || 1);
        }
        function hideBadge() {
          var b = el('update-badge');
          if (b) b.style.display = 'none';
        }

        if (typeof window.electronAPI === 'undefined') {
          console.log('[update] electronAPI not available, stopping');
          return;
        }

        var pendingUpdateType = null;

        window.electronAPI.onUpdateAvailable(function(info) {
          console.log('[update] onUpdateAvailable:', info);
          pendingUpdateType = 'app';
          var currentVersion = localStorage.getItem('toefl_last_seen_version') || '1.0.0';
          var latestVersion = (info && info.version) || '';
          fetch('https://api.github.com/repos/anton-bis/toefl-app/releases?per_page=20')
            .then(function(r) { return r.json(); })
            .then(function(releases) {
              var missed = 0;
              if (Array.isArray(releases)) {
                for (var i = 0; i < releases.length; i++) {
                  var tag = releases[i].tag_name || '';
                  var ver = tag.replace(/^v/i, '');
                  if (compareVersion(ver, currentVersion) > 0 && compareVersion(ver, latestVersion) <= 0) missed++;
                }
              }
              showBadge(missed || 1);
            })
            .catch(function() { showBadge(1); });
          var savedVersion = localStorage.getItem('toefl_last_seen_version');
          if (savedVersion && latestVersion && compareVersion(latestVersion, savedVersion) <= 0) { hideBadge(); updatePending = false; }
          var uv = el('update-version'); if (uv) uv.textContent = latestVersion;
          var ud = el('update-release-date'); if (ud) ud.textContent = (info && info.releaseDate) ? info.releaseDate : '';
          var us = el('update-desc'); if (us) us.textContent = '包含重要修复和优化，建议立即更新';
          var ub = el('update-banner'); if (ub) ub.style.display = 'block';
          var btn = el('update-btn'); if (btn) { btn.disabled = false; el('update-btn-text').textContent = '下载并安装'; }
        });

        window.electronAPI.onUpdateProgress(function(progress) {
          var up = el('update-progress');
          if (up) { up.style.display = 'inline'; up.textContent = Math.round(progress.percent) + '%'; }
        });

        window.electronAPI.onUpdateDownloaded(function(info) {
          var btn = el('update-btn');
          if (btn) { btn.classList.add('done'); el('update-btn-text').textContent = '安装并重启'; }
          var up = el('update-progress'); if (up) up.style.display = 'none';
          var us = el('update-desc'); if (us) us.textContent = '下载完成，点击按钮安装更新';
          localStorage.setItem('toefl_last_seen_version', (info && info.version) || '');
        });

        window.electronAPI.onUpdateError(function(err) {
          var us = el('update-desc');
          if (us) us.textContent = '更新失败：' + ((typeof err === 'string') ? err : (err && err.message || '未知错误'));
          var btn = el('update-btn'); if (btn) { el('update-btn-text').textContent = '重试'; btn.disabled = false; }
        });

        var btnRef = el('update-btn');
        if (btnRef) {
          btnRef.addEventListener('click', function() {
            if (btnRef.classList.contains('done')) {
              window.electronAPI.quitAndInstall();
            } else if (pendingUpdateType === 'content') {
              btnRef.disabled = true;
              el('update-btn-text').textContent = '下载中...';
              var us = el('update-desc'); if (us) us.textContent = '正在下载内容，请稍候';
              window.electronAPI.applyContentUpdate().then(function(r) {
                if (r && r.version) {
                  btnRef.classList.add('done');
                  el('update-btn-text').textContent = '已完成';
                  var up = el('update-progress'); if (up) up.style.display = 'none';
                  var us2 = el('update-desc'); if (us2) us2.textContent = '内容更新完成，共 ' + (r.results ? r.results.length : 0) + ' 个文件';
                } else {
                  el('update-btn-text').textContent = '重试';
                  btnRef.disabled = false;
                }
              }).catch(function() {
                el('update-btn-text').textContent = '重试';
                btnRef.disabled = false;
              });
            } else {
              btnRef.disabled = true;
              el('update-btn-text').textContent = '下载中...';
              var us2 = el('update-desc'); if (us2) us2.textContent = '正在下载更新，请稍候';
              window.electronAPI.downloadUpdate();
            }
          });
        }

        window.electronAPI.onContentUpdateAvailable(function(result) {
          console.log('[update] onContentUpdateAvailable:', result);
          pendingUpdateType = 'content';
          if (result && result.hasUpdate) {
            showBadge(result.updateCount || 1);
            var ub = el('update-banner'); if (ub) ub.style.display = 'block';
            var uv = el('update-version'); if (uv) uv.textContent = 'Content';
            var us = el('update-desc'); if (us) us.textContent = '有新题目内容可用，点击立即更新';
          }
        });

        document.addEventListener('DOMContentLoaded', function() {
          domReady = true;
          console.log('[update] DOM ready, checking content update...');
          setTimeout(function() {
            try {
              window.electronAPI.checkContentUpdate().then(function(result) {
                console.log('[update] checkContentUpdate result:', result);
                if (result && result.hasUpdate) {
                  pendingUpdateType = 'content';
                  window.electronAPI.applyContentUpdate().then(function(r) {
                    var allCached = r && r.results && r.results.every(function(x) { return x.cached; });
                    if (allCached) {
                      console.log('[update] content already cached, version synced');
                      return;
                    }
                    showBadge(result.updateCount || 1);
                    var ub = el('update-banner'); if (ub) ub.style.display = 'block';
                    var uv = el('update-version'); if (uv) uv.textContent = 'Content';
                    var us = el('update-desc'); if (us) us.textContent = '有新题目内容可用，点击立即更新';
                  }).catch(function() {
                    showBadge(result.updateCount || 1);
                    var ub = el('update-banner'); if (ub) ub.style.display = 'block';
                    var uv = el('update-version'); if (uv) uv.textContent = 'Content';
                    var us = el('update-desc'); if (us) us.textContent = '有新题目内容可用，点击立即更新';
                  });
                }
              }).catch(function(e) { console.log('[update] checkContentUpdate error:', e); });
            } catch (_) { console.log('[update] checkContentUpdate exception'); }
          }, 2000);
        });

        function compareVersion(a, b) {
          var pa = String(a).split('.').map(Number);
          var pb = String(b).split('.').map(Number);
          for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
            var na = pa[i] || 0, nb = pb[i] || 0;
            if (na > nb) return 1;
            if (na < nb) return -1;
          }
          return 0;
        }

        // Dismiss badge when user opens the log
        document.querySelector('[data-modal="modalLog"]').addEventListener('click', function() {
          hideBadge();
          var uv = el('update-version');
          if (uv && uv.textContent) {
            localStorage.setItem('toefl_last_seen_version', uv.textContent.replace(/^Content$/, ''));
          }
        });
      })();
    </script>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`;

  fs.writeFileSync(path.join(__dirname, 'index.html'), indexHtml);
  console.log('\n生成主索引页面: index.html');
}

// ===== Main execution =====
console.log(`模式: ${tpoMode === 'all' ? '生成所有TPO' : tpoMode === 'specific' ? `生成TPO ${tpoNumber}` : '默认生成TPO 01'}`);

const tpoSummaries = [];

for (const { filename, tpoNum } of filesToProcess) {
  const markdownFile = path.join(questionsDir, filename);
  const summary = generateTPO(tpoNum, markdownFile);
  tpoSummaries.push(summary);
}

console.log('\n生成主索引页面...');
generateMainIndexPage(tpoSummaries);

console.log(`\n全部完成！共处理 ${tpoSummaries.length} 个TPO`);
