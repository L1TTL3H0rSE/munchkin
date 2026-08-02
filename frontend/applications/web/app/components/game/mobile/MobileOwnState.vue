<script setup lang="ts">
import type {CardView, Projection} from "@munchkin/contracts";

import type {
  CardActionBinding,
  CardActionState,
} from "../../actionModel";
import GameCard from "../../GameCard.vue";
import SheetDialog from "../../ui/SheetDialog.vue";
import HandTab from "../primitives/HandTab.vue";
import {uniqueCards} from "../gameTableViewModel";

const props = defineProps<{
  projection: Projection;
  showHand: boolean;
  hasInteraction: boolean;
  hasActionableDeadline: boolean;
  bindingsForCard: (cardID: string) => CardActionBinding[];
  stateForCard: (cardID: string) => CardActionState;
  confirmedCardIds: ReadonlySet<string>;
}>();

const handOpen = ref(false);
const zonesOpen = ref(false);

const publicCards = computed<CardView[]>(() => uniqueCards([
  ...props.projection.you.equipped,
  ...props.projection.you.carried,
  ...props.projection.you.traits,
  ...props.projection.you.attachments,
  ...props.projection.you.persistent_curses,
]));

function closeHand() {
  handOpen.value = false;
  void nextTick(() => {
    document.querySelector<HTMLElement>(".mobile-game-table .hand-tab")?.focus();
  });
}

function closeZones() {
  zonesOpen.value = false;
}

function activate(binding: CardActionBinding) {
  // The parent owns the server action and selection state; the sheet only forwards the binding.
  emit("activate", binding);
}

const emit = defineEmits<{
  activate: [binding: CardActionBinding];
}>();
</script>

<template>
  <section class="mobile-own-state" aria-labelledby="mobile-own-state-title">
    <div class="mobile-own-state__summary">
      <div>
        <p class="mobile-own-state__eyebrow">ТВОЯ ЗОНА</p>
        <h2 id="mobile-own-state-title">
          {{ projection.you.name }} · уровень {{ projection.you.level }}
        </h2>
      </div>
      <div class="mobile-own-state__counts" aria-label="Сводка собственных зон">
        <span>рука {{ projection.you.hand.length }}</span>
        <span>открыто {{ publicCards.length }}</span>
      </div>
    </div>

    <div class="mobile-own-state__controls">
      <button
        v-if="publicCards.length"
        class="mobile-own-state__zones"
        type="button"
        :aria-expanded="zonesOpen"
        @click="zonesOpen = true"
      >
        Открытые зоны
      </button>
      <HandTab
        v-if="showHand"
        :count="projection.you.hand.length"
        :has-actionable-deadline="hasActionableDeadline"
        :deadline-at="projection.interaction?.deadline_at"
        :server-time="projection.interaction?.server_time"
        :has-interaction="hasInteraction"
        @open="handOpen = true"
      />
    </div>
  </section>

  <SheetDialog
    :open="handOpen"
    :title="`Рука · ${projection.you.hand.length}`"
    title-id="mobile-hand-sheet-title"
    description="Полный actor-visible список карт и доступные для них действия."
    @close="closeHand"
  >
    <div class="mobile-hand-sheet__grid" role="list">
      <GameCard
        v-for="card in projection.you.hand"
        :key="`mobile-hand-${card.instance_id}`"
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
  </SheetDialog>

  <SheetDialog
    :open="zonesOpen"
    title="Открытые зоны"
    title-id="mobile-own-zones-title"
    description="Эти карты уже видны текущему игроку; скрытая рука остаётся в отдельной вкладке."
    @close="closeZones"
  >
    <div class="mobile-own-sheet__grid" role="list">
      <GameCard
        v-for="card in publicCards"
        :key="`mobile-zone-${card.instance_id}`"
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
  </SheetDialog>
</template>

<style scoped lang="scss">
.mobile-own-state {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}

.mobile-own-state__summary,
.mobile-own-state__controls {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.mobile-own-state__eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-family: var(--font-meta);
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.mobile-own-state h2 {
  margin: .2rem 0 0;
  overflow-wrap: anywhere;
  font-size: .85rem;
}

.mobile-own-state__counts {
  display: grid;
  justify-items: end;
  gap: 2px;
  flex: 0 0 auto;
  color: var(--color-text-muted);
  font-family: var(--font-meta);
  font-size: .6rem;
}

.mobile-own-state__controls {
  justify-content: end;
  align-items: stretch;
}

.mobile-own-state__zones {
  min-height: 2.75rem;
  border: 1px solid var(--color-line);
  padding: .35rem .6rem;
  color: var(--color-text);
  background: transparent;
  font-size: .7rem;
}

.mobile-own-state__controls :deep(.hand-tab) {
  flex: 1 1 auto;
  min-width: 0;
  border-radius: var(--radius-control);
}

.mobile-hand-sheet__grid,
.mobile-own-sheet__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(178px, 1fr));
  justify-content: center;
  gap: var(--space-3);
}

@media (width <= 374px) {
  .mobile-own-state__summary {
    align-items: start;
  }

  .mobile-own-state__counts {
    font-size: .56rem;
  }

  .mobile-own-state__controls :deep(.hand-tab) {
    min-width: 0;
  }
}
</style>
