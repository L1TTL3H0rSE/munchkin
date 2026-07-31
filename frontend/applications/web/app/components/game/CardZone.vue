<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";
import type {
  CardActionBinding,
  CardActionState,
} from "../actionModel";

withDefaults(defineProps<{
  title: string;
  cards: CardView[];
  contentSetId: string;
  emptyCopy?: string;
  compact?: boolean;
  bindingsForCard?: (cardID: string) => CardActionBinding[];
  stateForCard?: (cardID: string) => CardActionState;
  confirmedCardIds?: ReadonlySet<string>;
}>(), {
  emptyCopy: "Пока ничего.",
  compact: true,
  bindingsForCard: () => [],
  stateForCard: () => "idle" as CardActionState,
  confirmedCardIds: () => new Set<string>(),
});

const emit = defineEmits<{
  activate: [binding: CardActionBinding];
}>();
</script>

<template>
  <section class="card-zone" :aria-label="title">
    <h3>{{ title }}</h3>
    <div
      class="card-zone__rail"
      :role="cards.length ? 'list' : undefined"
      :tabindex="cards.length ? 0 : undefined"
    >
      <GameCard
        v-for="card in cards"
        :key="card.instance_id"
        :card="card"
        :content-set-id="contentSetId"
        :compact="compact"
        :action-bindings="bindingsForCard(card.instance_id)"
        :action-state="stateForCard(card.instance_id)"
        :motion-state="confirmedCardIds.has(card.instance_id) ? 'confirmed' : undefined"
        role="listitem"
        @activate="emit('activate', $event)"
      />
      <p v-if="!cards.length" class="card-zone__empty">{{ emptyCopy }}</p>
    </div>
  </section>
</template>

<style scoped>
.card-zone {
  min-width: 0;
}

.card-zone h3 {
  margin: 1.25rem 0 0;
}

.card-zone__rail {
  display: flex;
  gap: .75rem;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  padding: 1rem .15rem;
  scrollbar-gutter: stable;
}

.card-zone__empty {
  margin: 1rem 0;
  color: var(--muted);
}
</style>
