import { createExamDocument } from '../pages.js';
import { linesOf, media, normalizeMarkdown, seconds, sourceMeta } from '../shared.js';

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
    if (line.startsWith('audio:')) {
      audio = line.slice(6).trim();
      task.media = media(audio);
      continue;
    }
    const q = line.match(/^(\d+)\.?\s*$/);
    if (q) {
      const number = Number(q[1]);
      const defaultTime = type === 'interview' ? 45 : number <= 2 ? 8 : number <= 5 ? 10 : 12;
      current = {
        id: `module-1-${type}-q${number}`,
        number,
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
  for (const question of task.questions) if (!question.media) question.media = media(audio);
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
