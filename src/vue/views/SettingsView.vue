<script setup>
import { computed, ref } from 'vue';
import ActivationModal from '../components/ActivationModal.vue';
import { useLicenseStore } from '../stores/license.js';
import '../styles/settings.css';

const license = useLicenseStore();
const showActivation = ref(false);
const notice = ref('');
const noticeError = ref('');

const isDesktop = computed(() => license.isDesktop);
const activated = computed(() => license.activated);

const statusText = computed(() => {
  const map = {
    none: '未激活',
    active: '已激活',
    locked: '已锁定',
    unavailable: '当前环境不支持激活'
  };
  return map[license.status] || license.status;
});

const expiresAtText = computed(() => {
  if (!license.expiresAt) return '';
  try {
    return new Date(license.expiresAt).toLocaleString();
  } catch {
    return '';
  }
});

function deviceLabel(device, index) {
  const prefix = device?.current ? '本机' : `设备 ${index + 1}`;
  return `${prefix} · ${String(device?.deviceId || '')}`;
}

function clearNotice() {
  notice.value = '';
  noticeError.value = '';
}

async function refreshNow() {
  clearNotice();
  const result = await license.refreshNow();
  if (result?.ok) notice.value = '已检查许可证状态。';
  else noticeError.value = '无法连接服务器，请检查网络后重试。';
}

async function unbind() {
  clearNotice();
  if (!window.confirm('确定解绑本机吗？解绑后本机将需要重新激活。')) return;
  const result = await license.unbind();
  if (result.ok) notice.value = '本机已解绑。';
  else noticeError.value = result.error?.message || '解绑失败，请重试。';
}
</script>

<template>
  <main class="settings-page">
    <header class="settings-header">
      <h1>Settings</h1>
      <p>许可证与设备管理</p>
    </header>

    <section class="settings-card">
      <h2><i class="fas fa-key" aria-hidden="true" /> 激活与设备</h2>

      <p v-if="notice" class="settings-notice" role="status">{{ notice }}</p>
      <p v-if="noticeError" class="settings-error" role="alert">{{ noticeError }}</p>

      <div class="settings-row">
        <span class="settings-label">许可证状态</span>
        <span class="settings-value" :class="{ 'settings-value--danger': license.status === 'locked' }">
          {{ statusText }}
        </span>
      </div>
      <div v-if="expiresAtText" class="settings-row">
        <span class="settings-label">有效期至</span>
        <span class="settings-value">{{ expiresAtText }}</span>
      </div>
      <div v-if="license.deviceCount" class="settings-row">
        <span class="settings-label">已绑定设备</span>
        <span class="settings-value">{{ license.deviceCount }} / 2</span>
      </div>

      <ul v-if="license.devices.length" class="device-list">
        <li v-for="(device, index) in license.devices" :key="device.deviceId" class="device-item">
          <span class="device-item__name">{{ deviceLabel(device, index) }}</span>
          <span v-if="device.current" class="device-item__tag">当前设备</span>
        </li>
      </ul>

      <div v-if="isDesktop" class="settings-actions">
        <button
          type="button"
          class="settings-btn settings-btn--primary"
          @click="showActivation = true"
        >
          {{ activated ? '更换序列号' : '激活' }}
        </button>
        <button type="button" class="settings-btn" @click="refreshNow">检查许可证</button>
        <button
          v-if="activated"
          type="button"
          class="settings-btn settings-btn--danger"
          @click="unbind"
        >
          解绑本机
        </button>
      </div>
      <p v-else class="settings-hint">序列号激活仅适用于桌面版。</p>

      <p class="settings-hint">
        一个序列号最多绑定 2 台设备。换机 / 丢机需要解绑其他设备时，请联系卖家在后台处理。
      </p>
    </section>

    <ActivationModal
      v-if="showActivation"
      @close="showActivation = false"
      @activated="showActivation = false"
    />
  </main>
</template>
