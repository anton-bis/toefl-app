import { createExamDocument } from '../pages.js';
import { linesOf, media, normalizeMarkdown, seconds, sourceMeta } from '../shared.js';

const TASK_TYPES = {
  'Listen and Repeat': 'listen-repeat',
  'Take an Interview': 'interview'
};

function parseTask({ base, body, number: taskNumber, id, questionIdPrefix, title }) {
  const type = TASK_TYPES[base];
  const task = {
    id,
    number: taskNumber,
    title,
    type,
    scenario: { title: '', image: '' },
    image: null,
    media: null,
    questions: []
  };
  let audio = '';
  let current = null;
  for (const raw of linesOf(body)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('scenario_title:')) {
      task.scenario.title = line.slice(15).trim();
      continue;
    }
    if (line.startsWith('scenario_image:')) {
      task.scenario.image = line.slice(15).trim();
      continue;
    }
    if (line.startsWith('image:') && !current) {
      task.image = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('audio:')) {
      const file = line.slice(6).trim();
      if (current) {
        current.media = media(file);
      } else {
        audio = file;
        task.media = media(file);
      }
      continue;
    }
    const q = line.match(/^(\d+)\.?\s*$/);
    if (q) {
      const questionNumber = Number(q[1]);
      const defaultTime =
        type === 'interview' ? 45 : questionNumber <= 2 ? 8 : questionNumber <= 5 ? 10 : 12;
      current = {
        id: `${questionIdPrefix}${questionNumber}`,
        number: questionNumber,
        type,
        prompt: '',
        transcript: '',
        image: '',
        responseTime: defaultTime,
        media: null,
        answer: null,
        options: []
      };
      task.questions.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith('image:')) current.image = line.slice(6).trim();
    else if (line.startsWith('transcript:')) {
      current.transcript = line.slice(11).trim();
      current.prompt = current.transcript;
    } else if (line.startsWith('response_time:'))
      current.responseTime = Number(line.slice(14).trim());
    else {
      const play = line.match(/^>>\s*play:\s*(\d+:\d+)\s*-\s*(\d+:\d+)/);
      if (play) current.media = media(audio, seconds(play[1]), seconds(play[2]));
    }
  }
  for (const question of task.questions) {
    if (!question.media) question.media = media(audio);
    if (!question.image && task.image) question.image = task.image;
  }
  return task;
}

export function parseSpeaking(markdown, options = {}) {
  const meta = sourceMeta('speaking', options);
  const sections = [];
  const regex =
    /^### (Listen and Repeat|Take an Interview)\s*(?:[–-]\s*(\d+))?\s*\n([\s\S]*?)(?=^### |(?![\s\S]))/gm;
  for (const match of normalizeMarkdown(markdown).matchAll(regex))
    sections.push({ base: match[1], label: match[2] ? Number(match[2]) : null, body: match[3] });

  const totals = {};
  for (const section of sections) totals[section.base] = (totals[section.base] || 0) + 1;

  const counters = {};
  const tasks = [];
  for (const section of sections) {
    const type = TASK_TYPES[section.base];
    const multiple = totals[section.base] > 1;
    let id;
    let questionIdPrefix;
    let title;
    if (multiple) {
      counters[section.base] = (counters[section.base] || 0) + 1;
      const index = counters[section.base];
      id = `${type}-${index}`;
      questionIdPrefix = `module-1-${type}-${index}-q`;
      title = `${section.base} ${index}`;
    } else {
      id = type;
      questionIdPrefix = `module-1-${type}-q`;
      title = section.base;
    }
    tasks.push(
      parseTask({
        base: section.base,
        body: section.body,
        number: tasks.length + 1,
        id,
        questionIdPrefix,
        title
      })
    );
  }
  return createExamDocument(meta, [{ id: 'module-1', number: 1, title: 'Speaking', tasks }]);
}
