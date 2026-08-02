<script setup lang="ts">
import type {CardView, Projection} from "@munchkin/contracts";
import type {
  CardActionBinding,
  CardActionState,
} from "../actionModel";
import GameCard from "../GameCard.vue";
import SheetDialog from "../ui/SheetDialog.vue";
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

const open = ref(false);
const zones = computed(() => buildOwnZones(props.projection));
const carriedCards = computed(() => ownCarriedCards(props.projection));
const ownZones = computed<Array<{key: string; title: string; cards: CardView[]}>>(() => [
  {key: "hand", title: "Рука", cards: props.projection.you.hand},
  {key: "equipped", title: "Экипировано", cards: zones.value.equipped},
  {key: "carried", title: "Несёшь и черты", cards: carriedCards.value},
]);
const totalCards = computed(() => ownZones.value.reduce((total, zone) => total + zone.cards.length, 0));

function activate(binding: CardActionBinding) {
  open.value = false;
  emit("activate", binding);
}
</script>

<template>
  <section class="own-board" aria-labelledby="own-board-title">
    <header class="own-board__header">
      <div>
        <p class="eyebrow">ТВОЯ СТОРОНА</p>
        <h2 id="own-board-title">{{ projection.you.name }}</h2>
      </div>
      <button
        class="own-board__open"
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="open"
        @click="open = true"
      >
        Открыть персонажа
      </button>
    </header>

    <div class="own-board__stats" aria-label="Сводка персонажа">
      <span>Уровень {{ projection.you.level }}</span>
      <strong>Сила {{ projection.you.combat_strength }}</strong>
      <span>Побег {{ projection.you.escape_bonus >= 0 ? "+" : "" }}{{ projection.you.escape_bonus }}</span>
      <span>Рука {{ projection.you.hand.length }}/{{ projection.you.hand_limit }}</span>
    </div>

    <div class="own-board__zones" aria-label="Количество собственных зон">
      <span>Карты · {{ totalCards }}</span>
      <span>Экипировано · {{ zones.equipped.length }}</span>
      <span>Черты · {{ zones.traits.length }}</span>
    </div>

    <SheetDialog
      :open="open"
      title="Персонаж и собственные карты"
      description="Карты доступны по запросу; действие всегда строится из текущей server projection."
      v-bind="{titleID: 'own-board-sheet-title'}"
      @close="open = false"
    >
      <div class="own-board__sheet-grid">
        <section
          v-for="zone in ownZones"
          :key="zone.key"
          class="own-board__sheet-zone"
          :aria-labelledby="`own-zone-${zone.key}`"
        >
          <header>
            <h3 :id="`own-zone-${zone.key}`">{{ zone.title }} · {{ zone.cards.length }}</h3>
          </header>
          <div v-if="zone.cards.length" class="own-board__cards" role="list">
            <GameCard
              v-for="card in zone.cards"
              :key="`${zone.key}-${card.instance_id}`"
              :card="card"
              :content-set-id="projection.content_set_id"
              compact
              :action-bindings="bindingsForCard(card.instance_id)"
              :action-state="stateForCard(card.instance_id)"
              :motion-state="confirmedCardIds.has(card.instance_id) ? 'confirmed' : undefined"
              role="listitem"
              @activate="activate"
            />
          </div>
          <p v-else class="own-board__empty" role="status">Пусто.</p>
        </section>
      </div>
    </SheetDialog>
  </section>
</template>

<style scoped lang="scss">
.own-board {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  padding: var(--space-3);
  background: var(--color-paper);
}

.own-board__header {
  min-width: 0;
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-2);
}

.own-board__header h2,
.own-board__header p {
  margin: 0;
}

.own-board__header h2 {
  margin-top: var(--space-1);
  overflow-wrap: anywhere;
  font-size: 1.15rem;
}

.own-board__open {
  min-height: 2.75rem;
  flex: 0 0 auto;
  border: 1px solid var(--color-accent-strong);
  border-radius: var(--radius-control);
  padding: .5rem .7rem;
  color: var(--color-paper);
  background: var(--color-accent-strong);
  font: inherit;
  font-size: .72rem;
  font-weight: 800;
  cursor: pointer;
}

.own-board__open:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.own-board__stats,
.own-board__zones {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.own-board__stats span,
.own-board__stats strong,
.own-board__zones span {
  border: 1px solid var(--color-line);
  padding: .35rem .45rem;
  font-size: .68rem;
}

.own-board__stats strong {
  border-color: var(--color-accent-strong);
  color: var(--color-accent-strong);
}

.own-board__zones {
  color: var(--color-text-muted);
}

.own-board__sheet-grid {
  display: grid;
  gap: var(--space-4);
}

.own-board__sheet-zone {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}

.own-board__sheet-zone header {
  border-bottom: 1px solid var(--color-line);
  padding-bottom: var(--space-2);
}

.own-board__sheet-zone h3 {
  margin: 0;
  font-size: 1rem;
}

.own-board__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-3);
}

.own-board__empty {
  margin: 0;
  color: var(--color-text-muted);
}

@media (width <= 767px) {
  .own-board__header {
    flex-direction: column;
  }

  .own-board__open {
    width: 100%;
  }
}

@media (forced-colors: active) {
  .own-board,
  .own-board__open,
  .own-board__stats span,
  .own-board__stats strong,
  .own-board__zones span {
    border-color: CanvasText;
  }
}
</style>
