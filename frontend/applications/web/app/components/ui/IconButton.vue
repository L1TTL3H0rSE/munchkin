<script setup lang="ts">
withDefaults(defineProps<{
  label: string;
  pressed?: boolean;
  disabled?: boolean;
}>(), {
  pressed: undefined,
  disabled: false,
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<template>
  <button
    class="icon-button"
    type="button"
    :aria-label="label"
    :aria-pressed="pressed"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <span aria-hidden="true"><slot>•</slot></span>
  </button>
</template>

<style scoped lang="scss">
@use "../../assets/scss/api" as api;

.icon-button {
  @include api.touch-target;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--color-line);
  border-radius: 50%;
  color: var(--color-text);
  background: var(--color-paper);
  font: inherit;
  font-size: 1.1rem;
  cursor: pointer;
}

.icon-button:focus-visible {
  @include api.focus-ring;
}

.icon-button[aria-pressed="true"] {
  border-color: var(--color-accent-strong);
  color: var(--color-paper);
  background: var(--color-accent-strong);
}

.icon-button:disabled {
  cursor: not-allowed;
  opacity: .55;
}
</style>
