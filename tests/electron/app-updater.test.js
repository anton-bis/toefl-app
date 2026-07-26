import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createAppUpdaterController,
  normalizeReleaseNotes
} from '../../electron/services/app-updater.js';
import { createBackgroundScheduler } from '../../electron/services/background-scheduler.js';
import { downloadMacInstaller } from '../../electron/services/manual-mac-update.js';

class FakeUpdater extends EventEmitter {
  constructor() {
    super();
    this.checkCalls = 0;
    this.downloadCalls = 0;
    this.installCalls = 0;
    this.checkAction = async () => this.emit('update-not-available');
    this.downloadAction = async () => this.emit('update-downloaded', {});
  }

  async checkForUpdates() {
    this.checkCalls += 1;
    return this.checkAction();
  }

  async downloadUpdate() {
    this.downloadCalls += 1;
    return this.downloadAction();
  }

  quitAndInstall() {
    this.installCalls += 1;
  }
}

function controllerFixture(options = {}) {
  const updater = new FakeUpdater();
  const states = [];
  const controller = createAppUpdaterController({
    updater,
    emitState: state => states.push(state),
    prepareToInstall: options.prepareToInstall,
    downloadManualInstaller: options.downloadManualInstaller,
    manualArchitecture: options.manualArchitecture
  });
  return { updater, states, controller };
}

test('release notes become bounded plain text without artifact hashes', () => {
  const notes = normalizeReleaseNotes(
    '<h2>1.5.0</h2><ul><li>Smaller installer &amp; safer updates.</li></ul>' +
      '<h3>SHA256 Hashes of the release artifacts</h3><p>f'.repeat(80)
  );
  assert.equal(notes, '1.5.0 · Smaller installer & safer updates.');
  assert.equal(notes.includes('<'), false);
  assert.ok(notes.length <= 420);
});

test('controller keeps one authoritative state and does not recheck an active update', async () => {
  const { updater, controller } = controllerFixture();
  updater.checkAction = async () =>
    updater.emit('update-available', {
      version: '2.0.0',
      releaseNotes: '<p>A focused update.</p>'
    });

  const available = await controller.check();
  assert.deepEqual(
    {
      status: available.status,
      version: available.version,
      description: available.description,
      error: available.error
    },
    { status: 'available', version: '2.0.0', description: 'A focused update.', error: '' }
  );
  const revision = available.revision;
  await controller.check();
  assert.equal(updater.checkCalls, 1);
  assert.equal(controller.getState().revision, revision);
  await controller.check({ userInitiated: true });
  assert.equal(controller.getState().notice, true);
});

test('controller coalesces overlapping update checks', async () => {
  const { updater, controller } = controllerFixture();
  let finishCheck;
  updater.checkAction = () => new Promise(resolve => (finishCheck = resolve));

  const backgroundCheck = controller.check();
  await Promise.resolve();
  const foregroundState = await controller.check({ userInitiated: true });

  assert.equal(updater.checkCalls, 1);
  assert.equal(foregroundState.status, 'checking');
  assert.equal(foregroundState.notice, true);
  updater.emit('update-not-available');
  finishCheck();
  assert.equal((await backgroundCheck).status, 'up-to-date');
});

test('transient checks stay quiet and a successful retry clears the error', async () => {
  const { updater, controller } = controllerFixture();
  updater.checkAction = async () => {
    const error = new Error('offline');
    updater.emit('error', error);
    throw error;
  };

  const failed = await controller.check();
  assert.equal(failed.status, 'error');
  assert.equal(failed.notice, false);
  assert.equal(failed.retryAction, 'check');

  updater.checkAction = async () => updater.emit('update-not-available');
  const recovered = await controller.retry();
  assert.equal(recovered.status, 'up-to-date');
  assert.equal(recovered.error, '');
  assert.equal(recovered.notice, true);
});

test('download errors are retryable and installation waits for data persistence', async () => {
  const order = [];
  const { updater, controller } = controllerFixture({
    prepareToInstall: async () => order.push('saved')
  });
  updater.quitAndInstall = () => order.push('install');
  updater.checkAction = async () => updater.emit('update-available', { version: '2.0.0' });
  await controller.check();
  updater.downloadAction = async () => {
    const error = new Error('download interrupted');
    updater.emit('error', error);
    throw error;
  };
  assert.equal((await controller.download()).retryAction, 'download');

  updater.downloadAction = async () => updater.emit('update-downloaded', { version: '2.0.0' });
  assert.equal((await controller.retry()).status, 'downloaded');
  controller.setInstallBlocked(true);
  await controller.install();
  assert.deepEqual(order, []);
  controller.setInstallBlocked(false);
  await controller.install();
  assert.deepEqual(order, ['saved', 'install']);
});

