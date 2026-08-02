<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import {phaseLabel} from "./phaseModel";

type Phase = Projection["turn"]["phase"];

const props = defineProps<{
  phase: Phase;
}>();

const label = computed(() => phaseLabel(props.phase));
</script>

<template>
  <span class="phase-label" :data-phase="phase">
    <span class="phase-label__dot" aria-hidden="true" />
    <span>{{ label }}</span>
  </span>
</template>

<style scoped>
.phase-label {
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  color: var(--color-text-muted);
  font-size: .72rem;
  font-weight: 800;
  letter-spacing: .07em;
  text-transform: uppercase;
}

.phase-label__dot {
  width: .55rem;
  height: .55rem;
  border-radius: 50%;
  background: var(--color-accent);
}

.phase-label[data-phase="combat"] .phase-label__dot,
.phase-label[data-phase="run_away"] .phase-label__dot {
  background: var(--color-rust);
}

.phase-label[data-phase="charity"] .phase-label__dot,
.phase-label[data-phase="resolve_effect"] .phase-label__dot {
  background: var(--color-info);
}
</style>
