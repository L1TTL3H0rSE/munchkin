<script setup lang="ts">
import AdvisoryTimer from "../../ui/AdvisoryTimer.vue";

withDefaults(defineProps<{
  count: number;
  deadlineAt?: string;
  serverTime?: string;
  hasActionableDeadline?: boolean;
  hasInteraction?: boolean;
  disabled?: boolean;
}>(), {
  deadlineAt: undefined,
  serverTime: undefined,
  hasActionableDeadline: false,
  hasInteraction: false,
  disabled: false,
});

const emit = defineEmits<{
  open: [];
}>();
</script>

<template>
  <button
    class="hand-tab"
    type="button"
    :disabled="disabled"
    :aria-label="`Открыть руку, ${count} карт${hasInteraction ? ', есть открытое взаимодействие' : ''}`"
    @click="emit('open')"
  >
    <span
      v-if="hasActionableDeadline && deadlineAt && serverTime"
      class="hand-tab__timer"
    >
      <AdvisoryTimer
        :deadline-at="deadlineAt"
        :server-time="serverTime"
      />
    </span>
    <span class="hand-tab__label">Рука · {{ count }}</span>
    <span
      v-if="hasInteraction"
      class="hand-tab__interaction"
      aria-label="Есть открытое взаимодействие"
    >
      !
    </span>
  </button>
</template>

<style scoped lang="scss">
@use "../../../assets/scss/api" as api;

.hand-tab {
  @include api.touch-target;
  min-width: min(100%, 13rem);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-accent-strong);
  border-radius: var(--radius-panel) var(--radius-panel) 0 0;
  padding: .65rem .8rem;
  color: var(--color-paper);
  background: var(--color-accent-strong);
  font: inherit;
  cursor: pointer;
}

.hand-tab:focus-visible {
  @include api.focus-ring;
}

.hand-tab:disabled {
  cursor: not-allowed;
  opacity: .58;
}

.hand-tab__label {
  justify-self: center;
  font-weight: 900;
  white-space: nowrap;
}

.hand-tab__timer {
  justify-self: start;
  min-width: 0;
  color: var(--color-paper);
}

.hand-tab__timer :deep(.advisory-timer) {
  color: inherit;
}

.hand-tab__timer :deep(.advisory-timer strong) {
  color: inherit;
}

.hand-tab__interaction {
  justify-self: end;
  width: 1.5rem;
  height: 1.5rem;
  display: grid;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 50%;
  font-weight: 900;
}
</style>
