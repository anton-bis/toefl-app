import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildQuestionManifest } from '../../src/content/manifest.js';
import {
  assertCompiledMetadata,
  assertQuestionManifest
} from '../../electron/services/runtime-content.js';
import { createExamDocument } from '../../src/content/pages.js';
import { normalizeMarkdown } from '../../src/content/shared.js';
import { validateExamDocument } from '../../src/content/validate.js';
import {
  generateQuestionContent,
  scanQuestionFiles
} from '../../scripts/generate-question-manifest.js';
import { copyRuntimeContent } from '../../vite.config.js';

const root = path.resolve(import.meta.dirname, '../..');
const compiledContent = generateQuestionContent(root);
const { manifest } = compiledContent;
const documents = new Map(
  manifest.entries.map(entry => [
    entry.id,
    JSON.parse(compiledContent.documents.get(entry.documentPath)).document
  ])
);
const documentsFor = section =>
  manifest.entries.filter(entry => entry.section === section).map(entry => documents.get(entry.id));

test('packaged content protocol is allowed by the renderer security policy', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /connect-src[^;]*\btoefl-content:/);
  assert.match(html, /media-src[^;]*\btoefl-content:/);
});

test('shared content builders normalize Markdown and page navigation', () => {
  assert.equal(normalizeMarkdown('first\r\nsecond\rthird'), 'first\nsecond\nthird');
  const document = createExamDocument({ id: 'fixture', section: 'reading' }, [
    { id: 'module-1', tasks: [] }
  ]);
  assert.deepEqual(
    document.pages.map(page => [page.id, page.previous, page.next]),
    [
      ['start', null, 'module-1-intro'],
      ['module-1-intro', 'start', 'results'],
      ['results', 'module-1-intro', null]
    ]
  );
});

test('manifest discovery is deterministic and complete', () => {
  const paths = scanQuestionFiles(root);
  assert.ok(paths.length > 0);
  assert.equal(manifest.entries.length, paths.length);
  assert.equal(new Set(manifest.entries.map(entry => entry.id)).size, manifest.entries.length);
  assert.deepEqual(
    buildQuestionManifest([...paths].reverse()).entries,
    manifest.entries.map(entry => ({
      id: entry.id,
      tpoId: entry.tpoId,
      section: entry.section,
      sourcePath: entry.sourcePath,
      documentPath: entry.documentPath
    }))
  );
  assert.ok(manifest.tpos.every(tpo => Object.keys(tpo.sections).length > 0));
});

test('compiled documents are deterministic and bound to their Markdown source', () => {
  const first = compiledContent;
  const second = generateQuestionContent(root);
  assert.deepEqual(first.manifest, second.manifest);
  assert.deepEqual([...first.documents], [...second.documents]);

  for (const entry of first.manifest.entries) {
    const compiled = JSON.parse(first.documents.get(entry.documentPath));
    assert.equal(compiled.source.path, entry.sourcePath);
    assert.equal(compiled.source.sha256, entry.sourceHash);
    assert.equal(compiled.document.id, entry.id);
    assert.equal(compiled.document.sourcePath, entry.sourcePath);
  }
  assert.doesNotThrow(() => assertQuestionManifest(first.manifest));
});

test('content integrity rejects duplicate entries and mismatched compiled metadata', () => {
  const [entry] = manifest.entries;
  assert.throws(
    () => assertQuestionManifest({ ...manifest, entries: [entry, entry] }),
    /Duplicate question content entry/
  );
  assert.throws(
    () => assertQuestionManifest({ ...manifest, contentHash: 'not-a-hash' }),
    /manifest hash/
  );
  assert.throws(
    () =>
      assertCompiledMetadata(
        {
          source: { path: entry.sourcePath, sha256: entry.sourceHash },
          document: { id: entry.id, tpoId: entry.tpoId, section: 'listening' }
        },
        entry
      ),
    /metadata mismatch/
  );
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
    ['questions/compiled/tpo-01-reading.json', '{}'],
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
    false
  );
  assert.equal(
    fs.existsSync(path.join(destination, 'questions/compiled/tpo-01-reading.json')),
    true
  );
  assert.equal(fs.existsSync(path.join(destination, 'questions/vocabulary/manifest.json')), true);
  assert.equal(fs.existsSync(path.join(destination, 'questions/vocabulary/ex-batches')), false);

  const desktopDestination = path.join(temporaryRoot, 'desktop');
  copyRuntimeContent(source, desktopDestination, { includeContent: false });
  assert.equal(fs.existsSync(path.join(desktopDestination, 'icons/icon.png')), true);
  assert.equal(fs.existsSync(path.join(desktopDestination, 'questions')), false);
});

