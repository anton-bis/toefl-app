import { computed, onBeforeUnmount, onMounted, ref, toValue, watch } from 'vue';

const DEFAULT_URGENT_SECONDS = 60;

export function getRemainingSeconds(timer, now = Date.now()) {
  if (!timer || timer.mode === 'unlimited' || timer.deadlineAt == null) return null;
  return Math.max(0, Math.ceil((timer.deadlineAt - now) / 1000));
}

export function formatExamTime(seconds) {
  if (seconds == null) return '--:--';
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return hours > 0
    ? [hours, minutes, secs].map(part => String(part).padStart(2, '0')).join(':')
    : [minutes, secs].map(part => String(part).padStart(2, '0')).join(':');
}

export function useExamTimer(timerSource, options = {}) {
  const now = ref(options.now?.() ?? Date.now());
  let intervalId;
  let notifiedDeadline = null;
  const timer = computed(() => toValue(timerSource));
  const remainingSeconds = computed(() => getRemainingSeconds(timer.value, now.value));
  const unlimited = computed(() => timer.value?.mode === 'unlimited');
  const hidden = computed(() => Boolean(timer.value?.hidden));
  const expired = computed(() => !unlimited.value && remainingSeconds.value === 0);
  const urgent = computed(
    () =>
      !unlimited.value &&
      remainingSeconds.value > 0 &&
      remainingSeconds.value <= (options.urgentAt ?? DEFAULT_URGENT_SECONDS)
  );
  const display = computed(() => formatExamTime(remainingSeconds.value));

  const tick = () => {
    now.value = options.now?.() ?? Date.now();
    const deadline = timer.value?.deadlineAt;
    if (expired.value && deadline !== notifiedDeadline) {
      notifiedDeadline = deadline;
      options.onExpired?.();
    }
  };

  const stop = () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = undefined;
  };
  const start = () => {
    stop();
    tick();
    if (timer.value?.mode === 'countdown' && timer.value.deadlineAt != null) {
      intervalId = setInterval(tick, options.interval ?? 1000);
    }
  };

  watch(
    () => [timer.value?.mode, timer.value?.deadlineAt],
    () => {
      notifiedDeadline = null;
      start();
    }
  );
  onMounted(start);
  onBeforeUnmount(stop);

  return { now, remainingSeconds, display, unlimited, hidden, urgent, expired, tick, start, stop };
}
