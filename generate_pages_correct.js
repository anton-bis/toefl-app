import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MARKDOWN_FILE = path.join(__dirname, 'assets/questions/reading/reading-2026-test-01.md');
const OUTPUT_DIR = __dirname;

const TEMPLATES = {
  fill: {
    path: path.join(__dirname, 'templates/fill-in-missing-letters/template.html'),
    name: 'fill-in-missing-letters'
  },
  email: {
    path: path.join(__dirname, 'templates/read-an-email/template.html'),
    name: 'read-an-email'
  },
  textchain: {
    path: path.join(__dirname, 'templates/read-a-text-chain/template.html'),
    name: 'read-a-text-chain'
  },
  academic: {
    path: path.join(__dirname, 'templates/read-academic-passage/template.html'),
    name: 'read-academic-passage'
  },
  notice: {
    path: path.join(__dirname, 'templates/read-a-notice/template.html'),
    name: 'read-a-notice'
  },
  social: {
    path: path.join(__dirname, 'templates/read-a-social-media-post/template.html'),
    name: 'read-a-social-media-post'
  }
};

const templateCache = {};
for (const [key, config] of Object.entries(TEMPLATES)) {
  templateCache[key] = fs.readFileSync(config.path, 'utf-8');
}

const markdownContent = fs.readFileSync(MARKDOWN_FILE, 'utf-8');
const modules = [];
const moduleSections = markdownContent.split('## Module ');
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

    const isFillInBlank = taskDescription.includes('Complete the Words');
    const isReading = taskDescription.includes('Read');

    if (isFillInBlank) {
      const answerStart = taskContent.indexOf('[ANSWER]');
      const answerEnd = taskContent.indexOf('[/ANSWER]');

      if (answerStart === -1 || answerEnd === -1) {
        console.warn('填空任务缺少答案部分:', taskTitleLine);
        continue;
      }

      const paragraph = taskContent.substring(0, answerStart).trim();
      const answerBlock = taskContent.substring(answerStart + 8, answerEnd).trim();

      const answers = {};
      const answerLines = answerBlock.split('\n').filter(line => line.trim());
      for (const line of answerLines) {
        const [questionNum, answer] = line.split(':');
        if (questionNum && answer) {
          answers[questionNum.trim()] = answer.trim();
        }
      }

      tasks.push({
        type: 'fill',
        number: taskNumber,
        description: taskDescription,
        questionStart,
        questionEnd,
        paragraph,
        answers
      });
    } else if (isReading) {
      let templateType = 'academic';
      if (taskDescription.includes('Email')) templateType = 'email';
      else if (taskDescription.includes('Text Chain')) templateType = 'textchain';
      else if (taskDescription.includes('Academic Passage')) templateType = 'academic';

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

console.log(`解析完成: ${modules.length} 个模块`);
console.log(`模块1: ${modules[0]?.tasks.length} 个任务`);
console.log(`模块2: ${modules[1]?.tasks.length} 个任务`);

function generateFillPage(task, moduleIndex) {
  let html = templateCache.fill;

  html = html.replace(/{{QUESTION_NUMBER}}/g, task.number);
  html = html.replace(/{{QUESTION_START}}/g, task.questionStart);
  html = html.replace(/{{QUESTION_END}}/g, task.questionEnd);
  html = html.replace(/{{TOTAL_QUESTIONS}}/g, task.questionEnd - task.questionStart + 1);
  html = html.replace(/{{FILL_COUNT}}/g, Object.keys(task.answers).length);

  const timerSeconds = moduleIndex === 0 ? 690 : 540;
  html = html.replace(/{{TIMER_SECONDS}}/g, timerSeconds);

  const paragraphWithBlocks = generateFillBlocks(task.paragraph, task.answers);
  html = html.replace(/{{PARAGRAPH_WITH_FILL_BLOCKS}}/g, paragraphWithBlocks);

  const filename =
    moduleIndex === 0
      ? `reading_question${task.number}.html`
      : `reading_m2_task${task.number}.html`;

  fs.writeFileSync(path.join(OUTPUT_DIR, filename), html);
  console.log(`生成填空页面: ${filename}`);
}

function generateFillBlocks(paragraph, answers) {
  let result = '';
  const words = paragraph.split(/(\s+)/);
  let fillIndex = 1;

  for (const word of words) {
    if (word.match(/[a-zA-Z]*\\\*_+[a-zA-Z_]*/)) {
      const answerKey = Object.keys(answers)[fillIndex - 1];
      const correctAnswer = answers[answerKey];

      if (correctAnswer) {
        const prefixMatch = word.match(/^([a-zA-Z]*)\\*/);
        const prefix = prefixMatch ? prefixMatch[1] : '';

        result += `<span class="word-fill-container">
            <span class="word-prefix">${prefix}</span>
            <div class="letter-box-container" data-answer="${correctAnswer}">`;

        for (let i = 0; i < correctAnswer.length; i++) {
          result += `<input type="text" class="letter-box" maxlength="1" />`;
        }

        result += `</div>
            <span class="fill-question-number">${fillIndex}</span>
          </span>`;

        fillIndex++;
      } else {
        result += word;
      }
    } else {
      result += word;
    }
  }

  return result;
}

function parseEmailContent(passage) {
  const result = {
    date: '',
    subject: '',
    body: '',
    sender: ''
  };

  const lines = passage.split('\n');
  let inBody = false;
  let bodyLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('Date:')) {
      result.date = trimmed.substring(5).trim();
    } else if (trimmed.startsWith('Subject:')) {
      result.subject = trimmed.substring(8).trim();
    } else if (trimmed.startsWith('Dear') || trimmed.startsWith('To:')) {
      inBody = true;
      bodyLines.push(trimmed);
    } else if (
      trimmed.includes('Regards,') ||
      trimmed.includes('Best regards,') ||
      trimmed.includes('Sincerely,')
    ) {
      inBody = false;
      result.sender = lines[lines.indexOf(line) + 1]?.trim() || '';
      break;
    } else if (inBody) {
      bodyLines.push(trimmed);
    }
  }

  result.body = bodyLines.join('\n');
  return result;
}

