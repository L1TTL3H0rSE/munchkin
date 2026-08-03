<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";

import GameCard from "../../GameCard.vue";
import CardRail from "../primitives/CardRail.vue";
import type {GamePresentationModel} from "../gamePresentationModel";

const props = defineProps<{
  projection: Projection;
  presentationModel: GamePresentationModel;
}>();

const encounterCards = computed(() => props.presentationModel.encounterCards);
const selectedCardIndex = computed(() => props.presentationModel.activeEncounterIndex);
const stateFamily = computed(() => props.presentationModel.family);
const primarySurface = computed(() => props.presentationModel.primary);
const preparationCards = computed(() => [
  ...props.projection.you.carried,
  ...props.projection.you.equipped,
  ...props.projection.you.hand,
].slice(0, 3));

</script>

<template>
  <section
    class="mobile-encounter-stage"
    :data-primary-surface="primarySurface.kind"
    :data-state-family="stateFamily"
    aria-label="Карты встречи"
  >
    <CardRail
      v-if="encounterCards.length && ['combat', 'waiting', 'run-away', 'result'].includes(primarySurface.kind)"
      data-figma-node="101:106"
      title="Карты текущего решения"
      :item-count="encounterCards.length"
      :show-heading="false"
    >
      <div
        v-for="(card, index) in encounterCards"
        :key="card.instance_id"
        class="mobile-encounter-card"
        :class="{
          'mobile-encounter-card--selected': index === selectedCardIndex,
          'mobile-encounter-card--previous': index < selectedCardIndex,
          'mobile-encounter-card--next': index > selectedCardIndex,
        }"
        role="listitem"
      >
        <div class="mobile-encounter-card__trigger">
          <GameCard
            :card="card"
            :content-set-id="projection.content_set_id"
            compact
            :encounter="index === selectedCardIndex"
            :encounter-peek-side="index < selectedCardIndex ? 'previous' : index > selectedCardIndex ? 'next' : undefined"
          />
        </div>
      </div>
    </CardRail>

    <section
      v-else-if="primarySurface.kind === 'phase' && ['setup', 'preparation'].includes(primarySurface.family)"
      class="mobile-preparation"
      aria-label="Подготовка персонажа"
    >
      <header><h2>Подготовка персонажа</h2><p>Выбери карты перед открытием двери.</p></header>
      <div class="mobile-preparation__cards" role="list">
        <GameCard
          v-for="card in preparationCards"
          :key="`mobile-preparation-${card.instance_id}`"
          :card="card"
          :content-set-id="projection.content_set_id"
          choice
          role="listitem"
        />
      </div>
      <small>ЭКИПИРУЙ ИЛИ ОСТАВЬ В РУКЕ</small>
    </section>

    <section
      v-if="primarySurface.kind === 'required-decision' && projection.turn.pending_decision"
      class="mobile-decision-summary"
      aria-label="Ожидающее решение"
    >
      <strong>Нужно подтверждённое решение</strong>
      <span>Вариантов в текущей проекции: {{ projection.turn.pending_decision.options.length }}</span>
    </section>

    <CardRail
      v-if="primarySurface.kind === 'resolving'"
      title="Разрешение"
      :item-count="projection.turn.resolving.length"
    >
      <GameCard
        v-for="card in projection.turn.resolving"
        :key="`resolving-${card.instance_id}`"
        :card="card"
        :content-set-id="projection.content_set_id"
        compact
        role="listitem"
      />
    </CardRail>

  </section>

</template>

<style scoped lang="scss">
.mobile-encounter-stage {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space-2);
}

.mobile-preparation {
  height: 416px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 14px;
  box-sizing: border-box;
  padding: 16px;
}
.mobile-preparation header h2,
.mobile-preparation header p { margin: 0; }
.mobile-preparation header h2 { font-size: 18px; line-height: 24px; }
.mobile-preparation header p { margin-top: 6px; color: var(--color-text-secondary); font-size: 11px; }
.mobile-preparation__cards {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}
.mobile-preparation small { color: var(--color-text-muted); font-size: 9px; letter-spacing: .05em; }

.mobile-encounter-stage__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.mobile-encounter-stage__eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-family: var(--font-meta);
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.mobile-encounter-stage h2 {
  margin: .2rem 0 0;
  font-size: 1rem;
}

.mobile-encounter-stage__empty {
  display: grid;
  gap: var(--space-2);
  min-height: 5rem;
  align-content: center;
  border: 1px dashed var(--color-line);
  padding: var(--space-3);
}

.mobile-encounter-stage__empty--door {
  align-content: start;
  justify-items: center;
  gap: var(--space-3);
  text-align: center;
}

.mobile-encounter-stage__empty--door > div {
  display: grid;
  gap: var(--space-1);
  justify-items: center;
}

.mobile-encounter-stage__empty--door strong {
  font-size: .92rem;
}

.mobile-encounter-stage__empty--door :deep(.deck-back) {
  width: 7rem;
}

.mobile-encounter-stage__empty p,
.mobile-combat-summary__result,
.mobile-run-away p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: .72rem;
  line-height: 1.35;
}

.mobile-encounter-card {
  flex: 0 0 178px;
  min-width: 0;
  scroll-snap-align: start;
}

.mobile-encounter-card__trigger {
  display: block;
  width: 178px;
  min-height: 0;
  border: 0;
  border-radius: var(--radius-card);
  padding: 0;
  color: inherit;
  background: transparent;
  text-align: start;
}

.mobile-encounter-card__trigger:disabled {
  cursor: default;
  opacity: 1;
}

.mobile-encounter-card__trigger:not(:disabled) {
  cursor: pointer;
}

.mobile-encounter-card__level {
  position: absolute;
  z-index: 2;
  top: .75rem;
  left: .75rem;
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  border: 3px solid var(--color-border-card);
  border-radius: 50%;
  color: var(--color-action-response);
  background: var(--color-surface);
  font-size: 1.25rem;
  font-weight: 800;
}

.mobile-combat-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-control);
  padding: var(--space-2);
  background: var(--color-paper);
}

.mobile-combat-summary__numbers {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.mobile-combat-summary__versus {
  color: var(--color-text-muted);
  font-family: var(--font-meta);
  font-size: .7rem;
}

.mobile-combat-summary__details {
  min-height: 2.5rem;
  border: 1px solid var(--color-line);
  padding: .35rem .55rem;
  color: var(--color-text);
  background: transparent;
  font-size: .68rem;
}

.mobile-combat-summary__result {
  grid-column: 1 / -1;
  color: var(--color-accent-strong);
  font-weight: 700;
}

.mobile-run-away,
.mobile-decision-summary {
  display: grid;
  gap: var(--space-1);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-control);
  padding: var(--space-2);
  background: var(--color-paper);
}

.mobile-decision-summary span {
  color: var(--color-text-muted);
  font-size: .72rem;
}

.mobile-strength-details {
  display: grid;
  gap: var(--space-4);
}

.mobile-strength-details section {
  display: grid;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-line);
  padding-bottom: var(--space-3);
}

.mobile-strength-details h3 {
  margin: 0;
  font-size: 1rem;
}

.mobile-strength-details ul {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.mobile-strength-details li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--color-text-muted);
  font-size: .78rem;
}

.mobile-strength-details li strong {
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

@media (width <= 374px) {
  .mobile-combat-summary__numbers {
    gap: var(--space-1);
  }

  .mobile-combat-summary__details {
    padding-inline: .4rem;
  }
}
</style>
