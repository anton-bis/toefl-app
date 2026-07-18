#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(root, process.argv[2] || '.performance/latest.json');
const runs = Math.max(1, Number.parseInt(process.env.TOEFL_PERF_RUNS || '5', 10));
const electron = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
);
const scenarios = [
  { name: 'home', route: '/' },
  { name: 'typing', route: '/skills/typing' },
  { name: 'vocabulary', route: '/skills/vocabulary' },
  { name: 'home-hidden', route: '/', hidden: true }
].filter(scenario =>
  (process.env.TOEFL_PERF_SCENARIOS || '').split(',').filter(Boolean).length
    ? process.env.TOEFL_PERF_SCENARIOS.split(',').includes(scenario.name)
    : true
);

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function summarize(values) {
  return { p50: percentile(values, 0.5), p95: percentile(values, 0.95) };
}

async function capture(scenario, index) {
  const samplePath = path.join(path.dirname(output), `${scenario.name}-${index}.json`);
  const userDataPath = await fs.mkdtemp(path.join(path.dirname(output), 'user-data-'));
  await fs.rm(samplePath, { force: true });
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(electron, ['electron/main.js'], {
        cwd: root,
        env: {
          ...process.env,
          ELECTRON: 'true',
          NODE_ENV: 'production',
          TOEFL_PERF_OUTPUT: samplePath,
          TOEFL_PERF_EXIT: '1',
          TOEFL_PERF_ROUTE: scenario.route,
          TOEFL_PERF_HIDDEN: scenario.hidden ? '1' : '0',
          TOEFL_PERF_USER_DATA: userDataPath
        },
        stdio: 'inherit'
      });
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Electron performance capture timed out (${scenario.name} ${index + 1})`));
      }, 30_000);
      child.once('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', code => {
        clearTimeout(timeout);
        if (code) reject(new Error(`Electron exited with code ${code}`));
        else resolve();
      });
    });
    return JSON.parse(await fs.readFile(samplePath, 'utf8'));
  } finally {
    await fs.rm(samplePath, { force: true });
    await fs.rm(userDataPath, { recursive: true, force: true });
  }
}

function scenarioSummary(samples) {
  const metric = selector => summarize(samples.map(selector).filter(Number.isFinite));
  return {
    samples: samples.length,
    readyToShowMs: metric(sample => sample.readyToShowMs),
    workingSetKb: metric(sample => sample.totals.workingSetSize),
    privateBytesKb: metric(sample => sample.totals.privateBytes),
    rendererHeapBytes: metric(sample => sample.renderer.heap?.used),
    domNodes: metric(sample => sample.renderer.domNodes),
    mainIdleCpuPercent: metric(
      sample => ((sample.mainCpu.user + sample.mainCpu.system) / 2_000_000) * 100
    ),
    rendererCpuPercent: metric(sample => sample.totals.rendererCpuPercent)
  };
}

function checkThresholds(summary) {
  const limits = {
    readyToShowMs: Number(process.env.TOEFL_PERF_MAX_STARTUP_MS || 5000),
    workingSetKb: Number(process.env.TOEFL_PERF_MAX_WORKING_SET_KB || 600 * 1024),
    rendererHeapBytes: Number(process.env.TOEFL_PERF_MAX_HEAP_BYTES || 200 * 1024 * 1024),
    domNodes: Number(process.env.TOEFL_PERF_MAX_DOM_NODES || 10_000),
    mainIdleCpuPercent: Number(process.env.TOEFL_PERF_MAX_IDLE_CPU || 10),
    rendererCpuPercent: Number(process.env.TOEFL_PERF_MAX_RENDERER_CPU || 15)
  };
  return Object.entries(summary).flatMap(([scenario, metrics]) =>
    Object.entries(limits)
      .filter(([metric, limit]) => metrics[metric]?.p95 > limit)
      .map(([metric, limit]) => `${scenario}.${metric} p95 ${metrics[metric].p95} > ${limit}`)
  );
}

await fs.mkdir(path.dirname(output), { recursive: true });
const results = {};
for (const scenario of scenarios) {
  const samples = [];
  for (let index = 0; index < runs; index += 1) samples.push(await capture(scenario, index));
  results[scenario.name] = scenarioSummary(samples);
}
const report = { capturedAt: new Date().toISOString(), runs, scenarios: results };
const failures = checkThresholds(results);
await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Performance report: ${path.relative(root, output)}`);
if (failures.length) {
  failures.forEach(failure => console.error(`Performance threshold failed: ${failure}`));
  process.exitCode = 1;
}
