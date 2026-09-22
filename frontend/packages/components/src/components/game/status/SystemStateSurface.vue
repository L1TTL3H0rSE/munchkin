<script setup lang="ts">
import {computed} from "vue";
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
const figmaNode = computed(() => ({
  loading: "296:3058",
  auth: "296:3133",
  "not-found": "297:3103",
  unavailable: "297:3103",
  protocol: "297:3103",
  death: "294:2384",
  "death-recovery": "295:2444",
} as Partial<Record<SystemSurfaceKind, string>>)[props.kind]);
const skeletonRows = ["one", "two", "three"] as const;
</script>

<template>
  <section
    class="system-state-surface"
    :class="`system-state-surface--${model.tone}`"
    :data-state="kind"
    :data-figma-owner="`game-system:${kind}`"
    :data-figma-desktop-node="figmaNode"
    data-figma-compact-node="unverified"
    :aria-busy="kind === 'loading'"
    :aria-labelledby="titleID"
  >
    <header class="system-state-surface__header" aria-hidden="true">
      <span>{{ model.eyebrow }}</span>
      <b>{{ kind === "loading" ? "ЗАГРУЗКА" : kind === "auth" ? "СЕССИЯ" : "СОСТОЯНИЕ ИГРЫ" }}</b>
      <small>СЕРВЕР</small>
    </header>
    <div class="system-state-surface__layout">
      <aside class="system-state-surface__opponents" aria-hidden="true">
        <b>СОПЕРНИКИ</b>
        <span v-for="row in skeletonRows" :key="`opponent-${row}`" />
        <i>КОМНАТА</i>
      </aside>
      <main class="system-state-surface__stage">
        <div class="system-state-surface__mark" aria-hidden="true">
          <span v-if="model.icon === 'loading'" class="system-state-surface__spinner" />
          <span v-else-if="model.icon === 'lock'">⌑</span>
          <span v-else-if="model.icon === 'search'">⌕</span>
          <span v-else-if="model.icon === 'offline'">⌁</span>
          <span v-else-if="model.icon === 'sync'">↻</span>
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
            <a v-else href="/">
              {{ model.primaryLabel }}
            </a>
          </div>
        </div>
      </main>
      <aside class="system-state-surface__sidebar" aria-hidden="true">
        <section><span>СТАТУС</span><strong>{{ model.title }}</strong></section>
        <section><span>ПЕРСОНАЖ</span><strong>{{ projection?.you.name ?? "—" }}</strong></section>
        <section><span>ДЕЙСТВИЯ</span><strong>{{ model.primaryLabel ?? "Ожидание сервера" }}</strong></section>
      </aside>
      <section class="system-state-surface__hand" aria-hidden="true">
        <b>РУКА</b>
        <span v-for="row in skeletonRows" :key="`hand-${row}`" />
      </section>
    </div>
  </section>
</template>

