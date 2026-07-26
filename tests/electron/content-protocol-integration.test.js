import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const require = createRequire(import.meta.url);

test('Electron renderer fetches installed content and media ranges through the packaged protocol', async t => {
  const electronPackage = require.resolve('electron/package.json');
  if (!fsSync.existsSync(path.join(path.dirname(electronPackage), 'path.txt'))) {
    t.skip('The Electron binary was intentionally omitted from this test environment.');
    return;
  }
  let electron;
  try {
    electron = (await import('electron')).default;
  } catch {
    t.skip('The Electron binary was intentionally omitted from this test environment.');
    return;
  }
  if (process.platform === 'linux') {
    const dependencies = spawnSync('ldd', [electron], { encoding: 'utf8' });
    if (dependencies.stdout.includes('not found')) {
      t.skip('The local system does not have the shared libraries required by Electron.');
      return;
    }
  }
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'toefl-protocol-test-'));
  const contentFile = path.join(temporaryRoot, 'catalog.json');
  await fs.writeFile(contentFile, '{"ready":true}');
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }));

  const fixture = path.resolve('tests/electron/fixtures/content-protocol.mjs');
  const arguments_ = ['--no-sandbox', '--headless', '--disable-gpu', fixture, contentFile];
  const { stdout } = await execute(electron, arguments_, {
    cwd: path.resolve('.'),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '' },
    timeout: 20_000
  });

  assert.match(
    stdout,
    /CONTENT_PROTOCOL_RESULT:\{"complete":"\{\\"ready\\":true\}","rangeStatus":206,"contentRange":"bytes 2-6\/14","range":"ready"\}/
  );
});
