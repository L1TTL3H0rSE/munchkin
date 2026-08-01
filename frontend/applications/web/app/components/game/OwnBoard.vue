<script setup lang="ts">
import type {CardView, Projection} from "@munchkin/contracts";
import type {
  CardActionBinding,
  CardActionState,
} from "../actionModel";
import CardZone from "./CardZone.vue";
import HandBrowser from "./HandBrowser.vue";
import {buildOwnZones, ownCarriedCards} from "./gameTableViewModel";

const props = defineProps<{
  projection: Projection;
  bindingsForCard: (cardID: string) => CardActionBinding[];
  stateForCard: (cardID: string) => CardActionState;
  confirmedCardIds: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  activate: [binding: CardActionBinding];
}>();

const zones = computed(() => buildOwnZones(props.projection));
const carriedCards = computed(() => ownCarriedCards(props.projection));
const allOwnCards = computed<CardView[]>(() => [
  ...props.projection.you.hand,
  ...carriedCards.value,
  ...zones.value.equipped,
]);
</script>

<template>
  <section class="own-board" aria-labelledby="own-board-title">
    <div class="character-summary">
      <div>
        <p class="eyebrow">ТВОЙ ПЕРСОНАЖ — {{ projection.you.name }}</p>
        <h2 id="own-board-title">Уровень {{ projection.you.level }}</h2>
      </div>
      <div class="character-stats" aria-label="Характеристики персонажа">
        <span>Сила {{ projection.you.combat_strength }}</span>
        <span>Побег {{ projection.you.escape_bonus >= 0 ? "+" : "" }}{{ projection.you.escape_bonus }}</span>
        <span>Лимит руки {{ projection.you.hand_limit }}</span>
      </div>
      <div v-if="projection.you.character_tags.length" class="tag-list" aria-label="Черты персонажа">
        <span v-for="tag in projection.you.character_tags" :key="tag">{{ tag }}</span>
      </div>
    </div>

    <CardZone
      title="Экипировано"
      :cards="zones.equipped"
      :content-set-id="projection.content_set_id"
      :bindings-for-card="bindingsForCard"
      :state-for-card="stateForCard"
      :confirmed-card-ids="confirmedCardIds"
      @activate="emit('activate', $event)"
    />

    <CardZone
      title="Несёшь и черты"
      :cards="carriedCards"
      :content-set-id="projection.content_set_id"
      :bindings-for-card="bindingsForCard"
      :state-for-card="stateForCard"
      :confirmed-card-ids="confirmedCardIds"
      @activate="emit('activate', $event)"
    />

    <HandBrowser
      :cards="projection.you.hand"
      :content-set-id="projection.content_set_id"
      :bindings-for-card="bindingsForCard"
      :state-for-card="stateForCard"
      :confirmed-card-ids="confirmedCardIds"
      @activate="emit('activate', $event)"
    />

    <p class="own-board__card-count" aria-live="polite">
      Всего открыто собственных карт: {{ allOwnCards.length }}
    </p>
  </section>
</template>

<style scoped>
.own-board {
  min-width: 0;
  margin-top: 2rem;
  border-top: 3px solid var(--acid);
  padding-top: 1rem;
}

.character-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.character-summary h2 { margin: .35rem 0 0; }

.character-stats,
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
}

.character-stats span,
.tag-list span {
  border: 1px solid var(--line);
  padding: .45rem .65rem;
  font-size: .75rem;
}

.own-board__card-count {
  margin: .5rem 0 0;
  color: var(--muted);
  font-size: .75rem;
}
</style>
