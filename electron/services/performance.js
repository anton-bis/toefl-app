import fs from 'node:fs/promises';
import path from 'node:path';

export async function writePerformanceSnapshot({ app, window, readyToShowMs }) {
  const outputPath = process.env.TOEFL_PERF_OUTPUT;
  if (!outputPath) return;
  const initialCpu = process.getCPUUsage();
  await new Promise(resolve => setTimeout(resolve, 2000));
  const renderer = await rendererMetrics(window);
  const processes = app.getAppMetrics().map(metric => ({
    type: metric.type,
    pid: metric.pid,
    cpuPercent: metric.cpu.percentCPUUsage,
    memory: metric.memory
  }));
  const snapshot = {
    capturedAt: new Date().toISOString(),
    readyToShowMs,
    route: process.env.TOEFL_PERF_ROUTE || '/',
    hidden: process.env.TOEFL_PERF_HIDDEN === '1',
    mainCpu: process.getCPUUsage(initialCpu),
    renderer,
    processes,
    totals: {
      workingSetSize: processes.reduce((sum, item) => sum + item.memory.workingSetSize, 0),
      privateBytes: processes.reduce((sum, item) => sum + item.memory.privateBytes, 0),
      rendererCpuPercent: processes
        .filter(item => ['Tab', 'Renderer'].includes(item.type))
        .reduce((sum, item) => sum + item.cpuPercent, 0)
    }
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  if (process.env.TOEFL_PERF_EXIT === '1') app.quit();
}

function rendererMetrics(window) {
  return window.webContents.executeJavaScript(`(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    return {
      domNodes: document.getElementsByTagName('*').length,
      heap: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null,
      navigation: navigation ? {
        domContentLoaded: navigation.domContentLoadedEventEnd,
        load: navigation.loadEventEnd,
        transferSize: navigation.transferSize,
        decodedBodySize: navigation.decodedBodySize
      } : null
    };
  })()`);
}
