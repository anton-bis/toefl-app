const fs = require('fs');
const path = require('path');

// 配置路径
const MARKDOWN_FILE = path.join(__dirname, 'assets/questions/reading/reading-2026-test-01.md');
const FILL_TEMPLATE = path.join(__dirname, 'templates/fill-in-missing-letters/template.html');
const READING_TEMPLATE = path.join(__dirname, 'templates/read-academic-passage/template.html');
const OUTPUT_DIR = __dirname;

// 读取markdown文件
const markdownContent = fs.readFileSync(MARKDOWN_FILE, 'utf-8');

// 解析模块
const modules = [];
const moduleSections = markdownContent.split('## Module ');
moduleSections.shift(); // 移除开头的空部分或标题

for (const section of moduleSections) {
  const firstNewline = section.indexOf('\n');
  const moduleTitle = section.substring(0, firstNewline).trim();
  const moduleContent = section.substring(firstNewline + 1);

  // 解析任务
  const tasks = [];
  const taskSections = moduleContent.split('### Task ');
  taskSections.shift(); // 移除任务之前的内容

  for (const taskSection of taskSections) {
    const taskFirstNewline = taskSection.indexOf('\n');
    const taskTitleLine = taskSection.substring(0, taskFirstNewline).trim();
    const taskContent = taskSection.substring(taskFirstNewline + 1);

    // 提取任务编号和问题范围
    // 示例: "1 Complete the Words (Questions 1–10)"
    const taskMatch = taskTitleLine.match(/^(\d+)\s+(.+?)\s*\(Questions\s*(\d+)[–-](\d+)\)/);
    if (!taskMatch) {
      console.warn('无法解析任务标题:', taskTitleLine);
      continue;
    }

    const taskNumber = parseInt(taskMatch[1]);
    const taskDescription = taskMatch[2];
    const questionStart = parseInt(taskMatch[3]);
    const questionEnd = parseInt(taskMatch[4]);

    // 确定题型
    const isFillInBlank = taskDescription.includes('Complete the Words');
    const isReading =
      taskDescription.includes('Read') || taskDescription.includes('Read an Academic Passage');

    // 提取内容
    if (isFillInBlank) {
      // 提取段落和答案
      const answerStart = taskContent.indexOf('[ANSWER]');
      const answerEnd = taskContent.indexOf('[/ANSWER]');

      if (answerStart === -1 || answerEnd === -1) {
        console.warn('填空任务缺少答案部分:', taskTitleLine);
        continue;
      }

      const paragraph = taskContent.substring(0, answerStart).trim();
      const answerBlock = taskContent.substring(answerStart + 8, answerEnd).trim();

      // 解析答案行
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
      // 提取文章和问题
      // 首先找到文章内容（直到第一个问题编号）
      const questionStartIndex = taskContent.search(/\n\d+\./);
      let passage = '';
      let questionsContent = '';

      if (questionStartIndex !== -1) {
        passage = taskContent.substring(0, questionStartIndex).trim();
        questionsContent = taskContent.substring(questionStartIndex).trim();
      } else {
        passage = taskContent.trim();
      }

      // 解析问题
      const questions = [];
      const questionSections = questionsContent.split(/\n(?=\d+\.)/);

      for (const qSection of questionSections) {
        if (!qSection.trim()) continue;

        // 提取问题编号和文本
        const qMatch = qSection.match(/^(\d+)\.\s*(.+?)(?=\nA\.|\n[ABCD]\.|\n\[ANSWER\]|$)/s);
        if (!qMatch) continue;

        const qNum = parseInt(qMatch[1]);
        const qText = qMatch[2].trim();

        // 提取选项
        const options = {};
        const optionRegex = /([ABCD])\.\s*(.+?)(?=\n[ABCD]\.|\n\[ANSWER\]|$)/gs;
        let optionMatch;
        while ((optionMatch = optionRegex.exec(qSection)) !== null) {
          const optLetter = optionMatch[1];
          const optText = optionMatch[2].trim();
          options[optLetter] = optText;
        }

        // 提取答案
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

// 生成页面
function generateFillPage(task, moduleIndex) {
  let html = fillTemplate;

  // 替换占位符
  html = html.replace(/{{QUESTION_NUMBER}}/g, task.number);
  html = html.replace(/{{QUESTION_START}}/g, task.questionStart);
  html = html.replace(/{{QUESTION_END}}/g, task.questionEnd);
  html = html.replace(/{{TOTAL_QUESTIONS}}/g, task.questionEnd - task.questionStart + 1);
  html = html.replace(/{{FILL_COUNT}}/g, Object.keys(task.answers).length);

  // 计时器秒数：Module 1 = 690秒 (11:30), Module 2 = 540秒 (9:00)
  const timerSeconds = moduleIndex === 0 ? 690 : 540;
  html = html.replace(/{{TIMER_SECONDS}}/g, timerSeconds);

  // 生成填空块
  const paragraphWithBlocks = generateFillBlocks(task.paragraph, task.answers);
  html = html.replace(/{{PARAGRAPH_WITH_FILL_BLOCKS}}/g, paragraphWithBlocks);

  // 生成文件名
  const filename =
    moduleIndex === 0
      ? `reading_question${task.number}.html`
      : `reading_m2_task${task.number}.html`;

  fs.writeFileSync(path.join(OUTPUT_DIR, filename), html);
  console.log(`生成填空页面: ${filename}`);
}

function generateFillBlocks(paragraph, answers) {
  // 解析段落中的下划线模式
  // 示例: "fi\_**\_" -> 缺失字母用下划线和反斜杠表示
  // 我们需要将每个下划线部分替换为填空输入框

  // 简化：按单词分割，检测下划线模式
  let result = '';
  const words = paragraph.split(/(\s+)/);
  let fillIndex = 1;

  for (const word of words) {
    if (word.match(/[a-zA-Z]*\\\*_+[a-zA-Z_]*/)) {
      // 这是一个包含下划线的单词
      const answerKey = Object.keys(answers)[fillIndex - 1];
      const correctAnswer = answers[answerKey];

      if (correctAnswer) {
        // 创建填空容器
        const prefixMatch = word.match(/^([a-zA-Z]*)\\*/);
        const prefix = prefixMatch ? prefixMatch[1] : '';

        result += `<span class="word-fill-container">
                    <span class="word-prefix">${prefix}</span>
                    <div class="letter-box-container" data-answer="${correctAnswer}">`;

        // 为每个字母创建输入框
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
    const questionNumber = task.questionStart + i - 1; // 调整为零基索引

    let html = readingTemplate;

    // 替换占位符
    html = html.replace(/{{QUESTION_NUMBER}}/g, questionNumber);
    html = html.replace(/{{QUESTION_COUNT}}/g, readingTasks.length);
    html = html.replace(/{{PASSAGE_TITLE}}/g, task.description);
    html = html.replace(/{{PASSAGE_CONTENT}}/g, task.passage);
    html = html.replace(/{{QUESTION_TEXT}}/g, question.text);

    // 选项
    html = html.replace(/{{OPTION_A}}/g, question.options.A || '');
    html = html.replace(/{{OPTION_B}}/g, question.options.B || '');
    html = html.replace(/{{OPTION_C}}/g, question.options.C || '');
    html = html.replace(/{{OPTION_D}}/g, question.options.D || '');

    // 正确答案标记
    html = html.replace(/{{CORRECT_A}}/g, question.correctAnswer === 'A' ? 'true' : 'false');
    html = html.replace(/{{CORRECT_B}}/g, question.correctAnswer === 'B' ? 'true' : 'false');
    html = html.replace(/{{CORRECT_C}}/g, question.correctAnswer === 'C' ? 'true' : 'false');
    html = html.replace(/{{CORRECT_D}}/g, question.correctAnswer === 'D' ? 'true' : 'false');

    // 计时器秒数
    const timerSeconds = moduleIndex === 0 ? 690 : 540;
    html = html.replace(/{{TIMER_SECONDS}}/g, timerSeconds);

    // 导航链接（简化，需要根据实际情况调整）
    html = html.replace(/{{BACK_PAGE}}/g, getBackPage(moduleIndex, task.number, i));
    html = html.replace(
      /{{NEXT_PAGE}}/g,
      getNextPage(moduleIndex, task.number, i, readingTasks.length)
    );

    // 生成文件名
    const filename =
      moduleIndex === 0
        ? `reading_question${task.number}_${i + 1}.html`
        : `reading_m2_task${task.number}_${i + 1}.html`;

    fs.writeFileSync(path.join(OUTPUT_DIR, filename), html);
    console.log(`生成阅读页面: ${filename} (Q${questionNumber})`);
  }
}

function getBackPage(moduleIndex, taskNumber, questionIndex) {
  // 简化：返回上一页
  if (questionIndex === 0) {
    // 如果是第一个问题，返回任务介绍页
    return moduleIndex === 0 ? 'module1-intro.html' : 'module2-intro.html';
  } else {
    // 返回同任务的上一个问题
    if (moduleIndex === 0) {
      return `reading_question${taskNumber}_${questionIndex}.html`;
    } else {
      return `reading_m2_task${taskNumber}_${questionIndex}.html`;
    }
  }
}

function getNextPage(moduleIndex, taskNumber, questionIndex, totalQuestions) {
  // 简化：返回下一页
  if (questionIndex === totalQuestions - 1) {
    // 如果是最后一个问题，返回下一个任务或结果页
    if (moduleIndex === 0 && taskNumber === 6) {
      return 'module2-intro.html'; // Module 1最后一个任务后进入Module 2
    } else if (moduleIndex === 1 && taskNumber === 2) {
      return 'reading_results.html'; // Module 2最后一个任务后进入结果页
    } else {
      // 返回下一个任务的第一个问题
      const nextTask = taskNumber + 1;
      if (moduleIndex === 0) {
        return `reading_question${nextTask}_1.html`;
      } else {
        return `reading_m2_task${nextTask}_1.html`;
      }
    }
  } else {
    // 返回同任务的下一个问题
    if (moduleIndex === 0) {
      return `reading_question${taskNumber}_${questionIndex + 2}.html`;
    } else {
      return `reading_m2_task${taskNumber}_${questionIndex + 2}.html`;
    }
  }
}

// 主生成循环
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
