<script setup>
import { computed, ref, watch } from 'vue';
import { sentenceParts, solveAnswerOrder } from './writingLogic.js';

const props = defineProps({
  question: { type: Object, required: true },
  answer: { type: [Object, Array, String], default: null },
  checked: { type: [Boolean, Object], default: false },
  locked: { type: [Boolean, Object], default: false }
});
const emit = defineEmits(['answer']);

const parts = computed(() => sentenceParts(props.question.prompt));
const blankCount = computed(() => parts.value.filter(part => part.type === 'blank').length);
const slots = ref([]);
const dragged = ref(null);
const target = computed(() => solveAnswerOrder(props.question));
const isChecked = computed(() =>
  typeof props.checked === 'object'
    ? Boolean(props.checked?.[props.question.id] ?? props.checked?.revealed)
    : props.checked
);
const isLocked = computed(() =>
  typeof props.locked === 'object' ? Boolean(props.locked?.[props.question.id]) : props.locked
);
const readOnly = computed(() => isChecked.value || isLocked.value);

function restoredSlots(value) {
  const raw = Array.isArray(value) ? value : value?.slots;
  const candidates = props.question.candidates || [];
  if (!Array.isArray(raw)) return Array(blankCount.value).fill(null);
  if (raw.every(item => item == null || Number.isInteger(item))) {
    return Array.from({ length: blankCount.value }, (_, index) => raw[index] ?? null);
  }
  const used = new Set();
  return Array.from({ length: blankCount.value }, (_, slot) => {
    const index = candidates.findIndex(
      (candidate, candidateIndex) => !used.has(candidateIndex) && candidate === raw[slot]
    );
    if (index >= 0) used.add(index);
    return index >= 0 ? index : null;
  });
}

watch(
  () => [props.question.id, props.answer],
  () => {
    slots.value = restoredSlots(props.answer);
  },
  { immediate: true, deep: true }
);

const used = computed(() => new Set(slots.value.filter(value => value != null)));
function save() {
  emit('answer', { slots: [...slots.value] });
}
function place(candidateIndex, targetSlot = slots.value.indexOf(null)) {
  if (readOnly.value || targetSlot < 0 || used.value.has(candidateIndex)) return;
  if (slots.value[targetSlot] != null) slots.value[targetSlot] = null;
  slots.value[targetSlot] = candidateIndex;
  save();
}
function clearSlot(index) {
  if (readOnly.value || slots.value[index] == null) return;
  slots.value[index] = null;
  save();
}
function startDrag(source, index, event) {
  if (readOnly.value) return event.preventDefault();
  dragged.value = { source, index };
  event.dataTransfer?.setData('text/plain', JSON.stringify(dragged.value));
}
function dropOnSlot(index) {
  if (!dragged.value || readOnly.value) return;
  if (dragged.value.source === 'candidate') place(dragged.value.index, index);
  else if (dragged.value.source === 'slot' && dragged.value.index !== index) {
    [slots.value[index], slots.value[dragged.value.index]] = [
      slots.value[dragged.value.index],
      slots.value[index]
    ];
    save();
  }
  dragged.value = null;
}
function dropInBank() {
  if (dragged.value?.source === 'slot') clearSlot(dragged.value.index);
  dragged.value = null;
}
function slotState(index) {
  if (!isChecked.value) return '';
  if (slots.value[index] == null) return 'empty';
  return (props.question.candidates[slots.value[index]] || '').toLowerCase() ===
    (target.value[index] || '').toLowerCase()
    ? 'correct'
    : 'incorrect';
}
function capitalizeFirstSlot(value, index) {
  if (index !== 0 || !value) return value;
  const offset = value.startsWith('(') ? 1 : 0;
  return value.slice(0, offset) + value.charAt(offset).toUpperCase() + value.slice(offset + 1);
}
function slotText(index) {
  const candidate = slots.value[index] == null ? '' : props.question.candidates[slots.value[index]];
  const expected = target.value[index] || '';
  let value = candidate;
  if (isChecked.value && !candidate) value = expected ? `(${expected})` : '';
  else if (isChecked.value && slotState(index) === 'incorrect')
    value = `${candidate} (${expected})`;
  return capitalizeFirstSlot(value, index);
}
</script>

<template>
  <section class="build-sentence exam-content-pane exam-scroll-region" data-testid="build-sentence">
    <h2>Make an appropriate sentence</h2>
    <div class="dialogue-row">
      <div class="avatar">
        <i class="fas fa-user-circle" />
      </div>
      <p>{{ question.speakerA }}</p>
    </div>
    <div class="dialogue-row">
      <div class="avatar">
        <i class="fas fa-user-circle" />
      </div>
      <div class="sentence-line">
        <template v-for="(part, index) in parts" :key="index">
          <span v-if="part.type === 'text'" class="text-segment">{{ part.value }}</span>
          <button
            v-else
            type="button"
            class="blank-slot"
            :class="slotState(part.index)"
            :disabled="readOnly"
            :draggable="slots[part.index] != null && !readOnly"
            :aria-label="`Blank ${part.index + 1}`"
            @click="clearSlot(part.index)"
            @dragstart="startDrag('slot', part.index, $event)"
            @dragover.prevent
            @drop.prevent="dropOnSlot(part.index)"
          >
            {{ slotText(part.index) }}
          </button>
        </template>
      </div>
    </div>
    <div class="candidates" @dragover.prevent @drop.prevent="dropInBank">
      <button
        v-for="(candidate, index) in question.candidates"
        :key="index"
        type="button"
        class="candidate-chip"
        :class="{ used: used.has(index) }"
        :disabled="used.has(index) || readOnly"
        :draggable="!used.has(index) && !readOnly"
        @click="place(index)"
        @dragstart="startDrag('candidate', index, $event)"
      >
        {{ candidate }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.build-sentence {
  max-width: 800px;
  margin: auto;
  padding: 10px 30px;
  color: #222;
}
.build-sentence h2 {
  text-align: center;
  font-size: 30px;
  margin: 0 0 105px;
}
.dialogue-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin: 0 0 16px;
}
.dialogue-row p,
.sentence-line {
  font-size: 20px;
  line-height: 1.5;
  margin: 0;
}
.avatar {
  width: 108px;
  height: 108px;
  border-radius: 50%;
  background: #e8e8ed;
  display: grid;
  place-items: center;
  color: #aaa;
  font-size: 48px;
  flex: none;
}
.sentence-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.text-segment {
  white-space: pre-wrap;
}
.blank-slot {
  min-width: 50px;
  min-height: 32px;
  border: 0;
  border-bottom: 2px solid #333;
  background: white;
  padding: 0 4px;
  font: inherit;
  cursor: pointer;
}
.blank-slot.correct {
  border-color: #4caf50;
  background: #e8f5e9;
}
.blank-slot.incorrect {
  border-color: #f44336;
  background: #ffebee;
}
.blank-slot.empty {
  border-color: #ff9800;
  background: #fff3e0;
}
.candidates {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 16px 0;
  min-height: 44px;
}
.candidate-chip {
  padding: 6px 16px;
  border: 1px solid #ccc;
  border-radius: 20px;
  background: #fff;
  font-size: 20px;
  cursor: pointer;
}
.candidate-chip:hover {
  border-color: #008080;
  background: rgba(0, 128, 128, 0.05);
}
.candidate-chip.used {
  opacity: 0.45;
  background: #e8e8ed;
}
@media (max-width: 700px) {
  .build-sentence h2 {
    margin-bottom: 35px;
  }
  .avatar {
    width: 72px;
    height: 72px;
    font-size: 34px;
  }
}
</style>
