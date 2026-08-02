<script setup lang="ts">
withDefaults(defineProps<{
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "quiet" | "danger";
  busy?: boolean;
  disabled?: boolean;
}>(), {
  type: "button",
  variant: "primary",
  busy: false,
  disabled: false,
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();
</script>

<template>
  <button
    class="semantic-button"
    :class="`semantic-button--${variant}`"
    :type="type"
    :aria-busy="busy"
    :disabled="disabled || busy"
    @click="emit('click', $event)"
  >
    <span v-if="busy" class="semantic-button__status" aria-hidden="true" />
    <span><slot /></span>
  </button>
</template>

<style scoped lang="scss">
@use "../../assets/scss/api" as api;

.semantic-button {
  @include api.touch-target;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  padding: .65rem 1rem;
  font: inherit;
  font-weight: 800;
  line-height: 1.1;
  cursor: pointer;
  transition:
    background var(--duration-quick) var(--easing-enter),
    color var(--duration-quick) var(--easing-enter),
    border-color var(--duration-quick) var(--easing-enter);
}

.semantic-button:focus-visible {
  @include api.focus-ring;
}

.semantic-button:disabled {
  cursor: not-allowed;
  opacity: .58;
}

.semantic-button--primary {
  border-color: var(--color-accent-strong);
  color: var(--color-paper);
  background: var(--color-accent-strong);
}

.semantic-button--secondary {
  border-color: var(--color-accent);
  color: var(--color-accent-strong);
  background: var(--color-paper);
}

.semantic-button--quiet {
  border-color: var(--color-line);
  color: var(--color-text);
  background: transparent;
}

.semantic-button--danger {
  border-color: var(--color-danger);
  color: var(--color-paper);
  background: var(--color-danger);
}

.semantic-button__status {
  width: .75rem;
  height: .75rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: semantic-button-spin .7s linear infinite;
}

@keyframes semantic-button-spin {
  to { transform: rotate(360deg); }
}

@include api.reduced-motion {
  .semantic-button__status {
    animation: none;
  }
}
</style>
