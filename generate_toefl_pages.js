import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CLI argument parsing =====
const args = process.argv.slice(2);
let tpoMode = 'single';
let tpoNumber = '01';

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

const allTpoFiles = fs.readdirSync(questionsDir).filter(file =>
  file.endsWith('.md') && file.startsWith('reading-TPO-')
);

if (allTpoFiles.length === 0) {
  console.error('未找到题库文件！');
  process.exit(1);
}

console.log('可用的题库文件:', allTpoFiles.map(f => f.replace(/reading-TPO-(\d+)\.md/, 'TPO $1')));

let filesToProcess = [];
if (tpoMode === 'all') {
  filesToProcess = allTpoFiles.map(f => ({
    filename: f,
    tpoNum: f.match(/reading-TPO-(\d+)\.md/)?.[1] || '01'
  }));
} else {
  const targetFile = allTpoFiles.find(f => f.includes(`reading-TPO-${tpoNumber}`));
  if (!targetFile) {
    console.error(`未找到TPO ${tpoNumber}的题库文件！`);
    process.exit(1);
  }
  filesToProcess.push({ filename: targetFile, tpoNum: tpoNumber });
}

// ===== Templates definition =====
const TEMPLATES = {
  fill: {
    path: path.join(__dirname, 'templates/fill-in-missing-letters/template.html')
  },
  email: {
    path: path.join(__dirname, 'templates/read-an-email/template.html')
  },
  textchain: {
    path: path.join(__dirname, 'templates/read-a-text-chain/template.html')
  },
  academic: {
    path: path.join(__dirname, 'templates/read-academic-passage/template.html')
  },
  start: {
    path: path.join(__dirname, 'templates/general/start-page-template.html')
  },
  'module1-intro': {
    path: path.join(__dirname, 'templates/general/module1-intro-template.html')
  },
  'module2-intro': {
    path: path.join(__dirname, 'templates/general/module2-intro-template.html')
  },
  results: {
    path: path.join(__dirname, 'templates/general/results-page-template.html')
  }
};