test('application metadata identifies the English TOEFL product', () => {
  const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packageMetadata.productName, 'TOEFL iBT Practice');
  assert.equal(packageMetadata.build.productName, 'TOEFL iBT Practice');
  assert.deepEqual(packageMetadata.build.electronLanguages, ['en-US']);
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<html lang="en">/);
});

test('Electron packaging excludes independently published runtime content', () => {
  const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const distFiles = packageMetadata.build.files.find(entry => entry.from === 'dist');
  assert.ok(distFiles.filter.includes('!assets/questions/**'));
  assert.ok(distFiles.filter.includes('!assets/audio/**'));
  assert.ok(packageMetadata.build.files.includes('!node_modules/**/*.map'));
  assert.equal(packageMetadata.build.extraResources, undefined);
  assert.deepEqual(packageMetadata.build.asarUnpack, ['**/*.node']);
  assert.deepEqual(packageMetadata.build.publish, {
    provider: 'generic',
    url: 'https://v6.gh-proxy.org/https://github.com/anton-bis/toefl-app/releases/latest/download',
    channel: 'latest'
  });
});

test('all current Markdown documents parse into valid unified models', async t => {
  assert.deepEqual(
    new Set(manifest.entries.map(entry => entry.section)),
    new Set(['reading', 'listening', 'writing', 'speaking'])
  );
  for (const entry of manifest.entries) {
    await t.test(entry.id, () => {
      const document = documents.get(entry.id);
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
    });
  }
});

test('speaking response times preserve TOEFL task rules', () => {
  const document = documents.get('tpo-01-speaking');
  const questions = document.modules[0].tasks.flatMap(task => task.questions);
  assert.deepEqual(
    questions.map(question => question.responseTime),
    [8, 8, 10, 10, 10, 12, 12, 45, 45, 45, 45]
  );
});

test('writing creates an intro page before each task', () => {
  const [document] = documentsFor('writing');
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
  for (const document of documentsFor('reading')) {
    for (const module of document.modules) {
      for (const task of module.tasks) {
        const pages = document.pages.filter(
          page => page.moduleId === module.id && page.taskId === task.id && page.type === 'question'
        );
        if (task.type === 'complete-words') {
          assert.equal(pages.length, 1, `${document.id}/${module.id}/${task.id}`);
          assert.deepEqual(
            pages[0].questionIds,
            task.questions.map(question => question.id)
          );
        } else {
          assert.equal(
            pages.length,
            task.questions.length,
            `${document.id}/${module.id}/${task.id}`
          );
          assert.ok(pages.every(page => page.questionIds.length === 1));
        }
      }
    }
  }
});

test('missing-letter tasks use the current title without repeating it in the passage', () => {
  let taskCount = 0;
  for (const document of documentsFor('reading')) {
    for (const task of document.modules.flatMap(module => module.tasks)) {
      if (task.type !== 'complete-words') continue;
      taskCount += 1;
      assert.equal(task.title, 'Fill in the missing letters');
      assert.doesNotMatch(task.passage, /^Fill in the missing letters/i);
    }
  }
  assert.equal(taskCount, 19);
});

test('reading question numbers follow their declared module ranges', () => {
  for (const document of documentsFor('reading')) {
    for (const module of document.modules) {
      for (const task of module.tasks) {
        assert.equal(
          task.questions.length,
          task.questionRange[1] - task.questionRange[0] + 1,
          `${document.id}/${module.id}/${task.id}`
        );
      }
      const questions = module.tasks.flatMap(task => task.questions);
      assert.deepEqual(
        questions.map(question => question.number),
        questions.map((_, index) => index + 1),
        `${document.id}/${module.id}`
      );
    }
  }
});

test('listening long-form tasks receive a stimulus page immediately before questions', () => {
  for (const document of documentsFor('listening')) {
    for (const module of document.modules) {
      for (const task of module.tasks) {
        const stimulus = document.pages.filter(
          page => page.moduleId === module.id && page.taskId === task.id && page.type === 'stimulus'
        );
        if (task.type === 'listen-response') {
          assert.equal(stimulus.length, 0);
          continue;
        }
        assert.equal(stimulus.length, 1, `${document.id}/${module.id}/${task.id}`);
        const stimulusIndex = document.pages.indexOf(stimulus[0]);
        assert.equal(document.pages[stimulusIndex + 1].questionIds[0], task.questions[0].id);
        assert.deepEqual(stimulus[0].questionIds, []);
      }
    }
  }
});

test('speaking keeps one scenario before each task question sequence', () => {
  for (const document of documentsFor('speaking')) {
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
