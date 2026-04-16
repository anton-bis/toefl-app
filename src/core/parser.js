/**
 * Markdown题库解析器
 * 解析自定义托福题型Markdown，生成结构化JSON数据
 */

class QuestionParser {
  constructor() {
    this.currentModule = '';
    this.currentTitle = '';
    this.currentTask = null;
    this.currentModuleNumber = 1; // 当前解析的模块编号（1或2）
    this.parsedModuleNumbers = []; // 跟踪已解析的模块编号顺序（用于验证模块顺序）
    this.result = {
      module: '', // 保持向后兼容：模块名称（如'reading'）
      title: '',
      tasks: [], // 保持向后兼容：所有Task的扁平数组
      modules: [] // 新结构：嵌套的模块数组，每个模块包含tasks
    };
    this.currentAnswer = '';
    this.inAnswerBlock = false;
    this.pendingAnswers = []; // 存储待分配的答案
  }

  /**
   * 解析Markdown题库
   * @param {string} markdown - Markdown文本
   * @param {string} moduleName - 模块名称
   * @returns {Object} 结构化题目数据
   */
  parse(markdown, moduleName = 'reading') {
    this.reset();
    this.result.module = moduleName;

    const lines = markdown.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) continue;

      // 检测答案块开始
      if (line === '[ANSWER]') {
        this.inAnswerBlock = true;
        this.currentAnswer = '';
        continue;
      }

      // 检测答案块结束
      if (line === '[/ANSWER]') {
        this.inAnswerBlock = false;
        this.processAnswerBlock(this.currentAnswer);
        continue;
      }

      // 如果在答案块中，收集答案内容
      if (this.inAnswerBlock) {
        this.currentAnswer += line + '\n';
        continue;
      }

