<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: { type: String, required: true },
  progress: { type: Number, default: 0 },
  error: { type: String, default: '' }
});

defineEmits(['retry']);

const isError = computed(() => props.status === 'error');
const isDownloading = computed(() => props.status === 'downloading');
const safeProgress = computed(() => Math.min(100, Math.max(0, Math.round(props.progress))));
const copy = computed(() => {
  const states = {
    storage: {
      title: 'Getting things ready',
      detail: 'Loading your practice data…'
    },
    checking: {
      title: 'Checking the question bank',
      detail: 'Making sure the practice content is ready.'
    },
    downloading: {
      title: 'Downloading the question bank',
      detail: 'This is only needed for new or updated practice content.'
    },
    preparing: {
      title: 'Preparing the question bank',
      detail: 'Verifying the download and getting the tests ready…'
    },
    catalog: {
      title: 'Opening the question bank',
      detail: 'Loading the available practice tests…'
    },
    error: {
      title: 'Question bank unavailable',
      detail: props.error || 'The question bank could not be opened.'
    }
  };
  return states[props.status] || states.checking;
});
</script>

<template>
  <main class="content-startup">
    <section
      class="content-startup__card"
      :class="{ 'content-startup__card--error': isError }"
      :role="isError ? 'alert' : 'status'"
      :aria-live="isError ? 'assertive' : 'polite'"
    >
      <div class="content-startup__mark" aria-hidden="true">
        <i v-if="isError" class="fas fa-circle-exclamation" />
        <span v-else>T</span>
      </div>
      <p class="content-startup__eyebrow">Tofu Practice</p>
      <h1>{{ copy.title }}</h1>
      <p class="content-startup__detail">{{ copy.detail }}</p>

      <div v-if="isDownloading" class="content-startup__progress-wrap">
        <div
          class="content-startup__progress"
          role="progressbar"
          aria-label="Question bank download"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="safeProgress"
        >
          <span :style="{ width: `${safeProgress}%` }" />
        </div>
        <div class="content-startup__progress-copy">
          <span>Downloading content</span>
          <strong>{{ safeProgress }}%</strong>
        </div>
      </div>
      <div v-else-if="!isError" class="content-startup__activity" aria-hidden="true">
        <span /><span /><span />
      </div>

      <button v-if="isError" type="button" @click="$emit('retry')">
        <i class="fas fa-rotate-right" aria-hidden="true" />
        Try Again
      </button>
      <p v-if="isDownloading" class="content-startup__note">
        You can keep this window open. Future updates happen automatically.
      </p>
    </section>
  </main>
</template>

<style scoped>
.content-startup {
  min-height: 100vh;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 32px;
  background:
    radial-gradient(circle at 15% 10%, rgba(0, 128, 128, 0.12), transparent 34%),
    radial-gradient(circle at 88% 90%, rgba(0, 128, 128, 0.08), transparent 30%), #f5f7f7;
}

.content-startup__card {
  width: min(520px, 100%);
  padding: 48px 52px 42px;
  border: 1px solid rgba(0, 102, 102, 0.12);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24px 70px rgba(26, 55, 53, 0.12);
  text-align: center;
}

.content-startup__mark {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  margin: 0 auto 18px;
  border-radius: 18px;
  background: linear-gradient(145deg, #008f8f, #006f70);
  box-shadow: 0 10px 24px rgba(0, 128, 128, 0.22);
  color: #fff;
  font-family: Georgia, serif;
  font-size: 36px;
  font-style: italic;
  font-weight: 700;
}

.content-startup__card--error .content-startup__mark {
  background: #fff0ef;
  box-shadow: none;
  color: #bd342f;
  font-family: inherit;
  font-size: 29px;
}

.content-startup__eyebrow {
  margin: 0 0 9px;
  color: #087a74;
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: #17201e;
  font-size: clamp(25px, 4vw, 32px);
  line-height: 1.2;
}

.content-startup__detail {
  max-width: 390px;
  margin: 13px auto 0;
  color: #66736f;
  font-size: 16px;
  line-height: 1.55;
}

.content-startup__progress-wrap {
  margin-top: 32px;
}

.content-startup__progress {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: #e7eeec;
}

.content-startup__progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #009b93, #007572);
  box-shadow: 0 0 12px rgba(0, 128, 128, 0.22);
  transition: width 180ms ease-out;
}

.content-startup__progress-copy {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  color: #66736f;
  font-size: 13px;
}

.content-startup__progress-copy strong {
  color: #075f5c;
}

.content-startup__activity {
  display: flex;
  justify-content: center;
  gap: 7px;
  margin-top: 30px;
}

.content-startup__activity span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #008580;
  animation: content-pulse 1.15s ease-in-out infinite;
}

.content-startup__activity span:nth-child(2) {
  animation-delay: 150ms;
}

.content-startup__activity span:nth-child(3) {
  animation-delay: 300ms;
}

button {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-top: 28px;
  padding: 11px 23px;
  border: 0;
  border-radius: 9px;
  background: #087f78;
  box-shadow: 0 7px 18px rgba(0, 128, 128, 0.18);
  color: #fff;
  font-weight: 700;
}

button:hover {
  background: #056b66;
}

button:focus-visible {
  outline: 3px solid rgba(0, 128, 128, 0.28);
  outline-offset: 3px;
}

.content-startup__note {
  margin: 20px 0 0;
  color: #87918e;
  font-size: 12px;
}

@keyframes content-pulse {
  0%,
  65%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  35% {
    opacity: 1;
    transform: translateY(-4px);
  }
}

@media (max-width: 600px) {
  .content-startup {
    padding: 18px;
  }

  .content-startup__card {
    padding: 38px 25px 34px;
    border-radius: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .content-startup__activity span {
    animation: none;
    opacity: 0.7;
  }

  .content-startup__progress span {
    transition: none;
  }
}
</style>
