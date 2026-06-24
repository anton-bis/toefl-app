export function createTimer(onTick, onTimeout, maxSeconds) {
  let elapsed = 0;
  let runningSince = 0;
  let rafId = null;
  let active = false;
  let started = false;

  function tick() {
    if (!active) return;
    var ms = elapsed + (performance.now() - runningSince);
    var remaining = maxSeconds ? Math.max(0, maxSeconds * 1000 - ms) : ms;
    onTick(formatTime(remaining));
    if (maxSeconds && ms >= maxSeconds * 1000) {
      stopInternal();
      onTimeout();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (started) return;
    started = true;
    active = true;
    elapsed = 0;
    runningSince = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    if (!active) return;
    active = false;
    elapsed += performance.now() - runningSince;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function resume() {
    if (active || !started) return;
    active = true;
    runningSince = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stopInternal() {
    if (active) {
      elapsed += performance.now() - runningSince;
    }
    active = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function reset() {
    stopInternal();
    started = false;
    active = false;
    elapsed = 0;
    runningSince = 0;
  }

  function getElapsed() {
    if (!started) return 0;
    if (active) return elapsed + (performance.now() - runningSince);
    return elapsed;
  }

  function formatTime(ms) {
    var totalSeconds = Math.floor(ms / 1000);
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  return {
    start: start,
    pause: pause,
    resume: resume,
    reset: reset,
    getElapsed: getElapsed,
    isActive: function () { return active; },
    isStarted: function () { return started; },
    getInitialDisplay: function () {
      if (!maxSeconds) return '00:00';
      return formatTime(maxSeconds * 1000);
    },
    stop: stopInternal
  };
}