function parseTextChainContent(passage) {
  return passage;
}

function generateReadingPages(task, moduleIndex) {
  const readingTasks = task.questions || [];
  const templateType = task.templateType || 'academic';

  for (let i = 0; i < readingTasks.length; i++) {
    const question = readingTasks[i];
    const questionNumber = task.questionStart + i;

    let html = templateCache[templateType];

    html = html.replace(/{{QUESTION_NUMBER}}/g, questionNumber);
    html = html.replace(/{{QUESTION_COUNT}}/g, readingTasks.length);

    if (templateType === 'email') {
      const emailData = parseEmailContent(task.passage);
      html = html.replace(/{{EMAIL_DATE}}/g, emailData.date);
      html = html.replace(/{{EMAIL_SUBJECT}}/g, emailData.subject);
      html = html.replace(/{{EMAIL_BODY}}/g, emailData.body);
      html = html.replace(/{{EMAIL_SENDER}}/g, emailData.sender);
    } else if (templateType === 'textchain') {
      html = html.replace(/{{TEXT_CHAIN_CONTENT}}/g, task.passage);
    } else if (templateType === 'academic') {
      html = html.replace(/{{PASSAGE_TITLE}}/g, task.description);
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

    const timerSeconds = moduleIndex === 0 ? 690 : 540;
    html = html.replace(/{{TIMER_SECONDS}}/g, timerSeconds);

    html = html.replace(/{{BACK_PAGE}}/g, getBackPage(moduleIndex, task.number, i, templateType));
    html = html.replace(
      /{{NEXT_PAGE}}/g,
      getNextPage(moduleIndex, task.number, i, readingTasks.length, templateType)
    );

    const filename = getFilename(moduleIndex, task.number, i + 1, templateType);

    fs.writeFileSync(path.join(OUTPUT_DIR, filename), html);
    console.log(`生成${TEMPLATES[templateType].name}页面: ${filename} (Q${questionNumber})`);
  }
}

function getFilename(moduleIndex, taskNumber, questionIndex, templateType) {
  if (moduleIndex === 0) {
    return `reading_question${taskNumber}_${questionIndex}.html`;
  } else {
    return `reading_m2_task${taskNumber}_${questionIndex}.html`;
  }
}

function getBackPage(moduleIndex, taskNumber, questionIndex, templateType) {
  if (questionIndex === 0) {
    return moduleIndex === 0 ? 'module1-intro.html' : 'module2-intro.html';
  } else {
    if (moduleIndex === 0) {
      return `reading_question${taskNumber}_${questionIndex}.html`;
    } else {
      return `reading_m2_task${taskNumber}_${questionIndex}.html`;
    }
  }
}

function getNextPage(moduleIndex, taskNumber, questionIndex, totalQuestions, templateType) {
  if (questionIndex === totalQuestions - 1) {
    if (moduleIndex === 0 && taskNumber === 6) {
      return 'module2-intro.html';
    } else if (moduleIndex === 1 && taskNumber === 2) {
      return 'reading_results.html';
    } else {
      const nextTask = taskNumber + 1;
      if (moduleIndex === 0) {
        return `reading_question${nextTask}_1.html`;
      } else {
        return `reading_m2_task${nextTask}_1.html`;
      }
    }
  } else {
    if (moduleIndex === 0) {
      return `reading_question${taskNumber}_${questionIndex + 2}.html`;
    } else {
      return `reading_m2_task${taskNumber}_${questionIndex + 2}.html`;
    }
  }
}

for (let mIdx = 0; mIdx < modules.length; mIdx++) {
  const module = modules[mIdx];
  console.log(`处理模块: ${module.title}`);

  for (const task of module.tasks) {
    console.log(
      `  任务 ${task.number}: ${task.description} (Q${task.questionStart}-${task.questionEnd}) -> ${task.type === 'fill' ? '填空' : task.templateType}`
    );

    if (task.type === 'fill') {
      generateFillPage(task, mIdx);
    } else if (task.type === 'reading') {
      generateReadingPages(task, mIdx);
    }
  }
}

console.log('页面生成完成！');
