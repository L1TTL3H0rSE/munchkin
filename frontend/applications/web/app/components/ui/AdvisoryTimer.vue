<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref, watch} from "vue";
import {
  advisoryRemainingMilliseconds,
  formatAdvisoryTime,
} from "./advisoryTimerModel";

const props = withDefaults(defineProps<{
  deadlineAt: string;
  serverTime: string;
  now?: number;
  label?: string;
}>(), {
  now: undefined,
  label: "Осталось",
});

const receivedAt = ref(Date.now());
const currentTime = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

const remaining = computed(() => advisoryRemainingMilliseconds(
  props.deadlineAt,
  props.serverTime,
  props.now ?? currentTime.value,
  receivedAt.value,
));

const formatted = computed(() => formatAdvisoryTime(remaining.value));

watch(
  () => [props.deadlineAt, props.serverTime],
  () => {
    receivedAt.value = Date.now();
    currentTime.value = receivedAt.value;
  },
);

onMounted(() => {
  if (props.now === undefined) {
    timer = setInterval(() => {
      currentTime.value = Date.now();
    }, 1000);
  }
});

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer);
  }
});
</script>

<template>
  <span
    class="advisory-timer"
    :class="{'advisory-timer--expired': remaining === 0}"
    role="status"
    aria-live="polite"
  >
    <span class="advisory-timer__label">{{ label }}</span>
    <strong>{{ formatted }}</strong>
  </span>
</template>

<style scoped>
.advisory-timer {
  display: inline-flex;
  align-items: baseline;
  gap: .35rem;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.advisory-timer strong {
  color: var(--color-text);
  font-size: .9rem;
}

.advisory-timer--expired strong {
  color: var(--color-rust);
}

.advisory-timer__label {
  font-size: .7rem;
  font-weight: 800;
  text-transform: uppercase;
}
</style>
