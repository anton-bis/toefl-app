const START_DIRECTIONS = {
  reading: {
    description:
      'In the reading section, you will answer 35 - 48 questions to demonstrate how well you understand academic and non-academic texts in English. There are three types of tasks.',
    tasks: [
      ['Complete the Words', 'Fill in the missing letters in a paragraph.'],
      ['Read in Daily Life', 'Answer questions about everyday reading material.'],
      ['Read an Academic Passage', 'Answer questions about academic passages.']
    ]
  },
  listening: {
    description:
      'In the listening section, you will answer 35 - 45 questions to demonstrate how well you understand spoken English. There are three types of tasks.',
    tasks: [
      ['Listen and Choose a Response', 'Select the best response to the questions or statement.'],
      ['Conversations', 'Answer questions about short conversations.'],
      [
        'Announcements and Academic Talks',
        'Answer questions about announcements and academic talks.'
      ]
    ],
    note: 'You WILL NOT be able to return to previous questions.'
  },
  writing: {
    description:
      'In the writing section, you will answer 12 questions to demonstrate how well you can write in English. There are three types of tasks.',
    tasks: [
      ['Build a Sentence', 'Create a grammatical sentence.'],
      ['Write an Email', 'Write an email using information provided.'],
      ['Write for an Academic Discussion', 'Participate in online discussions.']
    ]
  },
  speaking: {
    description:
      'In the speaking section, you will answer 11 questions to demonstrate how well you can speak English. There are two types of tasks.',
    tasks: [
      ['Listen and Repeat', 'Listen and repeat what you heard.'],
      ['Take an Interview', 'Answer questions from the interviewer.']
    ]
  }
};

const WRITING_INTROS = {
  'build-sentence': [
    'Move the words in the boxes to create a grammatical sentence.',
    'A clock will show you how much time you have to complete this task.'
  ],
  'write-email': [
    'You will read some information and use the information to write an email.',
    'You will have 7 minutes to write the email.'
  ],
  'academic-discussion': [
    'A professor has posted a question about a topic and students have responded with their thoughts and ideas. Make a contribution to the discussion.',
    'You will have 10 minutes to write.'
  ]
};

export function startDirections(section) {
  return START_DIRECTIONS[String(section).toLowerCase()] || {};
}

export function introDirections(section, page, task) {
  const normalized = String(section).toLowerCase();
  if (normalized === 'reading') {
    return page.moduleId === 'module-2'
      ? ['The clock shows how much time you have to complete Module 2.']
      : [
        'The clock will show you how much time you have to complete Module 1.',
        'You can use NEXT and BACK to move to the next question or return to previous questions within the same module.',
        'You WILL NOT be able to return to Module 1 once you have begun Module 2.'
      ];
  }
  if (normalized === 'listening') {
    const lines = [
      'The clock will show you how much time you have to complete each question.',
      'You can use Next to move to the next question.'
    ];
    if (page.moduleId === 'module-1') {
      lines.push(
        'The first task is Listen and Choose a Response. In this task, you will listen to a sentence or question. You will then read four sentences and choose the option that is the best response.'
      );
    } else lines.push('You WILL NOT be able to return to previous questions.');
    return lines;
  }
  if (normalized === 'writing') return WRITING_INTROS[task?.id] || [];
  if (normalized === 'speaking') {
    return task?.type === 'interview'
      ? [
        'An interviewer will ask you questions. Answer the questions and be sure to speak as much as you can in the time allowed.',
        'No time for preparation will be provided.'
      ]
      : [
        'You will listen as someone speaks to you. Listen carefully and then repeat what you have heard. The clock will indicate how much time you have to speak.',
        'No time for preparation will be provided.'
      ];
  }
  return [];
}

const START_HELP = {
  reading:
    '1. Complete the Words: Fill missing letters in paragraphs\n2. Read in Daily Life: Answer questions about everyday texts\n3. Read an Academic Passage: Answer questions about academic texts',
  listening: '正式考试中，此页面会朗读一遍听力考试规则，随后直接跳转至下一页。',
  speaking:
    'The Speaking section includes two types of tasks: Listen and Repeat, and Take an Interview. You will answer 11 questions in total.',
  writing:
    'Formal exam: This page will read the writing section rules once, then automatically proceed to the next page.'
};

