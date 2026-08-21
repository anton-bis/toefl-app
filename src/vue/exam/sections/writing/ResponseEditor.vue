<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { countWords, stripCjk } from './writingLogic.js';

const props = defineProps({
  modelValue: { type: String, default: '' }
});
const emit = defineEmits(['update:modelValue']);
const textarea = ref();
const text = ref(stripCjk(props.modelValue));
const history = ref([]);
const future = ref([]);
const wordCountVisible = ref(true);
const cjkRemoved = ref(false);
const words = computed(() => countWords(text.value));
watch(
  () => props.modelValue,
  value => {
    const cleaned = stripCjk(value);
    if (cleaned !== text.value) text.value = cleaned;
  }
);

function commit(value, record = true) {
  const cleaned = stripCjk(value);
  cjkRemoved.value = cleaned !== value;
  if (record && cleaned !== text.value) {
    history.value.push(text.value);
    if (history.value.length > 50) history.value.shift();
    future.value = [];
  }
  text.value = cleaned;
  emit('update:modelValue', cleaned);
}
function onInput(event) {
  commit(event.target.value);
}
function undo() {
  if (!history.value.length) return;
  future.value.push(text.value);
  const value = history.value.pop();
  text.value = value;
  emit('update:modelValue', value);
}
function redo() {
  if (!future.value.length) return;
  history.value.push(text.value);
  const value = future.value.pop();
  text.value = value;
  emit('update:modelValue', value);
}
async function cut() {
  const element = textarea.value;
  const { selectionStart: start, selectionEnd: end } = element;
  if (start === end) return;
  const selection = text.value.slice(start, end);
  try {
    await navigator.clipboard?.writeText(selection);
  } catch {
    /* Clipboard permission is optional. */
  }
  commit(text.value.slice(0, start) + text.value.slice(end));
  await nextTick();
  element.setSelectionRange(start, start);
  element.focus();
}
async function paste() {
  let clipboardText = '';
  try {
    clipboardText = await navigator.clipboard?.readText();
  } catch {
    return;
  }
  if (!clipboardText) return;
  const element = textarea.value;
  const { selectionStart: start, selectionEnd: end } = element;
  const inserted = stripCjk(clipboardText);
  commit(text.value.slice(0, start) + inserted + text.value.slice(end));
  await nextTick();
  element.setSelectionRange(start + inserted.length, start + inserted.length);
  element.focus();
}
function keyboard(event) {
  const modifier = event.ctrlKey || event.metaKey;
  if (!modifier) return;
  if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
    event.preventDefault();
    undo();
  } else if (
    event.key.toLowerCase() === 'y' ||
    (event.key.toLowerCase() === 'z' && event.shiftKey)
  ) {
    event.preventDefault();
    redo();
  }
}
</script>

<template>
  <div class="editor">
    <div class="toolbar">
      <div>
        <button type="button" @click="cut"><i class="fas fa-cut" /> Cut</button
        ><button type="button" @click="paste"><i class="fas fa-paste" /> Paste</button
        ><button type="button" :disabled="!history.length" @click="undo">
          <i class="fas fa-undo" /> Undo</button
        ><button type="button" :disabled="!future.length" @click="redo">
          <i class="fas fa-redo" /> Redo
        </button>
      </div>
      <div class="count">
        <button type="button" @click="wordCountVisible = !wordCountVisible">
          {{ wordCountVisible ? 'Hide' : 'Show' }} Word Count</button
        ><span :class="{ hidden: !wordCountVisible }">Words: {{ words }}</span>
      </div>
    </div>
    <textarea
      ref="textarea"
      :value="text"
      placeholder="Enter your response here..."
      @input="onInput"
      @keydown="keyboard"
    />
    <p v-if="cjkRemoved" class="input-warning" role="status">
      Chinese characters and CJK punctuation are not accepted in this response.
    </p>
  </div>
</template>

<style scoped>
.editor {
  border: 1px solid #d1d1d6;
  border-radius: 8px;
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 260px;
  container-type: inline-size;
}
.toolbar {
  background: #f0f0f2;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.toolbar > div {
  display: flex;
  gap: 4px;
  align-items: center;
}
.toolbar button {
  padding: 5px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
}
.toolbar button:disabled {
  opacity: 0.45;
  cursor: default;
}
.count span {
  font-size: 14px;
  color: #666;
  min-width: 70px;
  text-align: right;
}
.count span.hidden {
  visibility: hidden;
}
textarea {
  width: 100%;
  flex: 1;
  border: 0;
  border-top: 1px solid #d1d1d6;
  padding: 12px 14px;
  font:
    clamp(19px, 1.35vw, 21px) / 1.55 Arial,
    sans-serif;
  resize: none;
  box-sizing: border-box;
  outline: 0;
}
.input-warning {
  margin: 0;
  padding: 5px 12px;
  color: #a33;
  font-size: 12px;
  background: #fff5f5;
}
@media (max-width: 700px) {
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .toolbar > div {
    flex-wrap: wrap;
    justify-content: space-between;
  }
}
@container (max-width: 600px) {
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .toolbar > div {
    flex-wrap: wrap;
    justify-content: space-between;
  }
}
@media (min-width: 801px) {
  :global(.exam-page--contained) .editor {
    min-height: 0;
  }
}
</style>
