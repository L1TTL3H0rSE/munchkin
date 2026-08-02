<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: number;
  label?: string;
  delta?: number;
  compact?: boolean;
}>(), {
  label: "Сила",
  delta: undefined,
  compact: false,
});

const accessibleLabel = computed(() => {
  const delta = props.delta === undefined
    ? ""
    : `, изменение ${props.delta >= 0 ? "+" : ""}${props.delta}`;
  return `${props.label}: ${props.value}${delta}`;
});
</script>

<template>
  <span
    class="strength-indicator"
    :class="{'strength-indicator--compact': compact}"
    :aria-label="accessibleLabel"
  >
    <span class="strength-indicator__label">{{ label }}</span>
    <strong>{{ value }}</strong>
    <span v-if="delta !== undefined" class="strength-indicator__delta">
      {{ delta >= 0 ? "+" : "" }}{{ delta }}
    </span>
  </span>
</template>

<style scoped>
.strength-indicator {
  min-width: 0;
  display: inline-flex;
  align-items: baseline;
  gap: .35rem;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.strength-indicator strong {
  color: var(--color-text);
  font-size: 1.25rem;
  line-height: 1;
}

.strength-indicator--compact strong {
  font-size: 14px;
}

.strength-indicator__label,
.strength-indicator__delta {
  font-size: .72rem;
  font-weight: 800;
}

.strength-indicator__delta {
  color: var(--color-rust);
}
</style>
