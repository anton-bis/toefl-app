<script setup>
defineProps({
  chars: { type: Array, required: true },
  start: { type: Number, required: true },
  currentIndex: { type: Number, required: true }
});
</script>

<template>
  <span class="typing-character-chunk">
    <span
      v-for="(char, offset) in chars"
      :key="offset"
      v-memo="[char.status, start + offset === currentIndex]"
      class="char"
      :class="[`char-${char.status}`, { 'char-current': start + offset === currentIndex }]"
      >{{ char.expected }}</span
    >
  </span>
</template>
