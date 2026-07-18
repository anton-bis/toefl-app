import { createExamDocument } from '../pages.js';
import {
  linesOf,
  media,
  normalizeMarkdown,
  optionsFrom,
  seconds,
  sourceMeta,
  slug
} from '../shared.js';

function typeFor(title) {
  const value = title.toLowerCase();
  if (value.includes('choose a response')) return 'listen-response';
  if (value.includes('conversation')) return 'conversation';
  if (value.includes('announcement')) return 'announcement';
  if (value.includes('talk')) return 'academic-talk';
  return 'listening';
}

function createQuestion(match, state) {
  const spokenPrompt = state.type === 'listen-response';
  return {
    id: `${state.moduleId}-${state.taskId}-q${match[1]}`,
    number: Number(match[1]),
    type: state.type,
    prompt: spokenPrompt ? '' : match[2].trim(),
    transcript: spokenPrompt ? match[2].trim() : '',
    options: [],
    answer: null,
    media: null
  };
}

function consumeMarker(marker, state) {
  if (marker === '[ANSWER]') state.inAnswers = true;
  else if (marker === '[/ANSWER]') state.inAnswers = false;
  else return false;
  return true;
}

function consumeQuestionLine(line, state) {
  const match = line.match(/^(\d+)\.\s*(.+)$/);
  if (!match) return false;
  state.current = createQuestion(match, state);
  state.questions.push(state.current);
  return true;
}

function consumeOptionLine(line, state) {
  const match = line.match(/^([A-D])\.\s*(.+)$/);
  if (!match || !state.current) return false;
  state.current.options.push([match[1], match[2]]);
  return true;
}

function consumePlayLine(line, state) {
  const match = line.match(/^>>\s*play:\s*(\d+:\d+)\s*-\s*(\d+:\d+)/);
  if (!match) return false;
  const start = seconds(match[1]);
  const end = seconds(match[2]);
  if (state.current && state.type === 'listen-response') {
    state.current.media = media(state.audio, start, end);
  } else {
    state.taskStart = start;
    state.taskEnd = end;
  }
  return true;
}

function consumeAnswerOrAudio(line, state) {
  if (state.inAnswers) {
    state.answers.push(line);
    return true;
  }
  if (!line.startsWith('audio:')) return false;
  state.audio = line.slice(6).trim();
  return true;
}

function consumeTaskLine(raw, state) {
  const line = raw.trim();
  if (!line || line === '---') return;
  const marker = line.replaceAll('\\[', '[').replaceAll('\\]', ']');
  if (consumeMarker(marker, state)) return;
  if (consumeAnswerOrAudio(line, state)) return;
  if (consumeQuestionLine(line, state) || consumeOptionLine(line, state)) return;
  if (consumePlayLine(line, state)) return;
  if (!state.current || state.type !== 'listen-response') state.transcript.push(line);
}

function parseTask(title, body, moduleId, taskNumber) {
  const type = typeFor(title);
  const taskId = `task-${taskNumber}-${slug(type)}`;
  const state = {
    type,
    taskId,
    moduleId,
    audio: '',
    taskStart: null,
    taskEnd: null,
    current: null,
    answers: [],
    inAnswers: false,
    transcript: [],
    questions: []
  };
  for (const line of linesOf(body)) consumeTaskLine(line, state);

  state.questions.forEach((question, index) => {
    question.options = optionsFrom(question.options);
    question.answer = state.answers[index] || null;
    if (!question.media) question.media = media(state.audio, state.taskStart, state.taskEnd);
  });
  const range = title.match(/Questions?\s+(\d+)[–-](\d+)/i);
  return {
    id: taskId,
    number: taskNumber,
    title,
    type,
    questionRange: range
      ? [Number(range[1]), Number(range[2])]
      : state.questions.length
        ? [state.questions[0].number, state.questions.at(-1).number]
        : null,
    transcript: state.transcript.join('\n'),
    media: media(state.audio, state.taskStart, state.taskEnd),
    questions: state.questions
  };
}

export function parseListening(markdown, options = {}) {
  const meta = sourceMeta('listening', options);
  const normalized = normalizeMarkdown(markdown).replace(/^Module\s+(\d+)\s*$/gm, '## Module $1');
  const modules = [];
  const moduleRegex = /^## Module\s+(\d+)[^\n]*\n([\s\S]*?)(?=^## Module\s+\d+|(?![\s\S]))/gm;
  for (const moduleMatch of normalized.matchAll(moduleRegex)) {
    const number = Number(moduleMatch[1]);
    const moduleId = `module-${number}`;
    const tasks = [];
    const taskRegex = /^###\s+(.+?)\s*\n([\s\S]*?)(?=^###\s+|(?![\s\S]))/gm;
    let taskNumber = 0;
    for (const taskMatch of moduleMatch[2].matchAll(taskRegex)) {
      tasks.push(parseTask(taskMatch[1].trim(), taskMatch[2], moduleId, ++taskNumber));
    }
    modules.push({ id: moduleId, number, title: `Module ${number}`, tasks });
  }
  return createExamDocument(meta, modules);
}
