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
import { parseReading } from '../../content-core/parsers/reading.js';
import { parseListening } from '../../content-core/parsers/listening.js';
import { parseSpeaking } from '../../content-core/parsers/speaking.js';
import { parseWriting } from '../../content-core/parsers/writing.js';

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
  assert.match(html, /media-src[^;]*\btoefl-recording:/);
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
  const tpoPaths = paths.filter(path =>
    /^assets[\\/]questions[\\/](reading|listening|writing|speaking)[\\/](TPO-\d+|\d{4}-\d{2}-\d{2}(?:\s*\(\d+\))?)[\\/]/.test(path)
  );
  assert.equal(manifest.entries.length, tpoPaths.length);
  assert.equal(new Set(manifest.entries.map(entry => entry.id)).size, manifest.entries.length);
  assert.deepEqual(
    buildQuestionManifest([...tpoPaths].reverse()).entries,
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

test('date-folder question documents are indexed alongside TPO documents', () => {
  const dateEntries = manifest.entries.filter(entry => entry.tpoId === '2026-01-27');
  assert.deepEqual(
    dateEntries.map(entry => `${entry.section}:${entry.sourcePath}`).sort(),
    [
      'listening:assets/questions/listening/2026-01-27/listening-2026-01-27.md',
      'reading:assets/questions/reading/2026-01-27/reading-2026-01-27.md',
      'speaking:assets/questions/speaking/2026-01-27/speaking-2026-01-27.md',
      'writing:assets/questions/writing/2026-01-27/writing-2026-01-27.md'
    ]
  );
  for (const entry of dateEntries) {
    const compiled = JSON.parse(compiledContent.documents.get(entry.documentPath));
    assert.equal(compiled.document.tpoId, '2026-01-27');
  }
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

test('application metadata identifies the Tofu product', () => {
  const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packageMetadata.productName, 'Tofu Practice');
  assert.equal(packageMetadata.build.productName, 'Tofu Practice');
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
  assert.equal(taskCount, 31);
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

test('reading recognizes Announcement as a daily-life subtype', () => {
  const document = parseReading(
    [
      '# reading-fixture',
      '## Module 1: Reading',
      '### Task 1 Read in Daily Life – Announcement (Questions 1–2)',
      'Title: Campus News',
      'Closed today.',
      '1. What is this?',
      'A. A notice',
      'B. An email',
      '[ANSWER]',
      'A',
      '[/ANSWER]'
    ].join('\n'),
    { tpoId: '01', sourcePath: 'assets/questions/reading/fixture.md' }
  );
  const task = document.modules[0].tasks[0];
  assert.equal(task.type, 'announcement');
  assert.equal(task.id, 'task-1-announcement');
});

test('reading recognizes Label and Receipt as daily-life subtypes', () => {
  const document = parseReading(
    [
      '# reading-fixture',
      '## Module 1: Reading',
      '### Task 1 Read a Label (Questions 1–2)',
      'Organic Almond Butter 250g',
      '1. What is the weight?',
      'A. 100g',
      'B. 250g',
      '[ANSWER]',
      'B',
      '[/ANSWER]',
      '### Task 2 Read a Receipt (Questions 3–4)',
      'Thank you for shopping!',
      '3. What is the total?',
      'A. 10.00',
      'B. 20.00',
      '[ANSWER]',
      'A',
      '[/ANSWER]'
    ].join('\n'),
    { tpoId: '01', sourcePath: 'assets/questions/reading/fixture.md' }
  );
  const [label, receipt] = document.modules[0].tasks;
  assert.equal(label.type, 'label');
  assert.equal(label.id, 'task-1-label');
  assert.equal(receipt.type, 'receipt');
  assert.equal(receipt.id, 'task-2-receipt');
});

test('reading recognizes Poster, Instructions and Form as daily-life subtypes', () => {
  const document = parseReading(
    [
      '# reading-fixture',
      '## Module 1: Reading',
      '### Task 1 Read a Poster (Questions 1–2)',
      'Join the Clean-Up Day!',
      '1. What is the main purpose?',
      'A. To recruit volunteers',
      'B. To sell tickets',
      '[ANSWER]',
      'A',
      '[/ANSWER]',
      '### Task 2 Read Some Instructions (Questions 3–4)',
      'Build a Raised Garden Bed',
      'Step 1: Prepare boards.',
      '3. What will someone build?',
      'A. A picture frame',
      'B. A garden bed',
      '[ANSWER]',
      'B',
      '[/ANSWER]',
      '### Task 3 Read a Form (Questions 5–6)',
      'UNIVERSITY IT HELP DESK',
      'STUDENT REQUEST FORM',
      '5. What is the form for?',
      'A. A job application',
      'B. Technical support',
      '[ANSWER]',
      'B',
      '[/ANSWER]'
    ].join('\n'),
    { tpoId: '01', sourcePath: 'assets/questions/reading/fixture.md' }
  );
  const [poster, instructions, form] = document.modules[0].tasks;
  assert.equal(poster.type, 'poster');
  assert.equal(poster.id, 'task-1-poster');
  assert.equal(instructions.type, 'instructions');
  assert.equal(instructions.id, 'task-2-instructions');
  assert.equal(form.type, 'form');
  assert.equal(form.id, 'task-3-form');
});

test('reading recognizes Read a Sign, Read a Web Page and Read a Review as daily-life subtypes', () => {
  const document = parseReading(
    [
      '# reading-fixture',
      '## Module 1: Reading',
      '### Task 1 Read a Sign (Questions 1–2)',
      'NO ENTRY',
      '1. What does the sign say?',
      'A. Entry allowed',
      'B. No entry',
      '[ANSWER]',
      'B',
      '[/ANSWER]',
      '### Task 2 Read a Web Page (Questions 3–4)',
      'https://www.example.org',
      'WELCOME ABOARD!',
      '3. What is the page about?',
      'A. A travel guide',
      'B. A job posting',
      '[ANSWER]',
      'A',
      '[/ANSWER]',
      '### Task 3 Read a Review (Questions 5–6)',
      'A superb stay',
      'The hotel was wonderful.',
      '5. What is reviewed?',
      'A. A hotel',
      'B. A restaurant',
      '[ANSWER]',
      'A',
      '[/ANSWER]'
    ].join('\n'),
    { tpoId: '01', sourcePath: 'assets/questions/reading/fixture.md' }
  );
  const [sign, webPage, review] = document.modules[0].tasks;
  assert.equal(sign.type, 'sign');
  assert.equal(sign.id, 'task-1-sign');
  assert.equal(webPage.type, 'web-page');
  assert.equal(webPage.id, 'task-2-web-page');
  assert.equal(review.type, 'review');
  assert.equal(review.id, 'task-3-review');
});

test('reading parser rejects unknown daily-life subtypes instead of silently falling back', () => {
  assert.throws(
    () =>
      parseReading(
        [
          '# reading-fixture',
          '## Module 1: Reading',
          '### Task 1 Read a Coupon (Questions 1–2)',
          'Save 20%',
          '1. What is this?',
          'A. A coupon',
          'B. An email',
          '[ANSWER]',
          'A',
          '[/ANSWER]'
        ].join('\n'),
        { tpoId: '01', sourcePath: 'assets/questions/reading/fixture.md' }
      ),
    /Unsupported reading task type/
  );
});

test('listening parses question-level and task-level images', () => {
  const document = parseListening(
    [
      '# listening-fixture',
      '## Module 1',
      '### Listen to a Talk – Questions 1-2',
      'audio: a.m4a',
      'image: talk.png',
      '1. What is the talk about?',
      'A. One',
      'B. Two',
      '[ANSWER]',
      'A',
      '[/ANSWER]',
      '### Listen and Choose a Response – Questions 3-4',
      'audio: a.m4a',
      '3. Prompt',
      'image: q3.png',
      'A. One',
      'B. Two',
      '[ANSWER]',
      'A',
      '[/ANSWER]'
    ].join('\n'),
    { tpoId: '01', sourcePath: 'assets/questions/listening/fixture.md' }
  );
  const [talk, lcar] = document.modules[0].tasks;
  assert.equal(talk.image, 'talk.png');
  assert.equal(talk.questions[0].image, 'talk.png');
  assert.equal(lcar.image, null);
  assert.equal(lcar.questions[0].image, 'q3.png');
});

test('speaking parses a task-level image inherited by interview questions', () => {
  const [repeat, interview] = parseSpeaking(
    [
      '# speaking-fixture',
      '### Listen and Repeat',
      'scenario_title: Repeat the weather report.',
      'scenario_image: 0.png',
      'audio: a.m4a',
      '1.',
      'image: 1.png',
      '>> play: 00:05-00:10',
      'transcript: Sunny today.',
      '### Take an Interview',
      'scenario_title: Cultural festivals interview.',
      'scenario_image: 8.png',
      'image: 8.png',
      'audio: a.m4a',
      '8.',
      '>> play: 00:30-00:40',
      'transcript: First question?'
    ].join('\n'),
    { tpoId: '01', sourcePath: 'assets/questions/speaking/fixture.md' }
  ).modules[0].tasks;
  assert.equal(repeat.image, null);
  assert.equal(repeat.questions[0].image, '1.png');
  assert.equal(interview.image, '8.png');
  assert.equal(interview.questions[0].image, '8.png');
});

test('writing parses build-sentence speaker avatars', () => {
  const document = parseWriting(
    [
      '# writing-fixture',
      '## Build a Sentence',
      '### Build a Sentence – 1',
      'Speaker A: Hi.',
      'Speaker B: ____ ____.',
      'speaker_a_image: avatar-1.png',
      'speaker_b_image: avatar-2.png',
      'Candidates: a / b',
      '\\[ANSWER\\]',
      'A b.',
      '\\[/ANSWER\\]'
    ].join('\n'),
    { tpoId: '01', sourcePath: 'assets/questions/writing/fixture.md' }
  );
  const question = document.modules[0].tasks[0].questions[0];
  assert.equal(question.speakerAImage, 'avatar-1.png');
  assert.equal(question.speakerBImage, 'avatar-2.png');
});

test('writing parses discussion professor and student avatars', () => {
  const document = parseWriting(
    [
      '# writing-fixture',
      '## Write for an Academic Discussion',
      '### Write for an Academic Discussion – 1',
      'Subject: sociology',
      'Instructor: Dr. Gupta',
      'professor_image: avatar-9.png',
      'Professor: Question?',
      'student_a_image: avatar-3.png',
      'Kelly: View A.',
      'student_b_image: avatar-5.png',
      'Andrew: View B.',
      'Requirements:',
      '- Express your opinion.'
    ].join('\n'),
    { tpoId: '01', sourcePath: 'assets/questions/writing/fixture.md' }
  );
  const question = document.modules[0].tasks.find(
    task => task.type === 'academic-discussion'
  ).questions[0];
  assert.equal(question.professorImage, 'avatar-9.png');
  assert.deepEqual(
    question.students.map(student => [student.name, student.image]),
    [
      ['Kelly', 'avatar-3.png'],
      ['Andrew', 'avatar-5.png']
    ]
  );
  assert.deepEqual(question.requirements, ['Express your opinion.']);
});
