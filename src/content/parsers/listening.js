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

function parseTask(title, body, moduleId, taskNumber) {
  const type = typeFor(title);
  const taskId = `task-${taskNumber}-${slug(type)}`;
  const lines = linesOf(body);
  let audio = '';
  let taskStart = null;
  let taskEnd = null;
  let current = null;
  const answers = [];
  let inAnswers = false;
  const transcript = [];
  const questions = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === '---') continue;
    const marker = line.replaceAll('\\[', '[').replaceAll('\\]', ']');
    if (marker === '[ANSWER]') {
      inAnswers = true;
      continue;
    }
    if (marker === '[/ANSWER]') {
      inAnswers = false;
      continue;
    }
    if (inAnswers) {
      answers.push(line);
      continue;
    }
    if (line.startsWith('audio:')) {
      audio = line.slice(6).trim();
      continue;
    }

    const questionMatch = line.match(/^(\d+)\.\s*(.+)$/);
    if (questionMatch) {
      current = {
        id: `${moduleId}-${taskId}-q${questionMatch[1]}`,
        number: Number(questionMatch[1]),
        type,
        prompt: type === 'listen-response' ? '' : questionMatch[2].trim(),
        transcript: type === 'listen-response' ? questionMatch[2].trim() : '',
        options: [],
        answer: null,
        media: null
      };
      questions.push(current);
      continue;
    }
    const optionMatch = line.match(/^([A-D])\.\s*(.+)$/);
    if (optionMatch && current) {
      current.options.push([optionMatch[1], optionMatch[2]]);
      continue;
    }
    const play = line.match(/^>>\s*play:\s*(\d+:\d+)\s*-\s*(\d+:\d+)/);
    if (play) {
      if (current && type === 'listen-response')
        current.media = media(audio, seconds(play[1]), seconds(play[2]));
      else {
        taskStart = seconds(play[1]);
        taskEnd = seconds(play[2]);
      }
      continue;
    }
    if (!current || type !== 'listen-response') transcript.push(line);
  }

  questions.forEach((question, index) => {
    question.options = optionsFrom(question.options);
    question.answer = answers[index] || null;
    if (!question.media) question.media = media(audio, taskStart, taskEnd);
  });
  const range = title.match(/Questions?\s+(\d+)[–-](\d+)/i);
  return {
    id: taskId,
    number: taskNumber,
    title,
    type,
    questionRange: range
      ? [Number(range[1]), Number(range[2])]
      : questions.length
        ? [questions[0].number, questions.at(-1).number]
        : null,
    transcript: transcript.join('\n'),
    media: media(audio, taskStart, taskEnd),
    questions
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
