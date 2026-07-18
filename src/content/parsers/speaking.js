import { createExamDocument } from '../pages.js';
import { linesOf, media, normalizeMarkdown, seconds, sourceMeta } from '../shared.js';

function responseTime(type, number) {
  if (type === 'interview') return 45;
  if (number <= 2) return 8;
  if (number <= 5) return 10;
  return 12;
}

function createQuestion(type, number) {
  return {
    id: `module-1-${type}-q${number}`,
    number,
    type,
    prompt: '',
    transcript: '',
    image: '',
    responseTime: responseTime(type, number),
    media: null,
    answer: null,
    options: []
  };
}

function consumeQuestionProperty(line, state) {
  if (line.startsWith('image:')) state.current.image = line.slice(6).trim();
  else if (line.startsWith('transcript:')) {
    state.current.transcript = line.slice(11).trim();
    state.current.prompt = state.current.transcript;
  } else if (line.startsWith('response_time:')) {
    state.current.responseTime = Number(line.slice(14).trim());
  } else return false;
  return true;
}

function consumeTaskLine(raw, task, state) {
  const line = raw.trim();
  if (!line) return;
  if (line.startsWith('scenario_title:')) task.scenario.title = line.slice(15).trim();
  else if (line.startsWith('scenario_image:')) task.scenario.image = line.slice(15).trim();
  else if (line.startsWith('audio:')) {
    state.audio = line.slice(6).trim();
    task.media = media(state.audio);
  } else {
    const question = line.match(/^(\d+)\.?\s*$/);
    if (question) {
      state.current = createQuestion(task.type, Number(question[1]));
      task.questions.push(state.current);
    } else if (state.current && !consumeQuestionProperty(line, state)) {
      const play = line.match(/^>>\s*play:\s*(\d+:\d+)\s*-\s*(\d+:\d+)/);
      if (play) state.current.media = media(state.audio, seconds(play[1]), seconds(play[2]));
    }
  }
}

function parseTask(title, body, taskNumber) {
  const type = title === 'Listen and Repeat' ? 'listen-repeat' : 'interview';
  const task = {
    id: type,
    number: taskNumber,
    title,
    type,
    scenario: { title: '', image: '' },
    media: null,
    questions: []
  };
  const state = { audio: '', current: null };
  for (const line of linesOf(body)) consumeTaskLine(line, task, state);
  for (const question of task.questions) if (!question.media) question.media = media(state.audio);
  return task;
}

export function parseSpeaking(markdown, options = {}) {
  const meta = sourceMeta('speaking', options);
  const tasks = [];
  const regex = /^### (Listen and Repeat|Take an Interview)\s*\n([\s\S]*?)(?=^### |(?![\s\S]))/gm;
  for (const match of normalizeMarkdown(markdown).matchAll(regex))
    tasks.push(parseTask(match[1], match[2], tasks.length + 1));
  return createExamDocument(meta, [{ id: 'module-1', number: 1, title: 'Speaking', tasks }]);
}
