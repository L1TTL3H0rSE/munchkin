<script setup lang="ts">
import {useId} from "vue";
import type {Projection} from "@munchkin/contracts";

import {
  buildSystemSurface,
  type SystemSurfaceKind,
} from "./systemStateModel";

const props = defineProps<{
  kind: SystemSurfaceKind;
  projection?: Projection;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const titleID = `system-state-title-${useId()}`;
const model = computed(() => buildSystemSurface(props.kind, props.projection));
const skeletonRows = ["one", "two", "three"] as const;
</script>

<template>
  <section
    class="system-state-surface"
    :class="`system-state-surface--${model.tone}`"
    :data-state="kind"
    :aria-busy="kind === 'loading'"
    :aria-labelledby="titleID"
  >
    <div class="system-state-surface__mark" aria-hidden="true">
      <span v-if="model.icon === 'loading'" class="system-state-surface__spinner" />
      <span v-else-if="model.icon === 'lock'">⌑</span>
      <span v-else-if="model.icon === 'search'">⌕</span>
      <span v-else-if="model.icon === 'offline'">⌁</span>
      <span v-else-if="model.icon === 'sync'">↻</span>
      <span v-else-if="model.icon === 'trophy'">✦</span>
      <span v-else-if="model.icon === 'skull'">×</span>
      <span v-else>·</span>
    </div>
    <div class="system-state-surface__body">
      <p class="system-state-surface__eyebrow">{{ model.eyebrow }}</p>
      <h1 :id="titleID">{{ model.title }}</h1>
      <p class="system-state-surface__description">{{ model.description }}</p>
      <p v-if="kind === 'loading'" class="system-state-surface__note">Не закрывайте вкладку</p>
      <p v-if="model.winnerName" class="system-state-surface__winner">
        Победитель: <strong>{{ model.winnerName }}</strong>
      </p>
      <div v-if="kind === 'loading'" class="system-state-surface__skeleton" aria-hidden="true">
        <span v-for="row in skeletonRows" :key="row" />
      </div>
      <div v-if="model.primaryAction" class="system-state-surface__actions">
        <button
          v-if="model.primaryAction === 'retry'"
          type="button"
          @click="emit('retry')"
        >
          {{ model.primaryLabel }}
        </button>
        <NuxtLink v-else to="/">
          {{ model.primaryLabel }}
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.system-state-surface {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--space-4);
  width: min(100%, 52rem);
  min-width: 0;
  border: 1px solid var(--color-line);
  border-top: 4px solid var(--color-accent-strong);
  border-radius: var(--radius-panel);
  padding: clamp(var(--space-4), 4vw, var(--space-8));
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 1rem 3rem rgb(38 55 46 / 9%);
}

.system-state-surface--warning {
  border-top-color: var(--color-info);
}

.system-state-surface--danger {
  border-top-color: var(--color-danger);
}

.system-state-surface--success {
  border-top-color: var(--color-success);
}

.system-state-surface__mark {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border: 1px solid currentColor;
  border-radius: 50%;
  color: var(--color-accent-strong);
  font-size: 1.5rem;
  line-height: 1;
}

.system-state-surface--warning .system-state-surface__mark {
  color: var(--color-info);
}

.system-state-surface--danger .system-state-surface__mark {
  color: var(--color-danger);
}

.system-state-surface--success .system-state-surface__mark {
  color: var(--color-success);
}

.system-state-surface__body {
  min-width: 0;
}

.system-state-surface__eyebrow,
.system-state-surface h1,
.system-state-surface__description,
.system-state-surface__winner {
  margin: 0;
}

.system-state-surface__eyebrow {
  color: var(--color-text-muted);
  font-family: var(--font-meta);
  font-size: .68rem;
  font-weight: 800;
  letter-spacing: .1em;
}

.system-state-surface h1 {
  margin-top: var(--space-1);
  overflow-wrap: anywhere;
  font-size: clamp(1.35rem, 4vw, 2rem);
}

.system-state-surface__description,
.system-state-surface__winner,
.system-state-surface__note {
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.system-state-surface__note {
  color: var(--color-accent-strong);
}

.system-state-surface__winner strong {
  color: var(--color-text);
}

.system-state-surface__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.system-state-surface__actions a,
.system-state-surface__actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  border: 1px solid var(--color-accent-strong);
  border-radius: var(--radius-control);
  padding: .6rem 1rem;
  color: var(--color-paper);
  background: var(--color-accent-strong);
  font-weight: 800;
  text-decoration: none;
}

.system-state-surface__skeleton {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.system-state-surface__skeleton span {
  display: block;
  width: min(100%, 30rem);
  height: .75rem;
  border-radius: 999px;
  background: var(--color-line);
}

.system-state-surface__skeleton span:nth-child(2) {
  width: 82%;
}

.system-state-surface__skeleton span:nth-child(3) {
  width: 56%;
}

.system-state-surface__spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: system-state-spin var(--duration-context) linear infinite;
}

@keyframes system-state-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .system-state-surface__spinner {
    animation: none;
  }
}

@media (width <= 599px) {
  .system-state-surface {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }

  .system-state-surface__mark {
    width: 2.5rem;
    height: 2.5rem;
  }
}
</style>
