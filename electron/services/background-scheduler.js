const DEFAULT_APP_INTERVAL = 6 * 60 * 60 * 1000;
const DEFAULT_CONTENT_INTERVAL = 24 * 60 * 60 * 1000;
const DEFAULT_UNAVAILABLE_RETRY = 5 * 60 * 1000;
const DEFAULT_ERROR_RETRY = 15 * 60 * 1000;

export function createBackgroundScheduler({
  canRun,
  runAppUpdate,
  runContentUpdate,
  onError,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  appInterval = DEFAULT_APP_INTERVAL,
  contentInterval = DEFAULT_CONTENT_INTERVAL,
  unavailableRetry = DEFAULT_UNAVAILABLE_RETRY,
  errorRetry = DEFAULT_ERROR_RETRY
}) {
  let generation = 0;
  const timers = new Set();

  function clear() {
    generation += 1;
    for (const timer of timers) clearTimer(timer);
    timers.clear();
  }

  function schedule(kind, delay, currentGeneration) {
    const timer = setTimer(async () => {
      timers.delete(timer);
      if (currentGeneration !== generation) return;
      let nextDelay = kind === 'app' ? appInterval : contentInterval;
      try {
        if (!canRun()) nextDelay = unavailableRetry;
        else if (kind === 'app') await runAppUpdate();
        else await runContentUpdate();
      } catch (error) {
        nextDelay = errorRetry;
        onError?.(kind, error);
      }
      if (currentGeneration === generation) schedule(kind, nextDelay, currentGeneration);
    }, delay);
    timers.add(timer);
  }

  function restart(initialDelay = 30_000) {
    clear();
    const currentGeneration = generation;
    schedule('app', initialDelay, currentGeneration);
    schedule('content', initialDelay + 15_000, currentGeneration);
  }

  return { restart, stop: clear };
}