test('manual macOS updates use the internal installer download instead of a browser', async () => {
  const opened = [];
  const { updater, controller } = controllerFixture({
    downloadManualInstaller: async options => opened.push(options),
    manualArchitecture: 'arm64'
  });
  const x64Asset = { url: 'TOEFL-2.0.0-x64.dmg', sha512: 'x64-hash', size: 10 };
  const asset = { url: 'TOEFL-2.0.0-arm64.dmg', sha512: 'arm64-hash', size: 10 };
  updater.checkAction = async () =>
    updater.emit('update-available', { version: '2.0.0', files: [x64Asset, asset] });

  const available = await controller.check();
  assert.equal(available.installMode, 'manual');
  const afterOpen = await controller.download();

  assert.equal(opened[0].version, '2.0.0');
  assert.equal(opened[0].asset, asset);
  assert.equal(updater.downloadCalls, 0);
  assert.equal(afterOpen.status, 'available');
  assert.equal(afterOpen.notice, false);
});

test('manual macOS installer download verifies integrity and reuses a valid file', async t => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'toefl-mac-update-'));
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const contents = Buffer.from('verified installer');
  const asset = {
    url: 'TOEFL-iBT-Practice-2.0.0-macos-universal.dmg',
    sha512: crypto.createHash('sha512').update(contents).digest('base64'),
    size: contents.length
  };
  const progress = [];
  let fetches = 0;
  const options = {
    version: '2.0.0',
    asset,
    downloadsDirectory: directory,
    fetchFile: async url => {
      fetches += 1;
      assert.match(url, /releases\/download\/v2\.0\.0\/TOEFL-iBT-Practice-2\.0\.0/);
      return new Response(contents);
    },
    onProgress: value => progress.push(value)
  };

  const installer = await downloadMacInstaller(options);
  assert.deepEqual(await fs.promises.readFile(installer), contents);
  assert.equal(progress.at(-1), 100);
  assert.equal(await downloadMacInstaller(options), installer);
  assert.equal(fetches, 1);
});

function fakeTimers() {
  let id = 0;
  const tasks = new Map();
  return {
    tasks,
    setTimer(callback, delay) {
      const timer = ++id;
      tasks.set(timer, { callback, delay });
      return timer;
    },
    clearTimer(timer) {
      tasks.delete(timer);
    },
    take(delay) {
      const entry = [...tasks].find(([, task]) => task.delay === delay);
      assert.ok(entry, `No timer scheduled for ${delay}ms`);
      tasks.delete(entry[0]);
      return entry[1].callback;
    }
  };
}

test('background scheduler retries unavailable work without duplicating loops', async () => {
  const timers = fakeTimers();
  let runnable = false;
  let releaseOldCheck;
  const oldCheck = new Promise(resolve => (releaseOldCheck = resolve));
  let appRuns = 0;
  const scheduler = createBackgroundScheduler({
    canRun: () => runnable,
    runAppUpdate: async () => {
      appRuns += 1;
      await oldCheck;
    },
    runContentUpdate: async () => {},
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    appInterval: 600,
    contentInterval: 1200,
    unavailableRetry: 50,
    errorRetry: 100
  });

  scheduler.restart(10);
  await timers.take(10)();
  assert.ok([...timers.tasks.values()].some(task => task.delay === 50));

  runnable = true;
  const running = timers.take(50)();
  scheduler.restart(20);
  releaseOldCheck();
  await running;
  assert.equal(appRuns, 1);
  assert.deepEqual(
    [...timers.tasks.values()].map(task => task.delay).sort((a, b) => a - b),
    [20, 15020]
  );
});

test('background scheduler uses a short retry after errors', async () => {
  const timers = fakeTimers();
  const errors = [];
  const scheduler = createBackgroundScheduler({
    canRun: () => true,
    runAppUpdate: async () => {
      throw new Error('temporary');
    },
    runContentUpdate: async () => {},
    onError: (kind, error) => errors.push([kind, error.message]),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    appInterval: 600,
    contentInterval: 1200,
    unavailableRetry: 50,
    errorRetry: 100
  });
  scheduler.restart(10);
  await timers.take(10)();
  assert.deepEqual(errors, [['app', 'temporary']]);
  assert.ok([...timers.tasks.values()].some(task => task.delay === 100));
});