<style scoped lang="scss">
.system-state-surface {
  width: min(100%, 1440px);
  min-width: 0;
  min-height: 100dvh;
  margin-inline: auto;
  box-sizing: border-box;
  padding: 16px;
  color: var(--color-text-primary);
  background: var(--color-canvas);
}
.system-state-surface__header {
  min-height: 56px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  padding: 0 16px;
  background: var(--color-surface);
  box-shadow: 0 4px 6px rgb(23 62 67 / 14%);
}
.system-state-surface__header span,
.system-state-surface__header small { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.system-state-surface__header b { color: var(--color-accent-strong); font-size: 11px; letter-spacing: .08em; }
.system-state-surface__header small { justify-self: end; }
.system-state-surface__layout {
  display: grid;
  grid-template-columns: minmax(190px, 248px) minmax(360px, 1fr) minmax(260px, 360px);
  grid-template-rows: minmax(502px, 1fr) 278px;
  gap: 16px;
  min-width: 0;
  min-height: calc(100dvh - 104px);
  margin-top: 16px;
}
.system-state-surface__opponents,
.system-state-surface__stage,
.system-state-surface__sidebar {
  min-width: 0;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  background: var(--color-surface);
}
.system-state-surface__opponents { grid-row: 1 / span 2; display: grid; align-content: start; gap: 16px; padding: 16px; }
.system-state-surface__opponents b,
.system-state-surface__opponents i { color: var(--color-text-muted); font-size: 9px; font-style: normal; letter-spacing: .08em; }
.system-state-surface__opponents > span { height: 82px; border: 1px solid var(--color-line); border-radius: 14px; background: linear-gradient(90deg, var(--color-surface-card), #eee5d9, var(--color-surface-card)); }
.system-state-surface__opponents i { margin-top: auto; border: 1px solid var(--color-line); border-radius: 14px; padding: 16px; }
.system-state-surface__stage { display: grid; place-items: center; padding: 24px; }
.system-state-surface__mark { display: grid; place-items: center; width: 64px; height: 64px; border: 1px solid currentColor; border-radius: 50%; color: var(--color-accent-strong); font-size: 30px; }
.system-state-surface--warning .system-state-surface__mark { color: var(--color-info); }
.system-state-surface--danger .system-state-surface__mark { color: var(--color-danger); }
.system-state-surface--success .system-state-surface__mark { color: var(--color-success); }
.system-state-surface__body { width: min(100%, 560px); min-width: 0; text-align: center; }
.system-state-surface__eyebrow,
.system-state-surface h1,
.system-state-surface__description,
.system-state-surface__winner { margin: 0; }
.system-state-surface__eyebrow { margin-top: 18px; color: var(--color-text-muted); font-size: 10px; font-weight: 800; letter-spacing: .1em; }
.system-state-surface h1 { margin-top: 8px; overflow-wrap: anywhere; font-size: clamp(24px, 4vw, 34px); }
.system-state-surface__description,
.system-state-surface__winner,
.system-state-surface__note { margin: 10px 0 0; color: var(--color-text-muted); line-height: 1.5; }
.system-state-surface__note { color: var(--color-accent-strong); }
.system-state-surface__winner strong { color: var(--color-text-primary); }
.system-state-surface__actions { display: flex; justify-content: center; margin-top: 20px; }
.system-state-surface__actions a,
.system-state-surface__actions button { min-height: 52px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 14px; padding: 0 24px; color: #fff9ef; background: var(--color-accent-strong); font: inherit; font-weight: 800; text-decoration: none; }
.system-state-surface__skeleton { display: grid; justify-items: center; gap: 8px; margin-top: 20px; }
.system-state-surface__skeleton span { width: min(100%, 30rem); height: 12px; border-radius: 999px; background: var(--color-line); }
.system-state-surface__skeleton span:nth-child(2) { width: 82%; }
.system-state-surface__skeleton span:nth-child(3) { width: 56%; }
.system-state-surface__sidebar { grid-column: 3; grid-row: 1 / span 2; display: grid; grid-template-rows: 1.4fr .8fr .9fr; gap: 24px; padding: 16px; }
.system-state-surface__sidebar section { display: grid; align-content: start; gap: 16px; border: 1px solid var(--color-line); border-radius: 16px; padding: 16px; background: var(--color-surface-card); }
.system-state-surface__sidebar span { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.system-state-surface__sidebar strong { overflow-wrap: anywhere; font-size: 18px; }
.system-state-surface__hand { grid-column: 2; min-width: 0; display: flex; align-items: end; gap: 16px; border-radius: 16px; padding: 16px 20px; color: #fff9ef; background: var(--color-ink); }
.system-state-surface__hand b { align-self: start; font-size: 9px; letter-spacing: .08em; }
.system-state-surface__hand span { flex: 0 0 min(24%, 150px); height: 210px; border-radius: 14px; background: linear-gradient(#aabdb5 0 44%, #fff9ef 44%); }
.system-state-surface__spinner { width: 28px; height: 28px; border: 3px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: system-state-spin var(--duration-context) linear infinite; }
@keyframes system-state-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .system-state-surface__spinner { animation: none; } }
@media (width < 1024px) {
  .system-state-surface { padding: 12px 14px calc(16px + env(safe-area-inset-bottom, 0px)); }
  .system-state-surface__header { min-height: 52px; }
  .system-state-surface__layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); min-height: calc(100dvh - 84px); margin-top: 8px; }
  .system-state-surface__opponents,
  .system-state-surface__sidebar,
  .system-state-surface__hand { display: none; }
  .system-state-surface__stage { min-height: 0; border-radius: 14px; padding: clamp(18px, 5vw, 32px); }
}
</style>
