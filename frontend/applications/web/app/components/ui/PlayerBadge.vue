<script setup lang="ts">
withDefaults(defineProps<{
  name: string;
  level: number;
  strength?: number;
  handCount?: number;
  status?: "ready" | "waiting" | "dead" | "active";
  current?: boolean;
}>(), {
  strength: undefined,
  handCount: undefined,
  status: "ready",
  current: false,
});
</script>

<template>
  <article
    class="player-badge"
    :class="{'player-badge--current': current}"
    :data-status="status"
    :aria-current="current ? 'step' : undefined"
  >
    <span class="player-badge__avatar" aria-hidden="true">
      {{ name.slice(0, 1).toUpperCase() }}
    </span>
    <span class="player-badge__copy">
      <strong>{{ name }}</strong>
      <span>Уровень {{ level }}</span>
    </span>
    <span class="player-badge__stats">
      <span v-if="strength !== undefined">Сила {{ strength }}</span>
      <span v-if="handCount !== undefined">Рука {{ handCount }}</span>
      <span class="player-badge__status">{{ status }}</span>
    </span>
  </article>
</template>

<style scoped lang="scss">
.player-badge {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  padding: var(--space-2);
  color: var(--color-text-muted);
  background: var(--color-paper);
}

.player-badge--current {
  border-color: var(--color-accent-strong);
  box-shadow: inset 4px 0 var(--color-accent-strong);
}

.player-badge__avatar {
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--color-paper);
  background: var(--color-accent-strong);
  font-weight: 900;
}

.player-badge__copy,
.player-badge__stats {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.player-badge__copy strong {
  overflow-wrap: anywhere;
  color: var(--color-text);
}

.player-badge__copy span,
.player-badge__stats {
  font-size: .72rem;
}

.player-badge__stats {
  justify-items: end;
  text-align: end;
}

.player-badge__status {
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.player-badge[data-status="dead"] .player-badge__avatar {
  background: var(--color-danger);
}

.player-badge[data-status="waiting"] .player-badge__avatar {
  background: var(--color-info);
}

@media (width <= 374px) {
  .player-badge {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .player-badge__stats {
    grid-column: 2;
    justify-items: start;
    text-align: start;
  }
}
</style>
