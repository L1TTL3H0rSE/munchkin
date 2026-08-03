<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";
import doorBack from "~/assets/lobby/hero-door.png";
import treasureBack from "~/assets/lobby/hero-treasure.png";

const props = withDefaults(defineProps<{
  deck: CardView["deck"];
  label?: string;
}>(), {
  label: "Закрытая карта",
});

const imageSource = computed(() => props.deck === "door" ? doorBack : treasureBack);
</script>

<template>
  <div
    class="deck-back"
    :class="`deck-back--${deck}`"
    role="img"
    :aria-label="label"
  >
    <img :src="imageSource" alt="">
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

.deck-back img {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: calc(var(--radius-card) - .2rem);
  object-fit: cover;
}
</style>
