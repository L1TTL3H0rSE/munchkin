<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";

withDefaults(defineProps<{
  card: CardView;
  contentSetId: string;
  compact?: boolean;
}>(), {
  compact: false,
});

const api = useGameApi();
</script>

<template>
  <article
    class="game-card"
    :class="[`game-card--${card.deck}`, {'game-card--compact': compact}]"
  >
    <small>{{ card.kind.replaceAll("_", " ") }}</small>
    <img
      v-if="card.image"
      class="card-image"
      :src="api.contentAssetURL(contentSetId, card.image)"
      :alt="card.alt_text || card.name"
    >
    <div class="card-copy">
      <strong>{{ card.name }}</strong>
      <div class="card-stats">
        <span v-if="card.combat_strength">Сила {{ card.combat_strength }}</span>
        <span v-if="card.treasure_count">Сокровища {{ card.treasure_count }}</span>
        <span v-if="card.bonus">Бонус +{{ card.bonus }}</span>
        <span v-if="card.value !== undefined">{{ card.value }} голдов</span>
      </div>
      <p v-if="card.rules_text" class="card-rules">{{ card.rules_text }}</p>
      <p v-if="card.flavor_text && !compact" class="card-flavor">
        {{ card.flavor_text }}
      </p>
    </div>
  </article>
</template>
