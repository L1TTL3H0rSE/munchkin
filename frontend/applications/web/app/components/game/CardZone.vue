<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";
import type {
  CardActionBinding,
  CardActionState,
} from "../actionModel";
import CardRail from "./primitives/CardRail.vue";

withDefaults(defineProps<{
  title: string;
  cards: CardView[];
  contentSetId: string;
  emptyCopy?: string;
  compact?: boolean;
  showMeta?: boolean;
  bindingsForCard?: (cardID: string) => CardActionBinding[];
  stateForCard?: (cardID: string) => CardActionState;
  confirmedCardIds?: ReadonlySet<string>;
}>(), {
  emptyCopy: "Пока ничего.",
  compact: true,
  showMeta: false,
  bindingsForCard: () => [],
  stateForCard: () => "idle" as CardActionState,
  confirmedCardIds: () => new Set<string>(),
});

const emit = defineEmits<{
  activate: [binding: CardActionBinding];
}>();
</script>

<template>
  <CardRail
    :title="title"
    :item-count="cards.length"
    :empty-copy="emptyCopy"
  >
    <GameCard
      v-for="card in cards"
      :key="card.instance_id"
      :card="card"
      :content-set-id="contentSetId"
      :compact="compact"
      :show-meta="showMeta"
      :action-bindings="bindingsForCard(card.instance_id)"
      :action-state="stateForCard(card.instance_id)"
      :motion-state="confirmedCardIds.has(card.instance_id) ? 'confirmed' : undefined"
      role="listitem"
      @activate="emit('activate', $event)"
    />
  </CardRail>
</template>
