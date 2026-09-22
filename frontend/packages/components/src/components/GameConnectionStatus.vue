<script setup lang="ts">
import {computed} from "vue";
import type {
  GameApiErrorKind,
} from "@munchkin/shared";
import type {
  GameConnectionState,
} from "@munchkin/shared";
import {
  buildConnectionPresentation,
} from "./game/status/systemStateModel";

const props = withDefaults(defineProps<{
  state: GameConnectionState;
  errorMessage?: string;
  errorKind?: GameApiErrorKind | null;
  hasProjection?: boolean;
}>(), {
  errorMessage: "",
  errorKind: null,
  hasProjection: true,
});

const emit = defineEmits<{
  retry: [];
}>();

const presentation = computed(() => buildConnectionPresentation(
  props.state,
  props.errorKind,
  props.hasProjection,
));
</script>

<template>
  <aside
    v-if="presentation.visible"
    class="game-connection-status"
    :class="`game-connection-status--${presentation.tone}`"
    :data-state="state"
    data-figma-owner="game-connection-status"
    :data-figma-desktop-node="errorKind === 'stale_version'
      ? '296:2837'
      : state === 'failed' ? '258:2674' : '258:2530'"
    :aria-busy="presentation.ariaBusy"
    :aria-live="presentation.ariaLive"
  >
    <span class="game-connection-status__icon" aria-hidden="true">
      {{ presentation.icon === "sync" ? "↻" : presentation.icon === "offline" ? "⌁" : "!" }}
    </span>
    <div class="game-connection-status__copy">
      <strong>{{ presentation.label }}</strong>
      <span>{{ presentation.description }}</span>
    </div>
    <button
      v-if="presentation.canRetry"
      class="game-connection-status__retry"
      type="button"
      @click="emit('retry')"
    >
      Попробовать снова
    </button>
  </aside>
</template>

<style scoped lang="scss">
.game-connection-status {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 80;
  width: min(440px, calc(100% - 32px));
  min-height: 132px;
  transform: translate(-50%, -50%);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  border: 1px solid var(--color-line);
  border-radius: 20px;
  padding: 24px;
  color: var(--color-text);
  background: var(--color-surface);
  box-shadow: 0 12px 48px rgb(38 34 31 / 24%);
}

.game-connection-status--warning {
  border-color: var(--color-info);
}

.game-connection-status--danger {
  border-color: var(--color-danger);
}

.game-connection-status__icon {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid currentColor;
  border-radius: 50%;
  color: var(--color-accent-strong);
  font-size: 1rem;
  font-weight: 800;
}

.game-connection-status--warning .game-connection-status__icon {
  color: var(--color-info);
}

.game-connection-status--danger .game-connection-status__icon {
  color: var(--color-danger);
}

.game-connection-status__copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.game-connection-status__copy strong,
.game-connection-status__copy span {
  overflow-wrap: anywhere;
}

.game-connection-status__copy strong {
  font-size: 1.25rem;
}

.game-connection-status__copy span {
  color: var(--color-text-muted);
  font-size: .875rem;
  line-height: 1.35;
}

.game-connection-status__retry {
  min-height: 2.5rem;
  border: 1px solid var(--color-accent-strong);
  border-radius: var(--radius-control);
  padding: .4rem .7rem;
  color: var(--color-paper);
  background: var(--color-accent-strong);
  font-size: .72rem;
  font-weight: 800;
}

@media (width <= 599px) {
  .game-connection-status {
    grid-template-columns: auto minmax(0, 1fr);
    width: calc(100% - 24px);
    padding: 20px;
  }

  .game-connection-status__retry {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
