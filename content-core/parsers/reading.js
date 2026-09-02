import { createExamDocument } from '../pages.js';
import { normalizeMarkdown, optionsFrom, sourceMeta, slug } from '../shared.js';

const TYPES = [
  ['Fill in the missing letters', 'complete-words'],
  ['Complete the Words', 'complete-words'],
  ['Text Chain', 'text-chain'],
  ['Academic Passage', 'academic-passage'],
  ['Advertisement', 'advertisement'],
  ['Social Media Post', 'social-media'],
  ['Label', 'label'],
  ['Receipt', 'receipt'],
  ['Notice', 'notice'],
  ['Announcement', 'announcement'],
  ['Email', 'email'],
  ['Poster', 'poster'],
  ['Instructions', 'instructions'],
  ['Form', 'form'],
  ['Read a Sign', 'sign'],
  ['Read a Web Page', 'web-page'],
  ['Read a Review', 'review']
];

function questionType(title) {
  const match = TYPES.find(([needle]) => title.includes(needle));
  if (match) return match[1];
  throw new Error(`Unsupported reading task type in title: "${title}". Add it to TYPES in content-core/parsers/reading.js.`);
}

/**
 * Find the character index where real questions begin.
 * A numbered line only counts as a question when it is followed by an
 * option block starting with "A."; this avoids mistaking numbered lists in
 * passage bodies (e.g. "1. Book Returns: ...") for questions.
 */
function findQuestionStart(content) {
  const lines = content.split('\n');
  let index = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!/^\d+\.\s/.test(line)) {
      index += line.length + 1;
      continue;
    }
    for (let lookahead = lineIndex + 1; lookahead < lines.length; lookahead += 1) {
      const candidate = lines[lookahead].trim();
      if (/^[A-E]\.\s/.test(candidate)) return index;
      if (/^\d+\.\s/.test(candidate) || !candidate) break;
    }
    index += line.length + 1;
  }
  return -1;
}

function parseChoiceQuestions(text, moduleId, taskId, type) {
  const questions = [];
  const regex = /(?:^|\n)(\d+)\.\s*([\s\S]*?)(?=\n\d+\.\s*|$)/g;
  for (const match of text.matchAll(regex)) {
    const block = match[2].trim();
    const firstOption = block.search(/^A\.\s/m);
    const answer =
      block.match(/\\?\[ANSWER\\?\]\s*([\s\S]*?)\s*\\?\[\/ANSWER\\?\]/)?.[1].trim() || null;
    if (firstOption < 0 && !answer) continue;
    const prompt = (firstOption < 0 ? block : block.slice(0, firstOption))
      .replace(/\\?\[ANSWER\\?\][\s\S]*$/, '')
      .trim();
    const optionPart = firstOption < 0 ? '' : block.slice(firstOption);
    const options = [];
    for (const option of optionPart.matchAll(
      /^([A-D])\.\s*([\s\S]*?)(?=\n[A-D]\.\s|\n\\?\[ANSWER\\?\]|$)/gm
    )) {
      options.push([option[1], option[2].trim()]);
    }
    questions.push({
      id: `${moduleId}-${taskId}-q${match[1]}`,
      number: Number(match[1]),
      type,
      prompt,
      options: optionsFrom(options),
      answer
    });
  }
  return questions;
}

function parseFill(content, moduleId, taskId, start, end) {
  const answerMatch = content.match(/\\?\[ANSWER\\?\]([\s\S]*?)\\?\[\/ANSWER\\?\]/);
  const passage = (answerMatch ? content.slice(0, answerMatch.index) : content).trim();
  const answers = (answerMatch?.[1] || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const colon = line.indexOf(':');
      return colon < 0 ? line : line.slice(colon + 1).trim();
    });
  return Array.from({ length: end - start + 1 }, (_, index) => ({
    id: `${moduleId}-${taskId}-q${start + index}`,
    number: start + index,
    type: 'complete-words',
    prompt: passage,
    blankIndex: index,
    answer: answers[index] || null,
    options: []
  }));
}

export function parseReading(markdown, options = {}) {
  const meta = sourceMeta('reading', options);
  const modules = [];
  const moduleRegex = /^## Module\s+(\d+)([^\n]*)\n([\s\S]*?)(?=^## Module\s+\d+|(?![\s\S]))/gm;
  for (const moduleMatch of normalizeMarkdown(markdown).matchAll(moduleRegex)) {
    const moduleNumber = Number(moduleMatch[1]);
    const moduleId = `module-${moduleNumber}`;
    const tasks = [];
    const taskRegex =
      /^### Task\s+(\d+)\s+(.+?)\s*\(Questions\s+(\d+)[–-](\d+)\)\s*\n([\s\S]*?)(?=^### Task\s+|(?![\s\S]))/gm;
    for (const taskMatch of moduleMatch[3].matchAll(taskRegex)) {
      const number = Number(taskMatch[1]);
      const title = taskMatch[2].trim();
      const type = questionType(title);
      const taskId = `task-${number}-${slug(type)}`;
      const start = Number(taskMatch[3]);
      const end = Number(taskMatch[4]);
      const content = taskMatch[5]
        .trim()
        .replace(/^---\s*$/gm, '')
        .trim();
      const firstQuestion = findQuestionStart(content);
      const passage =
        firstQuestion < 0
          ? content.replace(/\\?\[ANSWER\\?\][\s\S]*$/, '').trim()
          : content.slice(0, firstQuestion).trim();
      const questions =
        type === 'complete-words'
          ? parseFill(content, moduleId, taskId, start, end)
          : parseChoiceQuestions(content.slice(Math.max(0, firstQuestion)), moduleId, taskId, type);
      questions.forEach((question, index) => {
        question.number = start + index;
      });
      if (type !== 'complete-words') {
        const answerBlocks = [
          ...content.matchAll(/\\?\[ANSWER\\?\]\s*([\s\S]*?)\s*\\?\[\/ANSWER\\?\]/g)
        ];
        if (answerBlocks.length === 1) {
          const grouped = answerBlocks[0][1]
            .split('\n')
            .map(value => value.trim())
            .filter(Boolean);
          if (grouped.length === questions.length)
            questions.forEach((question, index) => {
              question.answer = grouped[index];
            });
        }
      }
      tasks.push({
        id: taskId,
        number,
        title,
        type,
        questionRange: [start, end],
        passage,
        questions
      });
    }
    modules.push({ id: moduleId, number: moduleNumber, title: `Module ${moduleNumber}`, tasks });
  }
  return createExamDocument(meta, modules);
}
