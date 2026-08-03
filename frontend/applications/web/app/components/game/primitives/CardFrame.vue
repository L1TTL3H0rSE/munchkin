<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";
import CardArtPlaceholder from "./CardArtPlaceholder.vue";

withDefaults(defineProps<{
  deck: CardView["deck"];
  compact?: boolean;
  ariaLabel?: string;
}>(), {
  compact: false,
  ariaLabel: undefined,
});
</script>

<template>
  <article
    class="card-frame"
    :class="{'card-frame--compact': compact}"
    :data-deck="deck"
    :aria-label="ariaLabel"
  >
    <header v-if="$slots.header" class="card-frame__header">
      <slot name="header" />
    </header>
    <div class="card-frame__art">
      <slot name="art">
        <CardArtPlaceholder label="Иллюстрация карты пока не создана" />
      </slot>
    </div>
    <div class="card-frame__content">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="card-frame__footer">
      <slot name="footer" />
    </footer>
  </article>
</template>

<style scoped lang="scss">
@use "../../../assets/scss/api" as api;

.card-frame {
  --card-accent: var(--color-border-card);
  --card-accent-deep: #6d4d43;
  position: relative;
  isolation: isolate;
  min-width: 0;
  width: min(240px, 100%);
  min-height: 400px;
  display: grid;
  grid-template-rows: auto minmax(160px, 1fr) auto auto;
  gap: var(--space-2);
  overflow: hidden;
  border: 1px solid var(--card-accent);
  border-radius: var(--radius-card);
  padding: var(--space-3);
  color: var(--color-text);
  background: var(--color-surface);
  box-shadow: 0 3px 12px rgb(46 43 41 / 10%);
}

.card-frame::before {
  content: "";
  position: absolute;
  z-index: -1;
  inset: 0;
  background:
    linear-gradient(145deg, transparent 0 48%, var(--card-accent) 48.5% 49%, transparent 49.5%),
    linear-gradient(35deg, transparent 0 64%, var(--card-accent) 64.5% 65%, transparent 65.5%);
  opacity: .08;
  pointer-events: none;
}

.card-frame[data-deck="door"] {
  --card-accent: var(--color-border-card);
  --card-accent-deep: #6d4d43;
}

.card-frame[data-deck="treasure"] {
  --card-accent: var(--color-action-response);
  --card-accent-deep: #874d33;
}

.card-frame__header,
.card-frame__content,
.card-frame__footer {
  min-width: 0;
}

.card-frame__art {
  min-width: 0;
  min-height: 0;
  aspect-ratio: 2 / 2.35;
  overflow: hidden;
  border: 1px solid var(--card-accent);
  background: #e6d8c7;
}

.card-frame__footer {
  border-top: 1px solid color-mix(in srgb, var(--card-accent), transparent 40%);
  padding-top: var(--space-2);
}

.card-frame--compact {
  flex: 0 0 178px;
  width: 178px;
  min-height: 272px;
  grid-template-rows: auto 112px auto auto;
  gap: var(--space-1);
  padding: var(--space-2);
}

.card-frame--compact .card-frame__art {
  aspect-ratio: auto;
}

@include api.reduced-motion {
  .card-frame {
    scroll-behavior: auto;
  }
}
</style>
