<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";

withDefaults(defineProps<{
  deck: CardView["deck"];
  label?: string;
}>(), {
  label: "Закрытая карта",
});
</script>

<template>
  <div
    class="deck-back"
    :class="`deck-back--${deck}`"
    role="img"
    :aria-label="label"
  >
    <svg viewBox="0 0 160 220" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="144" height="204" rx="5" />
      <path d="M26 110h108M80 30v160M38 58l84 104M122 58 38 162" />
      <circle cx="80" cy="110" r="30" />
      <path d="m80 88 8 14 16 3-12 11 3 16-15-8-15 8 3-16-12-11 16-3z" />
    </svg>
  </div>
</template>

<style scoped>
.deck-back {
  width: 8rem;
  aspect-ratio: 160 / 220;
  display: grid;
  place-items: center;
  border-radius: var(--radius-card);
  padding: .35rem;
  color: var(--color-paper);
  background: var(--color-board);
  box-shadow: 0 8px 18px rgb(31 52 42 / 18%);
}

.deck-back--door {
  color: #e4f0d3;
  background: var(--color-accent-strong);
}

.deck-back--treasure {
  color: #fff0d0;
  background: var(--color-rust);
}

.deck-back svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}
</style>
