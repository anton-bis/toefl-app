<script setup>
import { computed, ref } from 'vue';
import AppModal from './AppModal.vue';
import { useLicenseStore } from '../stores/license.js';

const emit = defineEmits(['close', 'activated']);
const license = useLicenseStore();
const code = ref('');
const error = ref('');
const busy = ref(false);

function formatSerialInput(value) {
  const compact = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16);
  return compact.replace(/([A-Z0-9]{4})(?=[A-Z0-9])/g, '$1-');
}

const canSubmit = computed(() => code.value.length === 19);

function updateCode(event) {
  code.value = formatSerialInput(event.target.value);
}

async function submit() {
  if (busy.value || !canSubmit.value) return;
  error.value = '';
  busy.value = true;
  const result = await license.activate(code.value);
  busy.value = false;
  if (result.ok) emit('activated');
  else error.value = result.error?.message || '激活失败，请重试';
}
</script>

<template>
  <AppModal title="激活官方真题" icon="fas fa-key" @close="$emit('close')">
    <p v-if="license.status === 'locked'" class="license-alert" role="alert">
      <i class="fas fa-circle-exclamation" /> 许可证已过期，请联网重新激活。
    </p>
    <p>
      输入购买时获得的序列号，解锁全部官方真题。一个序列号最多激活 2 台设备，
      换机后可在「设置」中解绑。
    </p>
    <input
      :value="code"
      type="text"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      class="serial-input"
      placeholder="XXXX-XXXX-XXXX-XXXX"
      maxlength="19"
      aria-label="序列号"
      @input="updateCode"
      @keydown.enter="submit"
    />
    <p v-if="error" class="license-error" role="alert">{{ error }}</p>
    <template #footer>
      <button type="button" class="practice-cancel" @click="$emit('close')">取消</button>
      <button type="button" class="practice-restart" :disabled="busy || !canSubmit" @click="submit">
        {{ busy ? '激活中…' : '激活' }}
      </button>
    </template>
  </AppModal>
</template>