const QUESTION_HELP = {
  'complete-words':
    '1. Fill in the missing letters in the green-bordered boxes\n2. Each small box represents one missing letter\n3. Use Tab or arrow keys to move between boxes\n4. Numbers below boxes indicate question order',
  notice:
    '1. Read the notice on the left\n2. Answer the question on the right by clicking one of the options\n3. Use Questions to revisit or mark questions\n4. Click Next to continue',
  advertisement:
    '1. Read the notice on the left\n2. Answer the question on the right by clicking one of the options\n3. Use Questions to revisit or mark questions\n4. Click Next to continue',
  'social-media':
    '1. Read the social media post on the left\n2. Answer the question on the right by clicking one of the options\n3. Use Questions to revisit or mark questions\n4. Click Next to continue',
  'text-chain':
    '1. Read the text chain conversation on the left\n2. Answer the question on the right by clicking one of the options\n3. Use Questions to revisit or mark questions\n4. Click Next to continue',
  email:
    '1. Read the email carefully\n2. Answer the question on the right by clicking one of the options\n3. Use Questions to revisit or mark questions\n4. Click Next to continue',
  'academic-passage':
    '1. Read the academic passage carefully\n2. Select the best answer\n3. Use Questions to revisit or mark questions\n4. Click Next to continue',
  'build-sentence':
    'Build a Sentence\n\n• Click a word to place it into the first empty blank.\n• Click a filled blank to return the word.\n• Drag and drop to rearrange or swap.\n• Use Questions to revisit or mark sentences.\n• Click Next to continue.',
  'write-email':
    '1. Read the prompt on the left carefully.\n2. Write your email in the text area on the right.\n3. Use Cut, Paste, Undo, and Redo to edit your writing.\n4. Your word count is displayed in the toolbar. Click Hide Word Count to toggle visibility.\n5. Click Next when you have finished writing.',
  'academic-discussion':
    '1. Read the professor\'s question and other students\' responses on the left.\n2. Write your own contribution to the discussion in the text area on the right.\n3. Use Cut, Paste, Undo, and Redo to edit your writing.\n4. Your word count is displayed in the toolbar. Click Hide Word Count to toggle visibility.\n5. Click Next when you have finished writing.'
};

const WRITING_INTRO_HELP = {
  'build-sentence':
    'Build a Sentence: Move words from the word bank into the blanks to create a grammatical sentence. Click a word to place it, click a filled blank to return it. You can also drag and drop words to rearrange or swap them.',
  'write-email':
    'Write an Email: Read the prompt carefully and write an email based on the information provided. Make sure to include all the required points and address them clearly. Keep your tone appropriate for the audience and purpose. You can use Cut, Paste, Undo, and Redo buttons in the toolbar to edit your writing.',
  'academic-discussion':
    'Write for an Academic Discussion: Read the professor\'s question and the responses from other students. Then write your own contribution to the discussion. Make sure to express your opinion clearly and support it with reasons or examples. You can respond to or build upon other students\' ideas. Use the toolbar buttons to edit your writing.'
};

export function helpCopy(section, page = {}, task = {}) {
  const normalized = String(section).toLowerCase();
  if (page.help) return page.help;
  if (page.type === 'start') return START_HELP[normalized] || '';
  if (page.type === 'intro') {
    if (normalized === 'listening' || normalized === 'speaking')
      return `正式考试中，此页面会朗读一遍${normalized === 'listening' ? '听力' : '口语'}考试规则，随后直接跳转至下一页。`;
    if (normalized === 'reading')
      return page.moduleId === 'module-2'
        ? '1. You have a 9-minute timer to complete Module 2.\n2. Begin will navigate to Module 2 task set.\n3. You cannot return to this introduction after starting Module 2.'
        : '1. You have limited time to complete Module 1\n2. Use Next/Back buttons to navigate questions\n3. Once you start Module 2, you cannot return to Module 1';
    if (normalized === 'writing') return WRITING_INTRO_HELP[task.id] || '';
  }
  if (normalized === 'listening') {
    if (page.type === 'stimulus')
      return '正式考试当中不会出现播放器播放按钮。进入此页面后，将会自动开始播放音频。音频播放完毕后，系统将自动跳转至题目。';
    if (task.type === 'listen-response')
      return '正式考试当中不会出现播放器播放按钮。进入此页面后，将会自动开始播放音频。你有 20 秒时间作答。时间截止后，你将不会被允许修改答案，系统将自动跳转至下一题。';
    return '正式考试当中不会出现播放器播放按钮。你有 20/30 秒时间作答。时间截止后，你将不会被允许修改答案，系统将自动跳转至下一题。';
  }
  if (normalized === 'speaking') {
    if (page.type === 'scenario')
      return '在正式考试中，本页面会播报一遍主标题，随后自动跳转至下一页面进行答题。';
    return '点击播放按钮收听音频。音频播放完毕后，将在倒计时结束时自动开始录音。倒计时结束，录音自动保存。';
  }
  return QUESTION_HELP[task.type] || '';
}

export function readyPrompt(section, page = {}, task = {}) {
  const normalized = String(section).toLowerCase();
  let subject = task.title || page.title || 'this task';
  if (normalized === 'reading' || normalized === 'listening')
    subject = page.moduleId === 'module-2' ? 'Module 2' : 'Module 1';
  if (normalized === 'speaking')
    subject =
      task.type === 'interview' ? 'the Take an Interview task' : 'the Listen and Repeat task';
  return `Are you ready to begin ${subject}?\nOnce you start, you cannot return to this introduction.`;
}

export function expirationCopy(section) {
  return String(section).toLowerCase() === 'writing'
    ? {
      body: 'Your time for this task has expired. You can continue working without time limit, or end this task to move on.',
      finish: 'End Task'
    }
    : {
      body: 'Module time has expired. You can continue working without time limit, or end now to view your results.',
      finish: 'Score and Exit'
    };
}
