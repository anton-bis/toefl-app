<script setup>
const props = defineProps({
  text: { type: String, default: '' },
  term: { type: String, default: '' }
});

function highlighted(text) {
  if (!props.term) return [String(text ?? '')];
  const escaped = props.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text ?? '').split(new RegExp(`(${escaped})`, 'gi'));
}
</script>

<template>
  <template v-for="(part, index) in highlighted(text)" :key="index">
    <mark v-if="term && part.toLowerCase() === term.toLowerCase()">{{ part }}</mark
    ><span v-else>{{ part }}</span>
  </template>
</template>
