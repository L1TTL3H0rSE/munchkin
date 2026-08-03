<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";

import GameCard from "../../GameCard.vue";
import DeckBack from "../primitives/DeckBack.vue";
import CardRail from "../primitives/CardRail.vue";
import PhaseLabel from "../../ui/PhaseLabel.vue";
import SheetDialog from "../../ui/SheetDialog.vue";
import StrengthIndicator from "../../ui/StrengthIndicator.vue";
import {buildStrengthBreakdown} from "../gameTableViewModel";
import {useGamePresentation} from "../../../composables/useGamePresentation";
import {mobileEncounterCards, mobileStateFamily} from "./mobileGameModel";

const props = defineProps<{
  projection: Projection;
}>();

const presentation = useGamePresentation(() => props.projection);
const strengthOpen = ref(false);

const encounterCards = computed(() => mobileEncounterCards(props.projection));
const selectedCardIndex = computed(() => encounterCards.value.length > 1 ? 1 : 0);
const combat = computed(() => props.projection.turn.combat);
const runAway = computed(() => props.projection.turn.run_away);
const stateFamily = computed(() => mobileStateFamily(props.projection));
const encounterStage = ref<HTMLElement>();

const monsterBreakdown = computed(() => buildStrengthBreakdown(
  combat.value?.monster_strength ?? 0,
  encounterCards.value.map((card) => ({
    id: card.instance_id,
    label: card.name,
    value: card.combat_strength ?? 0,
  })),
));

const playerBreakdown = computed(() => buildStrengthBreakdown(
  combat.value?.player_strength ?? props.projection.you.combat_strength,
  [{
    id: "authoritative-player-strength",
    label: "Подтверждённая сила игрока",
    value: combat.value?.player_strength ?? props.projection.you.combat_strength,
  }],
));

const runAwayPlayerName = computed(() => {
  const playerID = runAway.value?.current_player_id;
  if (!playerID) {
    return "текущего игрока";
  }
  if (playerID === props.projection.you.player_id) {
    return props.projection.you.name;
  }
  return props.projection.players.find((player) => player.player_id === playerID)?.name
    ?? "другого игрока";
});

const runAwayMonsterName = computed(() => {
  const cardID = runAway.value?.current_monster_instance_id;
  return encounterCards.value.find((card) => card.instance_id === cardID)?.name
    ?? "текущей карты";
});

const phaseCopy = computed(() => {
  const current = presentation.value;
  if (!current) {
    return "Ждём подтверждённую проекцию.";
  }
  if (current.phase.kind === "waiting") {
    return `Сейчас ходит ${current.currentPlayerName}. Легальные действия появятся из новой проекции.`;
  }
  if (current.phase.kind === "lobby") {
    return "Комната готовит переход к игре.";
  }
  if (current.phase.kind === "finished") {
    return "Итог игры подтверждён сервером.";
  }
  return "Текущий контекст и доступные действия подтверждены сервером.";
});

function closeStrength() {
  strengthOpen.value = false;
}

function openStrengthFromCard() {
  if (combat.value) {
    strengthOpen.value = true;
  }
}

function prepareCardScrollRegions() {
  void nextTick(() => {
    encounterStage.value?.querySelectorAll<HTMLElement>(
      ".mobile-encounter-card .card-frame__content",
    ).forEach((content) => {
      const card = content.closest<HTMLElement>(".game-card");
      const cardName = card?.getAttribute("aria-label") ?? "карты";
      content.tabIndex = 0;
      content.setAttribute("role", "region");
      content.setAttribute("aria-label", `Текст ${cardName}, прокручиваемая область`);
    });
  });
}

onMounted(prepareCardScrollRegions);
watch(encounterCards, prepareCardScrollRegions);
</script>