      // 解析标题
      if (line.startsWith('# ')) {
        this.parseTitle(line);
      }
      // 解析模块分隔符（如 "## Module 1:" 或 "## Module 2:"）
      else if (line.startsWith('## ')) {
        // parseModule内部会处理结束当前Task和切换模块
        this.parseModule(line);
      }
      // 解析题型（Task）
      else if (line.startsWith('### ')) {
        this.parseTask(line, lines, i);
      }
      // 解析填空题 - 检测多种格式：包含连续下划线或下划线+星号组合（支持转义反斜杠）
      else if (
        line.includes('________') ||
        line.includes('___') ||
        line.includes('\\_') ||
        /[a-zA-Z]+[_*]{2,}/.test(line) ||
        /[a-zA-Z]+\\_[_*]{2,}/.test(line)
      ) {
        this.parseFillBlank(line);
      }
      // 解析阅读段落中的数字开头问题
      else if (
        this.currentTask &&
        this.currentTask.type === 'reading-passage' &&
        line.match(/^\d+\.\s/)
      ) {
        this.parseReadingQuestion(line, lines, i);
      }
      // 解析选择题
      else if (line.match(/^[A-D]\.\s/)) {
        this.parseMultipleChoice(line, lines, i);
      }
      // 解析阅读段落
      else if (this.currentTask && this.currentTask.type === 'reading-passage') {
        this.parseReadingPassage(line);
      }
    }

    // 自动生成填空题答案（如果答案为空）
    this.autoFillMissingAnswers();

    // 处理最后一个Task（如果有）
    if (this.currentTask) {
      this.result.tasks.push(this.currentTask);

      // 同时将Task添加到当前模块的tasks数组中
      const currentModule = this.getCurrentModule();
      if (currentModule) {
        currentModule.tasks.push(this.currentTask);
      }
    }

    return this.result;
  }

  /**
   * 解析标题
   */
  parseTitle(line) {
    this.result.title = line.replace('# ', '').trim();
    console.log(`解析标题: ${this.result.title}`);
  }

  /**
   * 解析模块分隔符（如 "## Module 1:" 或 "## Module 2:"）
   */
  parseModule(line) {
    const moduleText = line.replace('## ', '').trim();
    console.log(`解析模块: ${moduleText}`);

    // 提取模块编号（如 "Module 1:" → 1）
    const moduleMatch = moduleText.match(/Module\s+(\d+)/i);
    if (moduleMatch) {
      let moduleNumber = parseInt(moduleMatch[1], 10);

      // 验证模块编号：托福自适应测试只允许Module 1或Module 2
      if (moduleNumber !== 1 && moduleNumber !== 2) {
        console.warn(
          `无效的模块编号: ${moduleNumber}，托福自适应测试只支持Module 1和Module 2，使用默认模块1`
        );
        moduleNumber = 1;
      }

      // 在切换模块前，结束当前任务（使用当前模块编号）
      this.finalizeCurrentTask();

      // 验证模块顺序：Module 1 必须在 Module 2 之前
      // 检查模块1是否已经存在（在result.modules或已解析列表中）
      const module1Exists =
        this.result.modules.some(m => m.moduleNumber === 1) || this.parsedModuleNumbers.includes(1);

      if (moduleNumber === 2 && !module1Exists) {
        console.warn(`模块顺序错误：Module 2 必须在 Module 1 之后，将自动创建 Module 1。`);
        // 强制创建 Module 1
        const module1 = {
          moduleNumber: 1,
          moduleName: 'Module 1',
          difficulty: 'fixed', // Module 1难度固定
          timeLimit: 690, // Module 1默认时间限制：11分钟30秒（690秒）
          tasks: []
        };
        this.result.modules.push(module1);
        if (!this.parsedModuleNumbers.includes(1)) {
          this.parsedModuleNumbers.push(1);
        }
        console.log(`自动创建缺失的 Module 1`);
      }

      // 记录已解析的模块编号（用于顺序跟踪）
      if (!this.parsedModuleNumbers.includes(moduleNumber)) {
        this.parsedModuleNumbers.push(moduleNumber);
      }

      this.currentModuleNumber = moduleNumber;
      console.log(
        `当前模块编号: ${this.currentModuleNumber}，已解析模块顺序: [${this.parsedModuleNumbers.join(', ')}]`
      );

      // 创建新的模块对象（如果不存在）
      const existingModule = this.result.modules.find(
        m => m.moduleNumber === this.currentModuleNumber
      );
      if (!existingModule) {
        // 确定模块难度和时间限制
        let difficulty = 'unknown';
        let timeLimit = 0;

        if (moduleNumber === 1) {
          difficulty = 'fixed'; // Module 1: 固定难度
          timeLimit = 690; // Module 1默认时间限制：11分钟30秒（690秒）
        } else if (moduleNumber === 2) {
          difficulty = 'adaptive'; // Module 2: 自适应难度
          timeLimit = 540; // Module 2时间限制：9分钟（540秒），根据用户要求
        }

        const newModule = {
          moduleNumber: this.currentModuleNumber,
          moduleName: moduleText,
          difficulty: difficulty,
          timeLimit: timeLimit,
          tasks: []
        };
        this.result.modules.push(newModule);
        console.log(
          `创建新模块: Module ${this.currentModuleNumber}，难度: ${difficulty}，时间限制: ${timeLimit}秒`
        );
      } else {
        // 如果模块已存在，确保它有timeLimit字段
        if (!existingModule.timeLimit) {
          if (moduleNumber === 1) {
            existingModule.timeLimit = 1080;
          } else if (moduleNumber === 2) {
            existingModule.timeLimit = 540;
          }
          console.log(`为现有模块 ${moduleNumber} 设置时间限制: ${existingModule.timeLimit}秒`);
        }
      }
    } else {
      console.warn(`无法从"${moduleText}"中提取模块编号，使用默认模块1`);
      this.currentModuleNumber = 1;
      // 确保模块1存在于已解析列表
      if (!this.parsedModuleNumbers.includes(1)) {
        this.parsedModuleNumbers.push(1);
      }
    }
  }

  /**
   * 获取当前模块对象
   */
  getCurrentModule() {
    // 如果没有模块数据，创建一个默认模块（Module 1）
    if (this.result.modules.length === 0) {
      const defaultModule = {
        moduleNumber: 1,
        moduleName: 'Module 1',
        difficulty: 'fixed', // 默认模块1为固定难度
        timeLimit: 1080, // 默认时间限制：18分钟
        tasks: []
      };
      this.result.modules.push(defaultModule);
      // 确保模块1存在于已解析列表
      if (!this.parsedModuleNumbers.includes(1)) {
        this.parsedModuleNumbers.push(1);
      }
      console.log(`创建默认模块: Module 1 (固定难度, 时间限制: 1080秒)`);
    }

    // 查找当前模块编号对应的模块
    let currentModule = this.result.modules.find(m => m.moduleNumber === this.currentModuleNumber);

    // 如果找不到当前模块，创建一个新的
    if (!currentModule) {
      console.warn(`找不到模块 ${this.currentModuleNumber}，创建新模块`);
      // 确定新模块的难度和时间限制
      let difficulty = 'unknown';
      let timeLimit = 0;

      if (this.currentModuleNumber === 1) {
        difficulty = 'fixed';
        timeLimit = 1080;
      } else if (this.currentModuleNumber === 2) {
        difficulty = 'adaptive';
        timeLimit = 540; // 根据用户要求：9分钟
      }

      currentModule = {
        moduleNumber: this.currentModuleNumber,
        moduleName: `Module ${this.currentModuleNumber}`,
        difficulty: difficulty,
        timeLimit: timeLimit,
        tasks: []
      };
      this.result.modules.push(currentModule);
      // 记录到已解析模块列表
      if (!this.parsedModuleNumbers.includes(this.currentModuleNumber)) {
        this.parsedModuleNumbers.push(this.currentModuleNumber);
      }
    }

    // 确保模块有时间限制字段
    if (!currentModule.timeLimit) {
      if (currentModule.moduleNumber === 1) {
        currentModule.timeLimit = 1080;
      } else if (currentModule.moduleNumber === 2) {
        currentModule.timeLimit = 540;
      }
      console.log(
        `为模块 ${currentModule.moduleNumber} 添加时间限制: ${currentModule.timeLimit}秒`
      );
    }

    return currentModule;
  }

  /**
   * 结束当前Task并将其添加到当前模块
   */
  finalizeCurrentTask() {
    if (this.currentTask) {
      console.log(
        `[调试] finalizeCurrentTask: 当前模块编号 = ${this.currentModuleNumber}, Task = ${this.currentTask.title}`
      );
      this.result.tasks.push(this.currentTask);

      // 同时将Task添加到当前模块的tasks数组中
      const currentModule = this.getCurrentModule();
      if (currentModule) {
        currentModule.tasks.push(this.currentTask);
        console.log(`[调试] Task添加到模块 ${currentModule.moduleNumber}`);
      }

      console.log(`结束Task: ${this.currentTask.title}, 添加到模块 ${this.currentModuleNumber}`);
    }
  }

  /**
   * 解析题型（Task）
   */
  parseTask(line, lines, index) {
    // 结束上一个Task
    this.finalizeCurrentTask();

    const taskText = line.replace('### ', '').trim();
    this.currentTask = {
      type: this.detectTaskType(taskText),
      title: taskText,
      range: this.extractRange(taskText),
      passage: '',
      questions: []
    };

    console.log(`解析Task: ${taskText}, 类型: ${this.currentTask.type}`);

    // 提取Task描述（下一行）
    if (index + 1 < lines.length) {
      const nextLine = lines[index + 1].trim();
      if (nextLine && !nextLine.startsWith('#')) {
        this.currentTask.description = nextLine;
      }
    }
  }

  /**
   * 检测Task类型
   */
  detectTaskType(taskText) {
    const text = taskText.toLowerCase();

    if (text.includes('complete the words')) {
      return 'fill-blank';
    } else if (text.includes('read in daily life')) {
      return 'multiple-choice';
    } else if (text.includes('read an academic passage')) {
      return 'reading-passage';
    } else if (text.includes('listen to')) {
      return 'listening';
    } else if (text.includes('writing task')) {
      return 'writing';
    } else if (text.includes('speaking task')) {
      return 'speaking';
    }

    return 'unknown';
  }

  /**
   * 提取题目范围
   */
  extractRange(taskText) {
    const rangeMatch = taskText.match(/(\d+)[–-](\d+)/);
    if (rangeMatch) {
      return `${rangeMatch[1]}-${rangeMatch[2]}`;
    }
    return '';
  }

  /**
   * 解析填空题
   */
  parseFillBlank(line) {
    if (!this.currentTask || this.currentTask.type !== 'fill-blank') {
      return;
    }

    // 移除转义反斜杠，简化解析
    const cleanLine = line.replace(/\\/g, '');

    // 定义多种填空模式以支持题库中的实际格式
    const patterns = [
      // 格式1：前缀_***_ (如 fi_**_)
      { re: /([a-zA-Z]+)_(\*+)_/g, type: 'underscore_asterisk_underscore' },
      // 格式2：前缀_** (如 t_**)
      { re: /([a-zA-Z]+)_(\*+)/g, type: 'underscore_asterisk' },
      // 格式3：前缀**____** (如 evo**____**)
      { re: /([a-zA-Z]+)\*{2}(_+)\*{2}/g, type: 'asterisk_underscore_asterisk' },
      // 格式4：前缀**____ (如 fi**____)
      { re: /([a-zA-Z]+)\*{2}(_+)/g, type: 'asterisk_underscore' },
      // 格式6：前缀混合下划线和星号 (如 li__**)
      { re: /([a-zA-Z]+)([_*]{2,})/g, type: 'mixed_underscore_asterisk' },
      // 格式5：前缀____ (如 fi____)
      { re: /([a-zA-Z]+)(_{2,})/g, type: 'underscore_only' }
    ];

    let questionId = this.currentTask.questions.length + 1;
    let matchesFound = false;
    const matchedIndices = new Set();

    // 收集所有匹配项，按位置排序
    const allMatches = [];

    for (const pattern of patterns) {
      pattern.re.lastIndex = 0; // 重置正则表达式状态
      let match;

      while ((match = pattern.re.exec(cleanLine)) !== null) {
        const matchIndex = match.index;
        // 如果这个位置已经被匹配过，跳过（避免重复）
        if (matchedIndices.has(matchIndex)) {
          continue;
        }
        matchedIndices.add(matchIndex);

        allMatches.push({
          index: matchIndex,
          pattern: pattern,
          match: match
        });
      }
    }

    // 按位置排序
    allMatches.sort((a, b) => a.index - b.index);

    // 处理排序后的匹配项
    for (const item of allMatches) {
      const pattern = item.pattern;
      const match = item.match;
      const prefix = match[1];
      let underlineCount = 0;

      // 根据模式类型计算下划线数量（缺失字母数）
      if (pattern.type === 'underscore_asterisk_underscore') {
        // 格式1：前缀_***_ - 星号数量表示缺失字母数
        underlineCount = match[2].length; // 星号数量
      } else if (pattern.type === 'underscore_asterisk') {
        // 格式2：前缀_** - 星号数量表示缺失字母数
        underlineCount = match[2].length; // 星号数量
      } else if (pattern.type === 'asterisk_underscore_asterisk') {
        // 格式3：前缀**____** - 下划线数量表示缺失字母数
        underlineCount = match[2].length; // 下划线数量
      } else if (pattern.type === 'asterisk_underscore') {
        // 格式4：前缀**____ - 下划线数量表示缺失字母数
        underlineCount = match[2].length; // 下划线数量
      } else if (pattern.type === 'underscore_only') {
        // 格式5：前缀____ - 下划线数量表示缺失字母数
        underlineCount = match[2].length; // 下划线数量
      } else if (pattern.type === 'mixed_underscore_asterisk') {
        // 格式6：前缀混合下划线和星号 - 总字符数量表示缺失字母数
        underlineCount = match[2].length; // 总字符数量
      }

      // 创建题目，答案留空等待答案块填充
      this.currentTask.questions.push({
        id: questionId++,
        type: 'fill-blank',
        prefix: prefix,
        underlineCount: underlineCount,
        answer: '', // 将由答案块填充
        fullText: line
      });

      matchesFound = true;
      console.log(`解析填空题 (${pattern.type}): ${prefix}, 下划线数量: ${underlineCount}`);
    }

    // 如果没有匹配到任何模式，但该行应该是填空题，尝试宽松匹配
    if (!matchesFound && (line.includes('_') || line.includes('*'))) {
      console.warn(`无法解析的填空题格式: ${line.substring(0, 50)}...`);
    }
  }

  /**
   * 自动填充缺失的填空题答案
   */
  autoFillMissingAnswers() {
    for (const task of this.result.tasks) {
      if (task.type === 'fill-blank') {
        for (const question of task.questions) {
          if (!question.answer || question.answer.trim() === '') {
            question.answer = this.estimateAnswer(question.prefix, question.underlineCount);
            // 如果生成了实际答案（不是下划线占位符），更新下划线数量
            if (question.answer !== '_'.repeat(question.underlineCount)) {
              question.underlineCount = question.answer.length;
            }
          }
        }
      }
    }
  }

  estimateAnswer(prefix, underlineCount) {
    const commonWords = {
      fi: 'eld',
      rem: 'ains',
      i: 'n',
      h: 'ow',
      li: 'fe',
      evo: 'lved',
      ada: 'pted',
      c: 'an',
      fo: 'und',
      alm: 'ost',
      envir: 'onment',
      pl: 'ay',
      var: 'ious',
      mea: 'ning',
      exam: 'ining',
      orga: 'nisms',
      Ma: 'ny',
      th: 'em',
      t: 'o',
      ro: 'les',
      atm: 'osphere',
      re: 'mains',
      org: 'anisms',
      r: 'oles',
      influen: 'ced',
      lati: 'tude',
      proxi: 'mity',
      bod: 'ies',
      driv: 'en',
      hu: 'man',
      deforest: 'ation',
      substan: 'tial',
      eco: 'systems',
      socie: 'ties'
    };

    return commonWords[prefix] || '_'.repeat(underlineCount);
  }

  /**
   * 从完整段落中提取填空题的答案
   * @param {string} fullParagraph - 包含完整单词的段落
   * @param {Array} questions - 填空题列表
   * @returns {Array} 带答案的题目列表
   */
  extractAnswersFromFullText(fullParagraph, questions) {
    const results = [];

    for (const q of questions) {
      if (q.type !== 'fill-blank') {
        results.push(q);
        continue;
      }

      const prefix = q.prefix;
      const expectedLength = q.underlineCount;

      // 在完整段落中查找以prefix开头的单词
      const regex = new RegExp(`\\b${prefix}([a-zA-Z]{${expectedLength},})\\b`, 'gi');
      const matches = [...fullParagraph.matchAll(regex)];

      if (matches.length > 0) {
        // 取第一个匹配（根据上下文顺序）
        const fullWord = matches[0][0];
        const answer = matches[0][1]; // 后缀部分
        results.push({
          ...q,
          answer: answer,
          fullWord: fullWord,
          source: 'extracted'
        });
      } else {
        // 如果找不到，使用估计答案
        results.push({
          ...q,
          answer: this.estimateAnswer(prefix, expectedLength),
          source: 'estimated'
        });
      }
    }

    return results;
  }

  /**
   * 生成答案校对报告
   */
  generateAnswerReport(parsedData, fullParagraphs = []) {
    const report = {
      timestamp: new Date().toISOString(),
      title: parsedData.title,
      modules: []
    };

    parsedData.tasks.forEach((task, taskIndex) => {
      if (task.type !== 'fill-blank') return;

      const moduleReport = {
        title: task.title,
        questions: []
      };

      // 如果有对应的完整段落，尝试提取答案
      const fullParagraph = fullParagraphs[taskIndex] || '';

      task.questions.forEach(q => {
        const prefix = q.prefix;
        const expectedLength = q.underlineCount;

        if (fullParagraph) {
          // 从完整段落中提取答案
          const regex = new RegExp(`\\b${prefix}([a-zA-Z]{${expectedLength},})\\b`, 'gi');
          const matches = [...fullParagraph.matchAll(regex)];

          if (matches.length > 0) {
            const fullWord = matches[0][0];
            const answer = matches[0][1];
            moduleReport.questions.push({
              id: q.id,
              prefix: prefix,
              expectedLength: expectedLength,
              answer: answer,
              fullWord: fullWord,
              confidence: 'high',
              needReview: false
            });
          } else {
            // 使用估计答案
            const estimated = this.estimateAnswer(prefix, expectedLength);
            moduleReport.questions.push({
              id: q.id,
              prefix: prefix,
              expectedLength: expectedLength,
              answer: estimated,
              fullWord: prefix + estimated,
              confidence: 'low',
              needReview: true
            });
          }
        } else {
          // 没有完整段落，使用估计答案
          const estimated = this.estimateAnswer(prefix, expectedLength);
          moduleReport.questions.push({
            id: q.id,
            prefix: prefix,
            expectedLength: expectedLength,
            answer: estimated,
            fullWord: prefix + estimated,
            confidence: 'low',
            needReview: true
          });
        }
      });

      report.modules.push(moduleReport);
    });

    return report;
  }

  /**
   * 解析选择题
   */
  parseMultipleChoice(line, lines, index) {
    if (
      !this.currentTask ||
      (this.currentTask.type !== 'multiple-choice' && this.currentTask.type !== 'reading-passage')
    ) {
      return;
    }

    // 提取选项
    const optionMatch = line.match(/^([A-D])\.\s(.+)/);
    if (optionMatch) {
      const optionLetter = optionMatch[1];
      const optionText = optionMatch[2];

      // 对于reading-passage类型，问题已经由parseReadingQuestion创建
      if (this.currentTask.type === 'reading-passage') {
        // 查找最后一个问题
        if (!this.currentTask.questions || this.currentTask.questions.length === 0) {
          // 如果没有问题存在，创建一个新问题
          this.currentTask.questions = this.currentTask.questions || [];
          this.currentTask.questions.push({
            id: this.currentTask.questions.length + 1,
            type: 'multiple-choice',
            question: '', // 题干可能在前面的数字开头问题行中
            options: [],
            answer: ''
          });
        }

        const currentQuestion = this.currentTask.questions[this.currentTask.questions.length - 1];

        if (optionLetter === 'A') {
          // 如果是第一个选项，添加到当前问题的选项数组
          currentQuestion.options = [optionText];
        } else {
          // 添加到当前问题的选项
          currentQuestion.options.push(optionText);
        }
      } else {
        // 对于multiple-choice类型，保持原有逻辑
        // 如果是第一个选项，创建新问题
        if (optionLetter === 'A') {
          // 提取题干（前一行）
          let questionText = '';
          for (let i = index - 1; i >= 0; i--) {
            const prevLine = lines[i].trim();
            if (prevLine && !prevLine.match(/^[A-D]\.\s/)) {
              questionText = prevLine;
              break;
            }
          }

          this.currentTask.questions.push({
            id: this.currentTask.questions.length + 1,
            type: 'multiple-choice',
            question: questionText,
            options: [optionText],
            answer: '' // 将由答案块填充
          });
        } else {
          // 添加到当前问题的选项
          const currentQuestion = this.currentTask.questions[this.currentTask.questions.length - 1];
          if (currentQuestion) {
            currentQuestion.options.push(optionText);
          }
        }
      }
    }
  }

  /**
   * 解析阅读段落中的数字开头问题
   */
  parseReadingQuestion(line, lines, index) {
    if (!this.currentTask || this.currentTask.type !== 'reading-passage') {
      return;
    }

    // 提取问题编号和文本
    const questionMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (!questionMatch) return;

    const questionNumber = parseInt(questionMatch[1], 10);
    const questionText = questionMatch[2];

    // 创建新问题
    if (!this.currentTask.questions) {
      this.currentTask.questions = [];
    }

    this.currentTask.questions.push({
      id: this.currentTask.questions.length + 1,
      type: 'multiple-choice',
      question: questionText,
      options: [], // 选项将在后续行中通过parseMultipleChoice添加
      answer: '' // 将由答案块填充
    });
  }

  /**
   * 解析阅读段落
   */
  parseReadingPassage(line) {
    if (!this.currentTask || this.currentTask.type !== 'reading-passage') {
      return;
    }

    // 初始化passage字段
    if (!this.currentTask.passage) {
      this.currentTask.passage = '';
    }

    // 添加行到段落内容，保留换行
    this.currentTask.passage += line + '\n';
  }

  /**
   * 结束当前Task并将其添加到当前模块
   */
  finalizeCurrentTask() {
    if (this.currentTask) {
      this.result.tasks.push(this.currentTask);

      // 同时将Task添加到当前模块的tasks数组中
      const currentModule = this.getCurrentModule();
      if (currentModule) {
        currentModule.tasks.push(this.currentTask);
      }

      // 清空当前Task，防止重复添加
      this.currentTask = null;
    }
  }

  /**
   * 处理答案块
   */
  processAnswerBlock(answerText) {
    if (!answerText.trim()) return;

    const lines = answerText.trim().split('\n');

    // 根据当前任务类型处理答案
    if (this.currentTask) {
      const taskType = this.currentTask.type;

      if (taskType === 'fill-blank') {
        this.processFillBlankAnswers(lines);
      } else if (taskType === 'multiple-choice' || taskType === 'reading-passage') {
        this.processMultipleChoiceAnswers(lines);
      }
    }
  }

  /**
   * 处理填空题答案
   */
  processFillBlankAnswers(answerLines) {
    if (!this.currentTask || !this.currentTask.questions.length) return;

    // 答案格式：前缀:完整单词 或 完整单词:完整单词
    const answerMap = new Map();
    const duplicateCheck = new Map(); // 跟踪重复的完整单词

    for (const line of answerLines) {
      const [key, value] = line.split(':');
      if (key && value) {
        const cleanKey = key.trim();
        const cleanValue = value.trim();
        answerMap.set(cleanKey, cleanValue);

        // 记录完整单词的出现次数（用于处理重复）
        if (cleanKey === cleanValue) {
          duplicateCheck.set(cleanKey, (duplicateCheck.get(cleanKey) || 0) + 1);
        }
      }
    }

    // 将答案分配给题目，按前缀匹配
    for (const question of this.currentTask.questions) {
      if (question.type === 'fill-blank') {
        let fullWord = answerMap.get(question.prefix);
        let matchSource = 'exact';

        // 如果精确前缀不匹配，尝试模糊匹配
        if (!fullWord) {
          // 策略1：查找键以问题前缀开头的条目
          for (const [key, value] of answerMap.entries()) {
            if (key.startsWith(question.prefix)) {
              fullWord = value;
              matchSource = 'key_prefix';
              break;
            }
          }

          // 策略2：如果策略1失败，查找值以问题前缀开头的条目
          if (!fullWord) {
            for (const [key, value] of answerMap.entries()) {
              if (value.startsWith(question.prefix)) {
                fullWord = value;
                matchSource = 'value_prefix';
                break;
              }
            }
          }

          // 策略3：如果键值相同（完整单词:完整单词格式），尝试部分匹配
          if (!fullWord) {
            for (const [key, value] of answerMap.entries()) {
              if (key === value) {
                // 检查完整单词是否包含问题前缀作为子串
                if (key.includes(question.prefix)) {
                  fullWord = value;
                  matchSource = 'substring';
                  break;
                }
                // 或者问题前缀是否以完整单词开头（短前缀匹配长单词）
                if (question.prefix.startsWith(key.substring(0, Math.min(2, key.length)))) {
                  fullWord = value;
                  matchSource = 'reverse_prefix';
                  break;
                }
              }
            }
          }
        }

        if (fullWord) {
          // 提取缺失部分（完整单词减去前缀）
          let missingPart = '';
          let usedPrefix = question.prefix;

          if (fullWord.startsWith(question.prefix)) {
            // fullWord以问题前缀开头，直接提取剩余部分
            missingPart = fullWord.substring(question.prefix.length);
          } else if (question.prefix.length > 0) {
            // 尝试从fullWord中查找问题前缀的位置
            const prefixIndex = fullWord.indexOf(question.prefix);
            if (prefixIndex === 0) {
              missingPart = fullWord.substring(question.prefix.length);
            } else if (prefixIndex > 0) {
              // 前缀在中间，这可能意味着前缀不完整
              // 使用前缀之后的部分作为答案
              missingPart = fullWord.substring(prefixIndex + question.prefix.length);
            } else {
              // 无法找到前缀，使用完整单词作为答案（需要用户校对）
              missingPart = fullWord;
            }
          } else {
            missingPart = fullWord;
          }

          // 处理重复条目的特殊情况（如carbohydrates出现两次）
          if (matchSource === 'value_prefix' || matchSource === 'substring') {
            // 如果有重复，可能需要更精确的匹配
            const duplicateCount = duplicateCheck.get(fullWord) || 0;
            if (duplicateCount > 1) {
              // 对于重复的完整单词，检查下划线数量是否匹配
              if (missingPart.length !== question.underlineCount && question.underlineCount > 0) {
                // 尝试找到更合适的匹配
                for (const [key, value] of answerMap.entries()) {
                  if (value === fullWord && key.length > question.prefix.length) {
                    // 键更长，可能更匹配
                    if (value.startsWith(question.prefix)) {
                      const altMissingPart = value.substring(question.prefix.length);
                      if (altMissingPart.length === question.underlineCount) {
                        missingPart = altMissingPart;
                        break;
                      }
                    }
                  }
                }
              }
            }
          }

          question.answer = missingPart;
          // 根据答案长度更新下划线数量
          question.underlineCount = missingPart.length;

          // 记录匹配信息用于调试
          question.matchSource = matchSource;
          question.fullWord = fullWord;
        } else {
          // 没有找到匹配，标记为需要用户校对
          question.answer = '_'.repeat(question.underlineCount || 4);
          question.matchSource = 'not_found';
          console.warn(`未找到前缀"${question.prefix}"的答案匹配`);
        }
      }
    }
  }

  /**
   * 处理选择题答案
   */
  processMultipleChoiceAnswers(answerLines) {
    if (!this.currentTask || !this.currentTask.questions.length) return;

    // 答案格式：每行一个选项字母
    let questionIndex = 0;
    for (const line of answerLines) {
      const answer = line.trim();
      if (answer && /^[A-D]$/.test(answer)) {
        const question = this.currentTask.questions[questionIndex];
        if (question) {
          question.answer = answer;
          questionIndex++;
        }
      }
    }
  }

  /**
   * 重置解析器状态
   */
  reset() {
    this.currentModule = '';
    this.currentTitle = '';
    this.currentTask = null;
    this.currentModuleNumber = 1;
    this.parsedModuleNumbers = []; // 重置模块编号顺序跟踪
    this.result = {
      module: '',
      title: '',
      tasks: [], // 保持向后兼容
      modules: [] // 新结构
    };
    this.currentAnswer = '';
    this.inAnswerBlock = false;
    this.pendingAnswers = [];
  }

  /**
   * 生成标准化JSON结构
   */
  generateStandardJSON(parsedData) {
    // 检查是否有模块化结构，如果没有，回退到扁平结构
    let modules = [];

    if (parsedData.modules && parsedData.modules.length > 0) {
      // 使用新的模块化结构
      console.log(`生成标准化JSON: 使用模块化结构 (${parsedData.modules.length} 个模块)`);

      for (const moduleData of parsedData.modules) {
        const moduleNumber = moduleData.moduleNumber;
        const moduleName = moduleData.moduleName;
        const tasks = moduleData.tasks || [];

        console.log(`模块 ${moduleNumber} (${moduleName}): ${tasks.length} 个任务`);

        // 转换每个任务
        const formattedTasks = tasks.map(task => {
          return this.formatTaskForStandardJSON(task);
        });

        // 获取原始模块数据以保留难度和时间限制信息
        const originalModule = parsedData.modules.find(m => m.moduleNumber === moduleNumber);
        const difficulty = originalModule
          ? originalModule.difficulty
          : moduleNumber === 1
            ? 'fixed'
            : moduleNumber === 2
              ? 'adaptive'
              : 'unknown';
        const timeLimit = originalModule
          ? originalModule.timeLimit
          : moduleNumber === 1
            ? 1080
            : moduleNumber === 2
              ? 540
              : 0;

        modules.push({
          moduleNumber: moduleNumber,
          moduleName: moduleName,
          difficulty: difficulty,
          timeLimit: timeLimit,
          tasks: formattedTasks
        });
      }
    } else {
      // 回退到扁平结构（向后兼容）
      console.log(`生成标准化JSON: 使用扁平结构 (${parsedData.tasks.length} 个任务)`);

      // 将扁平的任务数组转换为模块化结构（假设所有任务都属于模块1）
      const formattedTasks = (parsedData.tasks || []).map(task => {
        return this.formatTaskForStandardJSON(task);
      });

      modules = [
        {
          moduleNumber: 1,
          moduleName: 'Module 1',
          difficulty: 'fixed', // 扁平结构默认所有任务属于固定难度的模块1
          timeLimit: 1080, // 默认时间限制：18分钟
          tasks: formattedTasks
        }
      ];
    }

    // 计算总题目数并创建扁平任务数组（用于向后兼容）
    let totalQuestions = 0;
    const allTasks = [];

    for (const module of modules) {
      for (const task of module.tasks) {
        totalQuestions += task.questions ? task.questions.length : 0;
        // 为每个任务添加模块信息
        const taskWithModuleInfo = {
          ...task,
          moduleNumber: module.moduleNumber,
          moduleName: module.moduleName,
          difficulty: module.difficulty,
          timeLimit: module.timeLimit
        };
        allTasks.push(taskWithModuleInfo);
      }
    }

    return {
      version: '2.0', // 更新版本以表示支持模块化结构
      totalModules: modules.length,
      totalQuestions: totalQuestions,
      modules: modules,
      tasks: allTasks // 扁平任务数组，用于向后兼容
    };
  }

  /**
   * 格式化任务为标准JSON格式
   */
  formatTaskForStandardJSON(task) {
    // 转换任务类型名称
    let moduleType = task.type;
    if (task.type === 'fill-blank') {
      moduleType = 'complete_words';
    } else if (task.type === 'multiple-choice') {
      moduleType = 'multiple_choice';
    } else if (task.type === 'reading-passage') {
      moduleType = 'reading_passage';
    }

    // 处理填空题的特殊转换
    let questions = task.questions;
    if (task.type === 'fill-blank') {
      questions = (questions || []).map(q => ({
        id: q.id,
        type: 'fill-blank', // 添加类型字段以兼容阅读模块
        prefix: q.prefix,
        answer: q.answer,
        // 生成占位符：根据下划线数量生成相应数量的下划线
        placeholder: '_'.repeat(q.underlineCount),
        // 同时提供underlineCount和underscoreCount以确保兼容性
        underlineCount: q.underlineCount,
        underscoreCount: q.underlineCount,
        // 生成完整单词用于fullText字段
        fullText: (q.prefix || '') + (q.answer || ''),
        // 保留原始字段以便调试
        originalUnderlineCount: q.underlineCount,
        matchSource: q.matchSource || 'auto',
        fullWord: q.fullWord || ''
      }));
    } else if (questions) {
      // 其他题型保持原样
      questions = questions.map(q => ({
        id: q.id,
        type: q.type,
        ...q
      }));
    }

    return {
      type: moduleType,
      // 主应用兼容性字段
      title: task.title, // extractQuestions 方法期望 task.title
      taskTitle: task.title, // 原始字段保持不变
      taskDescription: task.description || '',
      paragraph: task.passage || '', // 对于填空题，passage可能为空，需要从fullText中提取
      passage: task.passage || '', // 别名，用于与阅读模块兼容
      questions: questions || []
    };
  }
}

// 导出解析器实例
export const parser = new QuestionParser();
