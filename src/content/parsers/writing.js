import { createExamDocument } from '../pages.js';
import { linesOf, normalizeMarkdown, sourceMeta } from '../shared.js';

function sectionBodies(markdown) {
  const result = new Map();
  const regex =
    /^## (Build a Sentence|Write an Email|Write for an Academic Discussion)\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/gm;
  for (const match of normalizeMarkdown(markdown).matchAll(regex)) result.set(match[1], match[2]);
  return result;
}

function buildSentenceQuestions(body) {
  const result = [];
  const regex = /^### Build a Sentence\s*[–-]\s*(\d+)\s*\n([\s\S]*?)(?=^### |(?![\s\S]))/gm;
  for (const match of (body || '').matchAll(regex)) {
    const fields = linesOf(match[2]);
    const value = prefix =>
      fields
        .find(line => line.trim().startsWith(prefix))
        ?.trim()
        .slice(prefix.length)
        .trim() || '';
    const answer =
      match[2]
        .match(/\\?\[ANSWER\\?\]\s*([\s\S]*?)\s*\\?\[\/ANSWER\\?\]/)?.[1]
        .replace(/\\\./g, '.')
        .trim() || null;
    const number = Number(match[1]);
    result.push({
      id: `writing-build-q${number}`,
      number,
      type: 'build-sentence',
      prompt: value('Speaker B:'),
      speakerA: value('Speaker A:'),
      candidates: value('Candidates:')
        .split('/')
        .map(value => value.trim())
        .filter(Boolean),
      answer,
      options: []
    });
  }
  return result;
}

function metadataQuestion(body, kind) {
  const questionMatch = body?.match(
    new RegExp(
      `^### ${kind.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*[–-]\\s*(\\d+)\\s*\\n([\\s\\S]*?)(?=^### |(?![\\s\\S]))`,
      'm'
    )
  );
  if (!questionMatch) return [];
  const lines = linesOf(questionMatch[2]);
  const data = {};
  const requirements = [];
  const students = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === 'Requirements:') continue;
    if (line.startsWith('- ')) {
      requirements.push(line.slice(2).trim());
      continue;
    }
    const match = line.match(/^([A-Za-z_ ]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    if (!['identity', 'to', 'subject', 'instructor', 'professor', 'hint'].includes(key)) {
      students.push({ name: match[1], text: match[2] });
    } else data[key] = match[2];
  }
  const number = Number(questionMatch[1]);
  const type = kind === 'Write an Email' ? 'write-email' : 'academic-discussion';
  return [
    {
      id: `writing-${type}-q${number}`,
      number,
      type,
      prompt: data.identity || data.professor || '',
      ...data,
      students,
      requirements,
      answer: null,
      options: []
    }
  ];
}

export function parseWriting(markdown, options = {}) {
  const meta = sourceMeta('writing', options);
  const bodies = sectionBodies(markdown);
  const tasks = [
    {
      id: 'build-sentence',
      number: 1,
      title: 'Build a Sentence',
      type: 'build-sentence',
      questions: buildSentenceQuestions(bodies.get('Build a Sentence'))
    },
    {
      id: 'write-email',
      number: 2,
      title: 'Write an Email',
      type: 'write-email',
      questions: metadataQuestion(bodies.get('Write an Email'), 'Write an Email')
    },
    {
      id: 'academic-discussion',
      number: 3,
      title: 'Write for an Academic Discussion',
      type: 'academic-discussion',
      questions: metadataQuestion(
        bodies.get('Write for an Academic Discussion'),
        'Write for an Academic Discussion'
      )
    }
  ];
  return createExamDocument(meta, [{ id: 'module-1', number: 1, title: 'Writing', tasks }]);
}