// ===== Load templates - DO NOT modify CSS links, preserve template exactly =====
const templateContent = {};
for (const [key, config] of Object.entries(TEMPLATES)) {
  if (!fs.existsSync(config.path)) {
    console.warn(`模板文件不存在: ${config.path}`);
    continue;
  }
  // Read template AS-IS, preserve all its internal styles
  const html = fs.readFileSync(config.path, 'utf-8');

  // Only fix relative CSS paths - templates use href="styles.css" or href="../../styles.css"
  // For generated pages in tpo/XX/reading/, the correct path back to root is ../../
  // We leave template's own <style> blocks completely untouched
  if (key === 'fill' || key === 'email' || key === 'textchain' || key === 'academic') {
    // These templates have href="../../styles.css", keep as-is since they'll be in tpo/XX/reading/
    templateContent[key] = html;
  } else {
    // start, module-intro, results use href="styles.css" - need to become ../../styles.css for tpo/XX/reading/
    templateContent[key] = html.replace(/href="styles\.css"/g, 'href="../../styles.css"');
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
<div class="message-bubble ${m.isSent ? 'sent' : 'received'}">
  <div class="message-header">
    <div class="message-sender ${m.isSent ? 'sent' : ''}">${m.sender}</div>
    <div class="message-time ${m.isSent ? 'sent' : ''}">${m.time}</div>
  </div>
  <div class="message-text">${m.text}</div>
</div>`)
    .join('\n');
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

  const markdownText = fs.readFileSync(markdownFile, 'utf-8');
  const modules = parseMarkdown(markdownText);

  console.log(`解析完成: ${modules.length} 个模块`);
  console.log(`模块1: ${modules[0]?.tasks.length} 个任务`);
  console.log(`模块2: ${modules[1]?.tasks.length} 个任务`);

  const tpoDir = path.join(__dirname, 'tpo', tpoNum);
  const readingDir = path.join(tpoDir, 'reading');
  if (!fs.existsSync(readingDir)) {
    fs.mkdirSync(readingDir, { recursive: true });
  }

  function getFilename(moduleIndex, taskNumber, questionIndex) {
    if (moduleIndex === 0) {
      if (questionIndex === undefined) {
        return `reading_question${taskNumber}.html`;
      } else {
        return `reading_question${taskNumber}_${questionIndex + 1}.html`;
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
        html = html.replace(/{{FILL_COUNT}}/g, Object.keys(task.answers).length);
        html = html.replace(/{{TIMER_SECONDS}}/g, timerSeconds);

        const paragraphWithBlocks = generateFillBlocks(task.paragraph, task.answers);
        html = html.replace(/{{PARAGRAPH_WITH_FILL_BLOCKS}}/g, paragraphWithBlocks);

        const pageIdx = getPageIndex(pages, mIdx, task.number, undefined);
        const backPage = getBackPageFromIndex(pages, pageIdx) || (mIdx === 0 ? 'module1-intro.html' : 'module2-intro.html');
        const nextPage = getNextPageFromIndex(pages, pageIdx);

        html = html.replace(/{{BACK_PAGE_URL}}/g, backPage);
        html = html.replace(/{{NEXT_PAGE_URL}}/g, nextPage);

        // Inject TPO-specific localStorage key prefix
        html = html.replace(/'toefl_/g, `'toefl_tpo${tpoNum}_`);
        html = html.replace(/"toefl_/g, `"toefl_tpo${tpoNum}_`);
        html = html.replace(/`toefl_/g, `\`toefl_tpo${tpoNum}_`);

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
          html = html.replace(/{{QUESTION_COUNT}}/g, moduleTotalQuestions);

          if (task.templateType === 'email') {
            const emailData = parseEmailContent(task.passage);
            html = html.replace(/{{EMAIL_DATE}}/g, emailData.date);
            html = html.replace(/{{EMAIL_SUBJECT}}/g, emailData.subject);
            html = html.replace(/{{EMAIL_BODY}}/g, emailData.body);
            html = html.replace(/{{EMAIL_SENDER}}/g, emailData.sender);
          } else if (task.templateType === 'textchain') {
            html = html.replace(/{{TEXT_CHAIN_CONTENT}}/g, parseTextChain(task.passage));
          } else if (task.templateType === 'academic') {
            const titleMatch = task.description.match(/[-–—]\s*(.+)$/);
            const passageTitle = titleMatch ? titleMatch[1].trim() : task.description;
            html = html.replace(/{{PASSAGE_TITLE}}/g, passageTitle);
            html = html.replace(/{{PASSAGE_CONTENT}}/g, task.passage);
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

          // Inject TPO-specific localStorage key prefix
          html = html.replace(/'toefl_/g, `'toefl_tpo${tpoNum}_`);
          html = html.replace(/"toefl_/g, `"toefl_tpo${tpoNum}_`);
          html = html.replace(/`toefl_/g, `\`toefl_tpo${tpoNum}_`);

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

  let module1Start = Infinity, module1End = -Infinity;
  let module2Start = Infinity, module2End = -Infinity;

  for (let mIdx = 0; mIdx < modules.length; mIdx++) {
    const module = modules[mIdx];
    for (const task of module.tasks) {
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

  let html = resultsTemplate;
  html = html.replace(/{{MODULE1_TITLE}}/g, `Module 1 (Questions ${module1Start}-${module1End})`);
  html = html.replace(/{{MODULE2_TITLE}}/g, `Module 2 (Questions ${module2Start}-${module2End})`);
  html = html.replace(/{{MODULE1_START}}/g, module1Start);
  html = html.replace(/{{MODULE1_END}}/g, module1End);
  html = html.replace(/{{MODULE1_TOTAL}}/g, module1Total);
  html = html.replace(/{{MODULE2_START}}/g, module2Start);
  html = html.replace(/{{MODULE2_END}}/g, module2End);
  html = html.replace(/{{MODULE2_TOTAL}}/g, module2Total);

  html = html.replace(/'toefl_/g, `'toefl_tpo${tpoNum}_`);
  html = html.replace(/"toefl_/g, `"toefl_tpo${tpoNum}_`);
  html = html.replace(/`toefl_/g, `\`toefl_tpo${tpoNum}_`);

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
  module1IntroHtml = module1IntroHtml.replace(/{{FIRST_QUESTION_PAGE}}/g, 'reading_question1.html');
  module1IntroHtml = module1IntroHtml.replace(/'toefl_/g, `'toefl_tpo${tpoNum}_`);
  module1IntroHtml = module1IntroHtml.replace(/"toefl_/g, `"toefl_tpo${tpoNum}_`);
  fs.writeFileSync(path.join(readingDir, 'module1-intro.html'), module1IntroHtml);
  generatedFiles.push('module1-intro.html');
  console.log(`  生成: module1-intro.html`);

  let module2IntroHtml = templateContent['module2-intro'];
  module2IntroHtml = module2IntroHtml.replace(/{{FIRST_QUESTION_PAGE}}/g, 'reading_m2_task1.html');
  module2IntroHtml = module2IntroHtml.replace(/'toefl_/g, `'toefl_tpo${tpoNum}_`);
  module2IntroHtml = module2IntroHtml.replace(/"toefl_/g, `"toefl_tpo${tpoNum}_`);
  fs.writeFileSync(path.join(readingDir, 'module2-intro.html'), module2IntroHtml);
  generatedFiles.push('module2-intro.html');
  console.log(`  生成: module2-intro.html`);

  console.log(`\nTPO ${tpoNum} 生成完成！共生成 ${generatedFiles.length} 个文件`);

  return {
    tpoNum,
    totalFiles: generatedFiles.length,
    questionRange: `${module1Start}-${module2End}`,
    totalQuestions: module1Total + module2Total,
    module1Total,
    module2Total
  };
}

// ===== Generate TPO index page (TPO detail page) =====
function generateTpoIndexPage(tpoSummaries) {
  const indexDir = path.join(__dirname, 'tpo');
  if (!fs.existsSync(indexDir)) {
    fs.mkdirSync(indexDir, { recursive: true });
  }

  for (const summary of tpoSummaries) {
    const tpoDir = path.join(indexDir, summary.tpoNum);
    const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TOEFL iBT Practice - TPO ${summary.tpoNum}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
    <link rel="stylesheet" href="../../styles.css" />
    <style>
      body { background-color: #f5f5f7; margin: 0; }
      .tpo-header {
        background: linear-gradient(135deg, #008080, #006666);
        color: white;
        padding: 20px 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .tpo-header .logo { font-size: 24px; font-weight: bold; }
      .tpo-header .nav-btns { display: flex; gap: 10px; }
      .tpo-header .nav-btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        border: 2px solid rgba(255,255,255,0.3);
        background: rgba(255,255,255,0.15);
        color: white;
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
      }
      .tpo-header .nav-btn:hover { background: rgba(255,255,255,0.25); }
      .tpo-main {
        max-width: 900px;
        margin: 30px auto;
        padding: 0 20px;
      }
      .tpo-title-row {
        text-align: center;
        margin-bottom: 30px;
      }
      .tpo-title { font-size: 36px; font-weight: 700; color: #1d1d1f; margin: 0; }
      .tpo-subtitle { font-size: 16px; color: #86868b; margin: 8px 0 0; }
      .full-test-btn {
        display: block;
        max-width: 400px;
        margin: 0 auto 30px;
        padding: 18px 30px;
        background: linear-gradient(135deg, #008080, #006666);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        text-align: center;
        text-decoration: none;
        box-shadow: 0 4px 15px rgba(0,128,128,0.3);
        transition: all 0.2s ease;
      }
      .full-test-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,128,128,0.4); }
      .full-test-btn .sub { display: block; font-size: 12px; font-weight: 400; opacity: 0.8; margin-top: 4px; }
      .modules-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        margin-bottom: 30px;
      }
      .module-card {
        background: white;
        border-radius: 12px;
        padding: 24px;
        text-align: center;
        border: 1px solid #e5e5e7;
        cursor: pointer;
        transition: all 0.2s ease;
        text-decoration: none;
        color: inherit;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      }
      .module-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); }
      .module-card.available { border-top: 4px solid #008080; }
      .module-card.unavailable { opacity: 0.5; cursor: not-allowed; }
      .module-icon { font-size: 40px; margin-bottom: 12px; }
      .module-card.available .module-icon { color: #008080; }
      .module-card.unavailable .module-icon { color: #ccc; }
      .module-name { font-size: 20px; font-weight: 600; color: #1d1d1f; margin: 0 0 6px; }
      .module-desc { font-size: 13px; color: #86868b; margin: 0 0 12px; }
      .module-badge {
        display: inline-block;
        padding: 5px 14px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 600;
      }
      .module-card.available .module-badge { background: rgba(0,128,128,0.1); color: #008080; }
      .module-card.unavailable .module-badge { background: #f0f0f0; color: #999; }
      .back-link { text-align: center; margin-top: 20px; }
      .back-link a { color: #008080; text-decoration: none; font-weight: 600; }
      .back-link a:hover { text-decoration: underline; }
      @media (max-width: 768px) { .modules-grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <header class="tpo-header">
      <div class="logo">TPO ${summary.tpoNum}</div>
      <div class="nav-btns">
        <a href="../../index.html" class="nav-btn"><i class="fas fa-th"></i> All TPOs</a>
      </div>
    </header>

    <div class="tpo-main">
      <div class="tpo-title-row">
        <h1 class="tpo-title">TPO ${summary.tpoNum}</h1>
        <p class="tpo-subtitle">${summary.totalQuestions} questions · Reading section ready</p>
      </div>

      <a href="reading/start.html" class="full-test-btn">
        <i class="fas fa-play-circle"></i> Start Full Reading Test
        <span class="sub">${summary.totalQuestions} questions · Timed exam mode</span>
      </a>

      <div class="modules-grid">
        <a href="reading/start.html" class="module-card available">
          <div class="module-icon"><i class="fas fa-book"></i></div>
          <h3 class="module-name">Reading</h3>
          <p class="module-desc">${summary.module1Total + summary.module2Total} questions · Two modules</p>
          <span class="module-badge">Available</span>
        </a>

        <div class="module-card unavailable">
          <div class="module-icon"><i class="fas fa-headphones"></i></div>
          <h3 class="module-name">Listening</h3>
          <p class="module-desc">Lectures and conversations</p>
          <span class="module-badge">Coming Soon</span>
        </div>

        <div class="module-card unavailable">
          <div class="module-icon"><i class="fas fa-microphone"></i></div>
          <h3 class="module-name">Speaking</h3>
          <p class="module-desc">Record spoken responses</p>
          <span class="module-badge">Coming Soon</span>
        </div>

        <div class="module-card unavailable">
          <div class="module-icon"><i class="fas fa-pen-fancy"></i></div>
          <h3 class="module-name">Writing</h3>
          <p class="module-desc">Essays and integrated tasks</p>
          <span class="module-badge">Coming Soon</span>
        </div>
      </div>

      <div class="back-link">
        <a href="../../index.html">&larr; Back to all TPOs</a>
      </div>
    </div>
  </body>
</html>`;

    fs.writeFileSync(path.join(tpoDir, 'index.html'), indexHtml);
    console.log(`  生成: tpo/${summary.tpoNum}/index.html`);
  }
}

// ===== Generate main index page (Apple style with sidebar) =====
function generateMainIndexPage(tpoSummaries) {
  const tpoCardsHtml = tpoSummaries.map(s => `
        <a href="tpo/${s.tpoNum}/index.html" class="tpo-card">
          <div class="tpo-card-header">
            <h3><i class="fas fa-book-open"></i> TPO ${s.tpoNum}</h3>
          </div>
          <p class="tpo-desc">Authentic TOEFL practice test.</p>
          <div class="tpo-modules">
            <span class="mod-badge available"><i class="fas fa-book"></i> Reading</span>
            <span class="mod-badge coming"><i class="fas fa-headphones"></i> Listening</span>
            <span class="mod-badge coming"><i class="fas fa-microphone"></i> Speaking</span>
            <span class="mod-badge coming"><i class="fas fa-pen"></i> Writing</span>
          </div>
        </a>
  `).join('');

  const sidebarItemsHtml = tpoSummaries.map(s => `
        <a href="tpo/${s.tpoNum}/index.html" class="sidebar-item">
          <span class="sidebar-item-icon"><i class="fas fa-book-open"></i></span>
          <span class="sidebar-item-label">TPO ${s.tpoNum}</span>
        </a>
  `).join('');

  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TOEFL iBT Practice</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>
    <link rel="stylesheet" href="styles.css" />
    <style>
      :root {
        --apple-bg: #f5f5f7;
        --apple-surface: #ffffff;
        --apple-text: #1d1d1f;
        --apple-text-muted: #86868b;
        --apple-primary: #007aff;
        --apple-teal: #008080;
        --apple-radius: 12px;
        --apple-shadow: 0 4px 20px rgba(0,0,0,0.06);
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background-color: var(--apple-bg);
        color: var(--apple-text);
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
        min-height: 100vh;
      }

      /* ===== Header ===== */
      .app-header {
        background: var(--apple-surface);
        border-bottom: 1px solid #e5e5e7;
        padding: 0 24px;
        height: 52px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 100;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
      }
      .app-header .logo {
        font-size: 18px;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .app-header .logo i { color: var(--apple-teal); }
      .header-actions { display: flex; gap: 8px; align-items: center; }
      .header-btn {
        padding: 7px 14px;
        border-radius: 8px;
        font-weight: 500;
        font-size: 13px;
        cursor: pointer;
        border: none;
        background: transparent;
        color: var(--apple-text);
        display: flex;
        align-items: center;
        gap: 5px;
        transition: background 0.15s ease;
      }
      .header-btn:hover { background: #f0f0f2; }
      .header-btn.primary { background: var(--apple-teal); color: white; }
      .header-btn.primary:hover { background: #006666; }

      /* ===== Layout ===== */
      .app-layout {
        display: flex;
        min-height: calc(100vh - 52px);
      }

      /* ===== Sidebar ===== */
      .sidebar {
        width: 240px;
        background: var(--apple-surface);
        border-right: 1px solid #e5e5e7;
        padding: 16px 0;
        overflow-y: auto;
        flex-shrink: 0;
        transition: width 0.3s ease, padding 0.3s ease;
      }
      .sidebar.collapsed {
        width: 60px;
        padding: 16px 0;
      }
      .sidebar.collapsed .sidebar-item-label,
      .sidebar.collapsed .sidebar-item-count,
      .sidebar.collapsed .sidebar-section-title,
      .sidebar.collapsed .sidebar-search {
        display: none;
      }
      .sidebar.collapsed .sidebar-item {
        justify-content: center;
        padding: 10px;
      }
      .sidebar-section-title {
        padding: 8px 20px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--apple-text-muted);
      }
      .sidebar-search {
        margin: 0 12px 12px;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #e5e5e7;
        background: #f5f5f7;
        font-size: 13px;
        width: calc(100% - 24px);
        outline: none;
        transition: border-color 0.15s;
      }
      .sidebar-search:focus { border-color: var(--apple-teal); }
      .sidebar-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 20px;
        text-decoration: none;
        color: var(--apple-text);
        font-size: 14px;
        font-weight: 500;
        transition: background 0.15s;
        text-decoration: none !important;
      }
      .sidebar-item:hover { background: #f0f0f2; text-decoration: none !important; }
      .sidebar-item-icon { color: var(--apple-teal); width: 18px; text-align: center; text-decoration: none !important; }
      .sidebar-item-label { flex: 1; text-decoration: none !important; }
      .sidebar-item-count {
        font-size: 11px;
        color: var(--apple-text-muted);
        background: #f0f0f2;
        padding: 2px 8px;
        border-radius: 10px;
      }
      .sidebar-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px;
        margin: 8px 12px;
        border-radius: 8px;
        border: 1px solid #e5e5e7;
        background: transparent;
        cursor: pointer;
        color: var(--apple-text-muted);
        font-size: 14px;
        transition: all 0.15s;
        width: calc(100% - 24px);
      }
      .sidebar-toggle:hover { background: #f0f0f2; }

      /* ===== Main Content ===== */
      .main-content {
        flex: 1;
        padding: 30px;
        overflow-y: auto;
      }
      .main-header {
        margin-bottom: 30px;
      }
      .main-header h1 {
        font-size: 34px;
        font-weight: 700;
        margin-bottom: 6px;
      }
      .main-header p {
        font-size: 17px;
        color: var(--apple-text-muted);
      }

      /* ===== Full Test Banner ===== */
      .full-test-banner {
        background: linear-gradient(135deg, #008080, #006666);
        border-radius: 16px;
        padding: 24px 30px;
        color: white;
        margin-bottom: 30px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 4px 20px rgba(0,128,128,0.25);
      }
      .full-test-banner .text h2 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
      .full-test-banner .text p { font-size: 14px; opacity: 0.85; }
      .full-test-btn {
        padding: 12px 24px;
        background: white;
        color: #008080;
        border: none;
        border-radius: 10px;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s;
      }
      .full-test-btn:hover { transform: scale(1.03); }

      /* ===== TPO Grid ===== */
      .tpo-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 16px;
      }
      .tpo-card {
        background: var(--apple-surface);
        border-radius: 14px;
        padding: 22px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid #e5e5e7;
        box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        text-decoration: none !important;
        color: inherit !important;
      }
      .tpo-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.08);
        border-color: #d5d5d7;
        text-decoration: none !important;
        color: inherit !important;
      }
      .tpo-card-header h3 {
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        text-decoration: none !important;
      }
      .tpo-card-header h3 i { color: var(--apple-teal); text-decoration: none !important; }
      .tpo-badge {
        font-size: 12px;
        font-weight: 600;
        background: rgba(0,128,128,0.1);
        color: var(--apple-teal);
        padding: 3px 10px;
        border-radius: 10px;
      }
      .tpo-desc {
        font-size: 13px;
        color: var(--apple-text-muted);
        margin-bottom: 12px;
      }
      .tpo-modules { display: flex; flex-wrap: wrap; gap: 6px; }
      .mod-badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
      }
      .mod-badge.available { background: rgba(0,128,128,0.1); color: #008080; }
      .mod-badge.coming { background: #f0f0f0; color: #999; }

      /* ===== Responsive ===== */
      @media (max-width: 900px) {
        .sidebar { display: none; }
        .main-content { padding: 20px 16px; }
        .full-test-banner { flex-direction: column; gap: 16px; text-align: center; }
        .tpo-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <header class="app-header">
      <div class="logo"><i class="fas fa-graduation-cap"></i> TOEFL iBT Practice</div>
      <div class="header-actions">
      </div>
    </header>

    <div class="app-layout">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-section-title">TPO Tests</div>
        <input type="text" class="sidebar-search" placeholder="Search TPO..." id="sidebarSearch" />
        ${sidebarItemsHtml}
        <button class="sidebar-toggle" id="sidebarToggle" title="Toggle sidebar">
          <i class="fas fa-angles-left"></i>
        </button>
      </aside>

      <main class="main-content">
        <div class="main-header">
          <h1>Welcome</h1>
          <p>Prepare for the TOEFL iBT with authentic practice tests.</p>
        </div>

        <div class="full-test-banner">
          <div class="text">
            <h2><i class="fas fa-clock"></i> Full Test</h2>
            <p>Reading → Listening → Speaking → Writing</p>
          </div>
        </div>

        <div class="tpo-grid">
          ${tpoCardsHtml}
        </div>
      </main>
    </div>

    <script>
      // Sidebar toggle
      const sidebar = document.getElementById('sidebar');
      const sidebarToggle = document.getElementById('sidebarToggle');
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const icon = sidebarToggle.querySelector('i');
        icon.className = sidebar.classList.contains('collapsed') ? 'fas fa-angles-right' : 'fas fa-angles-left';
      });

      // Sidebar search
      const searchInput = document.getElementById('sidebarSearch');
      searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        document.querySelectorAll('.sidebar-item').forEach(item => {
          const label = item.querySelector('.sidebar-item-label');
          if (label) {
            item.style.display = label.textContent.toLowerCase().includes(query) ? '' : 'none';
          }
        });
      });
    </script>
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

console.log('\n生成TPO索引页面...');
generateTpoIndexPage(tpoSummaries);

console.log('\n生成主索引页面...');
generateMainIndexPage(tpoSummaries);

console.log(`\n全部完成！共处理 ${tpoSummaries.length} 个TPO`);
