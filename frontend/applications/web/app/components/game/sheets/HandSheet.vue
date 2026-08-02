<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";

import CardDetailSheet from "./CardDetailSheet.vue";
import SheetDialog from "./SheetDialog.vue";

defineProps<{
  cards: CardView[];
}>();
</script>

<template>
  <SheetDialog
    title="Рука"
    :trigger-label="`Открыть руку · ${cards.length}`"
    dialog-id="game-hand-sheet"
  >
    <p class="hand-sheet__summary" role="status">
      Карт в руке: <strong>{{ cards.length }}</strong>. Выберите карту, чтобы открыть полную информацию.
    </p>
    <ul class="hand-sheet__cards">
      <li v-for="(card, index) in cards" :key="card.instance_id">
        <strong>{{ card.name }}</strong>
        <CardDetailSheet :card="card" :dialog-id="`game-card-sheet-${index}`" />
      </li>
    </ul>
    <p v-if="!cards.length" class="hand-sheet__empty">В руке сейчас нет карт.</p>
  </SheetDialog>
</template>

<style scoped>
.hand-sheet__summary,
.hand-sheet__empty {
  margin: 0;
  color: var(--color-text-muted, #9eaa8e);
  line-height: 1.45;
}

.hand-sheet__cards {
  display: grid;
  gap: .6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hand-sheet__cards li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: .7rem;
  min-width: 0;
  border: 1px solid var(--color-line, #566044);
  padding: .65rem;
}

.hand-sheet__cards strong {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
