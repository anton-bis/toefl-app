import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildQuestionManifest } from '../../src/content/manifest.js';
import { parseExamDocument } from '../../src/content/parsers/index.js';
import { validateExamDocument } from '../../src/content/validate.js';
import {
  generateQuestionManifest,
  scanQuestionFiles
} from '../../scripts/generate-question-manifest.js';
import { copyRuntimeContent } from '../../vite.config.js';

const root = path.resolve(import.meta.dirname, '../..');
const manifest = generateQuestionManifest(root);
const committedManifest = JSON.parse(
  fs.readFileSync(path.join(root, 'src/content/question-manifest.json'), 'utf8')
);

test('manifest discovery is deterministic and complete', () => {
  const paths = scanQuestionFiles(root);
  assert.ok(paths.length > 0);
  assert.equal(manifest.entries.length, paths.length);
  assert.equal(new Set(manifest.entries.map(entry => entry.id)).size, manifest.entries.length);
  assert.deepEqual(buildQuestionManifest([...paths].reverse()).entries, manifest.entries);
  assert.deepEqual(manifest.entries, committedManifest.entries);
  assert.ok(manifest.tpos.every(tpo => Object.keys(tpo.sections).length > 0));
});

test('runtime asset copy excludes development directories without leaving empty shells', t => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'toefl-runtime-assets-'));
  const source = path.join(temporaryRoot, 'assets');
  const destination = path.join(temporaryRoot, 'dist', 'assets');
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  const fixtures = [
    ['images/qr.jpg', 'development image'],
    ['icons/icon.png', 'runtime icon'],
    ['questions/reading/TPO-01/reading-TPO-01.md', '# reading'],
    ['questions/vocabulary/manifest.json', '{}'],
    ['questions/vocabulary/ex-batches/batch.json', '{}'],
    ['questions/vocabulary/ex-batches/manifest.json', '{}']
  ];
  for (const [relativePath, contents] of fixtures) {
    const filePath = path.join(source, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }

  copyRuntimeContent(source, destination);

  assert.equal(fs.existsSync(path.join(destination, 'images')), false);
  assert.equal(fs.existsSync(path.join(destination, 'icons/icon.png')), true);
  assert.equal(
    fs.existsSync(path.join(destination, 'questions/reading/TPO-01/reading-TPO-01.md')),
    true
  );
  assert.equal(fs.existsSync(path.join(destination, 'questions/vocabulary/manifest.json')), true);
  assert.equal(fs.existsSync(path.join(destination, 'questions/vocabulary/ex-batches')), false);
});

test('all current Markdown documents parse into valid unified models', async t => {
  const counts = { reading: 0, listening: 0, writing: 0, speaking: 0 };
  for (const entry of manifest.entries) {
    await t.test(entry.id, () => {
      const markdown = fs.readFileSync(path.join(root, entry.path), 'utf8');
      const document = parseExamDocument(entry.section, markdown, entry);
      const result = validateExamDocument(document);
      assert.deepEqual(result.errors, []);
      assert.equal(document.id, entry.id);
      assert.equal(document.pages[0].type, 'start');
      assert.equal(document.pages.at(-1).type, 'results');
      const questionIds = document.modules
        .flatMap(module => module.tasks)
        .flatMap(task => task.questions)
        .map(question => question.id);
      const pagedQuestionIds = document.pages.flatMap(page => page.questionIds);
      assert.deepEqual([...pagedQuestionIds].sort(), [...questionIds].sort());
      assert.equal(new Set(document.pages.map(page => page.id)).size, document.pages.length);
      document.pages.forEach((page, index) => {
        assert.equal(page.previous, document.pages[index - 1]?.id || null);
        assert.equal(page.next, document.pages[index + 1]?.id || null);
      });
      counts[entry.section] += 1;
    });
  }
  assert.deepEqual(Object.keys(counts).filter(section => counts[section] === 0), []);
});

test('speaking response times preserve TOEFL task rules', () => {
  const entry = manifest.entries.find(item => item.id === 'tpo-01-speaking');
  const document = parseExamDocument(
    'speaking',
    fs.readFileSync(path.join(root, entry.path), 'utf8'),
    entry
  );
  const questions = document.modules[0].tasks.flatMap(task => task.questions);
  assert.deepEqual(
    questions.map(question => question.responseTime),
    [8, 8, 10, 10, 10, 12, 12, 45, 45, 45, 45]
  );
});

test('writing creates an intro page before each task', () => {
  const entry = manifest.entries.find(item => item.section === 'writing');
  const markdown = fs.readFileSync(path.join(root, entry.path), 'utf8');
  const document = parseExamDocument('writing', markdown, entry);
  const taskPages = document.modules[0].tasks.map(task => ({
    intro: document.pages.find(page => page.id === `${task.id}-intro`),
    firstQuestion: document.pages.find(page => page.questionIds[0] === task.questions[0].id)
  }));
  taskPages.forEach(({ intro, firstQuestion }) => {
    assert.ok(intro);
    assert.equal(intro.next, firstQuestion.id);
  });
});

test('reading complete-words tasks use one grouped question page', () => {
  for (const entry of manifest.entries.filter(item => item.section === 'reading')) {
    const document = parseExamDocument(
      'reading',
      fs.readFileSync(path.join(root, entry.path), 'utf8'),
      entry
    );
    for (const module of document.modules) {
      for (const task of module.tasks) {
        const pages = document.pages.filter(
          page => page.moduleId === module.id && page.taskId === task.id && page.type === 'question'
        );
        if (task.type === 'complete-words') {
          assert.equal(pages.length, 1, `${entry.id}/${module.id}/${task.id}`);
          assert.deepEqual(
            pages[0].questionIds,
            task.questions.map(question => question.id)
          );
        } else {
          assert.equal(pages.length, task.questions.length, `${entry.id}/${module.id}/${task.id}`);
          assert.ok(pages.every(page => page.questionIds.length === 1));
        }
      }
    }
  }
});

test('listening long-form tasks receive a stimulus page immediately before questions', () => {
  for (const entry of manifest.entries.filter(item => item.section === 'listening')) {
    const document = parseExamDocument(
      'listening',
      fs.readFileSync(path.join(root, entry.path), 'utf8'),
      entry
    );
    for (const module of document.modules) {
      for (const task of module.tasks) {
        const stimulus = document.pages.filter(
          page => page.moduleId === module.id && page.taskId === task.id && page.type === 'stimulus'
        );
        if (task.type === 'listen-response') {
          assert.equal(stimulus.length, 0);
          continue;
        }
        assert.equal(stimulus.length, 1, `${entry.id}/${module.id}/${task.id}`);
        const stimulusIndex = document.pages.indexOf(stimulus[0]);
        assert.equal(document.pages[stimulusIndex + 1].questionIds[0], task.questions[0].id);
        assert.deepEqual(stimulus[0].questionIds, []);
      }
    }
  }
});

test('speaking keeps one scenario before each task question sequence', () => {
  for (const entry of manifest.entries.filter(item => item.section === 'speaking')) {
    const document = parseExamDocument(
      'speaking',
      fs.readFileSync(path.join(root, entry.path), 'utf8'),
      entry
    );
    for (const task of document.modules[0].tasks) {
      const intro = document.pages.find(page => page.id === `${task.id}-intro`);
      const scenario = document.pages.find(
        page => page.taskId === task.id && page.type === 'scenario'
      );
      assert.ok(intro);
      assert.ok(scenario);
      assert.equal(intro.next, scenario.id);
      assert.equal(
        document.pages[document.pages.indexOf(scenario) + 1].questionIds[0],
        task.questions[0].id
      );
    }
  }
});