<template>
  <section
    ref="encounterStage"
    class="mobile-encounter-stage"
    :data-state-family="stateFamily"
    aria-labelledby="mobile-encounter-title"
  >
    <header class="mobile-encounter-stage__header">
      <div>
        <p class="mobile-encounter-stage__eyebrow">ТЕКУЩИЙ КОНТЕКСТ</p>
        <h2 id="mobile-encounter-title">
          {{ combat ? "Бой" : "Текущая задача" }}
        </h2>
      </div>
      <PhaseLabel :phase="projection.turn.phase" />
    </header>

    <section v-if="combat" class="mobile-combat-summary" aria-label="Подтверждённая сила боя">
      <div class="mobile-combat-summary__numbers">
        <StrengthIndicator
          :value="combat.player_strength"
          label="Твоя сила"
          compact
        />
        <span class="mobile-combat-summary__versus" aria-hidden="true">vs</span>
        <StrengthIndicator
          :value="combat.monster_strength"
          label="Сила встречи"
          compact
        />
        <span class="mobile-combat-summary__result" role="status">
          {{ combat.player_winning ? "Победа подтверждена" : "Бой не выигран" }}
        </span>
      </div>
      <button
        class="mobile-combat-summary__details"
        type="button"
        :aria-expanded="strengthOpen"
        @click="strengthOpen = true"
      >
        Разбор силы
      </button>
    </section>

    <CardRail
      v-if="encounterCards.length"
      data-node-id="101:46"
      title="Карты текущего решения"
      labelled-by="mobile-encounter-title"
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
        <div
          class="mobile-encounter-card__trigger"
          :role="combat ? 'group' : undefined"
          :tabindex="combat ? 0 : undefined"
          :aria-label="combat ? `Открыть разбор силы: ${card.name}` : undefined"
          @click="openStrengthFromCard"
          @keydown.enter.prevent="openStrengthFromCard"
          @keydown.space.prevent="openStrengthFromCard"
        >
          <GameCard
            :card="card"
            :content-set-id="projection.content_set_id"
            compact
          />
          <span
            v-if="card.combat_strength !== undefined"
            class="mobile-encounter-card__level"
            aria-hidden="true"
          >
            {{ card.combat_strength }}
          </span>
        </div>
      </div>
    </CardRail>

    <div
      v-else
      class="mobile-encounter-stage__empty"
      :class="{'mobile-encounter-stage__empty--door': stateFamily === 'door-choice'}"
    >
      <template v-if="stateFamily === 'door-choice'">
        <div>
          <p class="mobile-encounter-stage__eyebrow">ДВЕРЬ</p>
          <strong>Открой верхнюю карту двери.</strong>
          <p>Вышиби дверь, чтобы продолжить подтверждённый ход.</p>
        </div>
        <DeckBack deck="door" label="Закрытая карта двери" />
      </template>
      <template v-else>
        <PhaseLabel :phase="projection.turn.phase" />
        <p>{{ phaseCopy }}</p>
      </template>
    </div>

    <section v-if="runAway" class="mobile-run-away" aria-label="Прогресс побега">
      <div>
        <p class="mobile-encounter-stage__eyebrow">ПОБЕГ</p>
        <strong>{{ runAway.completed ? "Шаги завершены сервером" : "Текущий шаг" }}</strong>
      </div>
      <p>
        {{ runAwayPlayerName }} · от карты «{{ runAwayMonsterName }}» · попыток:
        {{ runAway.attempts.length }}
      </p>
    </section>

    <section
      v-if="projection.turn.pending_decision"
      class="mobile-decision-summary"
      aria-label="Ожидающее решение"
    >
      <strong>Нужно подтверждённое решение</strong>
      <span>Вариантов в текущей проекции: {{ projection.turn.pending_decision.options.length }}</span>
    </section>

    <CardRail
      v-if="projection.turn.resolving.length"
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

  <SheetDialog
    :open="strengthOpen"
    title="Разбор подтверждённой силы"
    title-id="mobile-strength-details-title"
    description="Итоговые числа пришли из actor-specific projection; остаток не приписывается локальному правилу."
    @close="closeStrength"
  >
    <div class="mobile-strength-details">
      <section aria-labelledby="mobile-player-strength-title">
        <h3 id="mobile-player-strength-title">Игрок</h3>
        <StrengthIndicator
          :value="combat?.player_strength ?? projection.you.combat_strength"
          label="Итог"
        />
        <ul>
          <li v-for="contributor in playerBreakdown" :key="contributor.id">
            <span>{{ contributor.label }}</span>
            <strong>{{ contributor.value >= 0 ? "+" : "" }}{{ contributor.value }}</strong>
          </li>
        </ul>
      </section>
      <section aria-labelledby="mobile-monster-strength-title">
        <h3 id="mobile-monster-strength-title">Встреча</h3>
        <StrengthIndicator
          :value="combat?.monster_strength ?? 0"
          label="Итог"
        />
        <ul>
          <li v-for="contributor in monsterBreakdown" :key="contributor.id">
            <span>{{ contributor.label }}</span>
            <strong>{{ contributor.value >= 0 ? "+" : "" }}{{ contributor.value }}</strong>
          </li>
        </ul>
      </section>
    </div>
    <template #footer>
      <button type="button" @click="strengthOpen = false">Готово</button>
    </template>
  </SheetDialog>
</template>

<style scoped lang="scss">
.mobile-encounter-stage {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space-2);
}

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
