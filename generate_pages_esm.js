import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置路径
const MARKDOWN_FILE = path.join(__dirname, 'assets/questions/reading/reading-TPO-01.md');
const FILL_TEMPLATE = path.join(__dirname, 'templates/fill-in-missing-letters/template.html');
const READING_TEMPLATE = path.join(__dirname, 'templates/read-academic-passage/template.html');
const OUTPUT_DIR = __dirname;

// 读取markdown文件
const markdownContent = fs.readFileSync(MARKDOWN_FILE, 'utf-8');

// 解析模块
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
    const isReading =
      taskDescription.includes('Read') || taskDescription.includes('Read an Academic Passage');

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

// 读取模板
const fillTemplate = fs.readFileSync(FILL_TEMPLATE, 'utf-8');
const readingTemplate = fs.readFileSync(READING_TEMPLATE, 'utf-8');

function generateFillPage(task, moduleIndex) {
  let html = fillTemplate;

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

function generateReadingPages(task, moduleIndex) {
  const readingTasks = task.questions || [];

  for (let i = 0; i < readingTasks.length; i++) {
    const question = readingTasks[i];
    const questionNumber = task.questionStart + i;

    let html = readingTemplate;

    html = html.replace(/{{QUESTION_NUMBER}}/g, questionNumber);
    html = html.replace(/{{QUESTION_COUNT}}/g, readingTasks.length);
    html = html.replace(/{{PASSAGE_TITLE}}/g, task.description);

    let passageHTML = task.passage;

    // 词汇题高亮：从题目文本中提取目标词
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

    html = html.replace(/{{PASSAGE_CONTENT}}/g, passageHTML);
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

    html = html.replace(/{{BACK_PAGE}}/g, getBackPage(moduleIndex, task.number, i));
    html = html.replace(
      /{{NEXT_PAGE}}/g,
      getNextPage(moduleIndex, task.number, i, readingTasks.length)
    );

    const filename =
      moduleIndex === 0
        ? `reading_question${task.number}_${i + 1}.html`
        : `reading_m2_task${task.number}_${i + 1}.html`;

    fs.writeFileSync(path.join(OUTPUT_DIR, filename), html);
    console.log(`生成阅读页面: ${filename} (Q${questionNumber})`);
  }
}

function getBackPage(moduleIndex, taskNumber, questionIndex) {
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

function getNextPage(moduleIndex, taskNumber, questionIndex, totalQuestions) {
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
      `  任务 ${task.number}: ${task.description} (Q${task.questionStart}-${task.questionEnd})`
    );

    if (task.type === 'fill') {
      generateFillPage(task, mIdx);
    } else if (task.type === 'reading') {
      generateReadingPages(task, mIdx);
    }
  }
}

console.log('页面生成完成！');
