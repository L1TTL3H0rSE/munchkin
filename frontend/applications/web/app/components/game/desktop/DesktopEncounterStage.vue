<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import GameCard from "../../GameCard.vue";
import PhaseLabel from "../../ui/PhaseLabel.vue";
import StrengthIndicator from "../../ui/StrengthIndicator.vue";
import SheetDialog from "../../ui/SheetDialog.vue";
import CardRail from "../primitives/CardRail.vue";
import DeckBack from "../primitives/DeckBack.vue";
import RailPager from "../primitives/RailPager.vue";
import {desktopEncounterCards} from "./desktopGameModel";

const props = defineProps<{
  projection: Projection;
}>();

const activeCardIndex = ref(0);
const strengthOpen = ref(false);
const encounterStage = ref<HTMLElement>();
const encounterCards = computed(() => desktopEncounterCards(props.projection));
const combat = computed(() => props.projection.turn.combat);
const activeCard = computed(() => encounterCards.value[activeCardIndex.value]);
const currentPlayerName = computed(() => {
  if (props.projection.turn.player_id === props.projection.you.player_id) {
    return props.projection.you.name;
  }
  return props.projection.players.find((player) =>
    player.player_id === props.projection.turn.player_id,
  )?.name ?? "другой игрок";
});
const activeMonsterName = computed(() => {
  const instanceID = props.projection.turn.run_away?.current_monster_instance_id;
  return encounterCards.value.find((card) => card.instance_id === instanceID)?.name
    ?? activeCard.value?.name
    ?? "текущий монстр";
});
const strengthRows = computed(() => {
  if (!combat.value) {
    return [];
  }
  return [
    {label: "Сила игрока", value: combat.value.player_strength},
    {label: "Сила монстров", value: combat.value.monster_strength},
    ...combat.value.effects
      .filter((effect) => effect.active && effect.amount)
      .map((effect) => ({
        label: effect.kind === "enhance_monster" ? "Подтверждённое усиление" : "Эффект боя",
        value: effect.amount ?? 0,
      })),
  ];
});

watch(() => encounterCards.value.length, (length) => {
  activeCardIndex.value = Math.min(activeCardIndex.value, Math.max(0, length - 1));
}, {immediate: true});

function prepareCardScrollRegions() {
  void nextTick(() => {
    encounterStage.value?.querySelectorAll<HTMLElement>(
      ".desktop-encounter-card .card-frame__content",
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

function selectCard(index: number) {
  activeCardIndex.value = index;
  void nextTick(() => {
    document.querySelector<HTMLElement>(
      `.desktop-encounter-stage [data-card-index="${index}"]`,
    )?.scrollIntoView({behavior: "smooth", block: "nearest", inline: "center"});
  });
}
</script>

<template>
  <section
    ref="encounterStage"
    class="desktop-encounter-stage"
    aria-labelledby="desktop-encounter-title"
    :data-has-encounter="encounterCards.length > 0"
  >
    <header class="desktop-encounter-stage__heading">
      <div>
        <p class="eyebrow">ЦЕНТР СТОЛА</p>
        <h2 id="desktop-encounter-title">
          {{ encounterCards.length ? "Открытая встреча" : "Состояние стола" }}
        </h2>
      </div>
      <PhaseLabel :phase="projection.turn.phase" />
    </header>

    <div class="desktop-encounter-stage__board">
      <aside class="desktop-deck-rail" aria-label="Колоды и сбросы">
        <div class="desktop-deck">
          <DeckBack deck="door" label="Закрытая колода дверей" />
          <strong>{{ projection.door_deck_count }}</strong>
          <span>двери</span>
          <small>сброс {{ projection.door_discard_count }}</small>
        </div>
        <div class="desktop-deck">
          <DeckBack deck="treasure" label="Закрытая колода сокровищ" />
          <strong>{{ projection.treasure_deck_count }}</strong>
          <span>сокровища</span>
          <small>сброс {{ projection.treasure_discard_count }}</small>
        </div>
      </aside>

      <div class="desktop-encounter-stage__content">
        <CardRail
          v-if="encounterCards.length"
          title="Карты встречи"
          :item-count="encounterCards.length"
          :page-count="1"
          empty-copy="Нет открытых карт."
        >
          <div
            v-for="(card, index) in encounterCards"
            :key="card.instance_id"
            class="desktop-encounter-card"
            :class="{'desktop-encounter-card--active': index === activeCardIndex}"
            :data-card-index="index"
            role="listitem"
            :aria-label="`${index + 1}. ${card.name}`"
          >
            <span class="desktop-encounter-card__index">
              {{ index === 0 ? "Встреча" : `Монстр ${index + 1}` }}
            </span>
            <GameCard
              :card="card"
              :content-set-id="projection.content_set_id"
            />
          </div>
        </CardRail>
        <div v-else class="desktop-phase-card" role="status">
          <span class="desktop-phase-card__mark" aria-hidden="true">+</span>
          <PhaseLabel :phase="projection.turn.phase" />
          <strong>
            {{ projection.status === "finished" ? "Победа подтверждена" : "Ждём следующую карту" }}
          </strong>
          <p>
            {{ projection.turn.phase === "preparation"
              ? "Подготовь ход, затем выбери действие рядом с затронутой зоной."
              : "Серверная проекция определит следующую доступную фазу." }}
          </p>
        </div>

        <RailPager
          v-if="encounterCards.length > 1"
          :page="activeCardIndex"
          :page-count="encounterCards.length"
          label="Навигация по картам встречи"
          @select="selectCard"
        />

        <section v-if="combat" class="desktop-combat-summary" aria-label="Подтверждённый счёт боя">
          <div class="desktop-combat-summary__numbers">
            <StrengthIndicator label="Твоя сила" :value="combat.player_strength" />
            <span class="desktop-combat-summary__versus" aria-hidden="true">vs</span>
            <StrengthIndicator label="Сила монстров" :value="combat.monster_strength" />
          </div>
          <div class="desktop-combat-summary__result" role="status">
            {{ combat.combat_closed
              ? "Бой закрыт сервером"
              : combat.player_winning ? "Текущая проекция: победа" : "Текущая проекция: нужен ответ" }}
          </div>
          <button
            class="desktop-combat-summary__details"
            type="button"
            aria-haspopup="dialog"
            :aria-expanded="strengthOpen"
            @click="strengthOpen = true"
          >
            Разбор силы
          </button>
        </section>

        <section v-if="projection.turn.run_away" class="desktop-run-away" aria-label="Состояние побега">
          <div>
            <p class="eyebrow">ПОБЕГ</p>
            <strong>{{ currentPlayerName }} · {{ activeMonsterName }}</strong>
          </div>
          <span>{{ projection.turn.run_away.attempts.length }} подтверждённых шагов</span>
          <span>{{ projection.turn.run_away.completed ? "Последовательность завершена" : "Ожидаем server-owned шаг" }}</span>
        </section>

        <section v-if="projection.turn.pending_decision" class="desktop-pending-decision" aria-label="Ожидающее решение">
          <p class="eyebrow">ОЖИДАЮЩЕЕ РЕШЕНИЕ</p>
          <strong>Выбор из {{ projection.turn.pending_decision.options.length }} вариантов</strong>
          <span>Доступность и границы выбора пришли из server projection.</span>
        </section>

        <CardRail
          v-if="projection.turn.resolving.length"
          class="desktop-resolving-rail"
          title="Разрешаемые карты"
          :item-count="projection.turn.resolving.length"
        >
          <GameCard
            v-for="card in projection.turn.resolving"
            :key="card.instance_id"
            :card="card"
            :content-set-id="projection.content_set_id"
            compact
            role="listitem"
          />
        </CardRail>
      </div>
    </div>
  </section>

  <SheetDialog
    :open="strengthOpen"
    title="Разбор подтверждённой силы"
    description="Числа ниже показывают только server-projected totals и видимые эффекты."
      v-bind="{titleID: 'desktop-strength-title'}"
    @close="strengthOpen = false"
  >
    <dl class="desktop-strength-breakdown">
      <div v-for="row in strengthRows" :key="`${row.label}-${row.value}`">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value >= 0 ? "+" : "" }}{{ row.value }}</dd>
      </div>
    </dl>
    <p v-if="combat" class="desktop-strength-total">
      Итог игрока: {{ combat.player_strength }} · итог монстров: {{ combat.monster_strength }}.
    </p>
  </SheetDialog>
</template>

<style scoped lang="scss">
.desktop-encounter-stage {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space-3);
}

.desktop-encounter-stage__heading,
.desktop-combat-summary,
.desktop-run-away {
  min-width: 0;
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-3);
}

.desktop-encounter-stage__heading h2,
.desktop-encounter-stage__heading p {
  margin: 0;
}

.desktop-encounter-stage__heading h2 {
  margin-top: var(--space-1);
  overflow-wrap: anywhere;
  font-size: clamp(1.3rem, 2vw, 1.8rem);
}

.desktop-encounter-stage__board {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(94px, 112px) minmax(0, 1fr);
  gap: var(--space-4);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  padding: var(--space-4);
  background:
    linear-gradient(135deg, rgb(255 255 255 / 70%), transparent 42%),
    var(--color-surface);
}

.desktop-deck-rail {
  display: grid;
  align-content: center;
  gap: var(--space-4);
}

.desktop-deck {
  display: grid;
  justify-items: center;
  gap: var(--space-1);
  min-width: 0;
  color: var(--color-text-muted);
  text-align: center;
}

.desktop-deck :deep(.deck-back) {
  width: min(100%, 6.4rem);
}

.desktop-deck strong {
  color: var(--color-text);
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}

.desktop-deck span,
.desktop-deck small {
  font-size: .68rem;
  text-transform: uppercase;
}

.desktop-encounter-stage__content {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space-3);
}

.desktop-encounter-card {
  position: relative;
  min-width: 0;
  flex: 0 0 min(310px, 42%);
  display: grid;
  align-content: start;
  gap: var(--space-1);
  padding: var(--space-1);
  border: 2px solid transparent;
  border-radius: var(--radius-panel);
  scroll-snap-align: start;
}

.desktop-encounter-card--active {
  border-color: var(--color-accent-strong);
  background: color-mix(in srgb, var(--color-accent-strong), transparent 92%);
}

.desktop-encounter-card__index {
  color: var(--color-text-muted);
  font-family: var(--font-meta);
  font-size: .66rem;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.desktop-encounter-card :deep(.card-frame) {
  width: 100%;
  height: 340px;
  min-height: 0;
  grid-template-rows: auto 125px minmax(0, 1fr) auto;
}

.desktop-encounter-card :deep(.card-frame__content) {
  min-height: 0;
  overflow: auto;
}

.desktop-phase-card {
  min-height: 340px;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--space-3);
  border: 2px dashed var(--color-accent);
  border-radius: var(--radius-panel);
  padding: var(--space-6);
  text-align: center;
}

.desktop-phase-card__mark {
  width: 4rem;
  height: 4rem;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-accent-strong);
  border-radius: 50%;
  color: var(--color-accent-strong);
  font-size: 2rem;
}

.desktop-phase-card strong {
  font-size: 1.45rem;
}

.desktop-phase-card p,
.desktop-pending-decision span,
.desktop-run-away span,
.desktop-strength-total {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.desktop-combat-summary {
  align-items: center;
  flex-wrap: wrap;
  border-top: 1px solid var(--color-line);
  padding-top: var(--space-3);
}

.desktop-combat-summary__numbers {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.desktop-combat-summary__versus {
  color: var(--color-rust);
  font-family: var(--font-display);
  font-size: 1.2rem;
}

.desktop-combat-summary__result {
  flex: 1 1 12rem;
  color: var(--color-text-muted);
  font-size: .78rem;
  text-align: center;
}

.desktop-combat-summary__details {
  min-height: 2.75rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-control);
  padding: .55rem .7rem;
  color: var(--color-text);
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.desktop-combat-summary__details:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.desktop-run-away,
.desktop-pending-decision {
  display: grid;
  gap: var(--space-1);
  border-left: 3px solid var(--color-rust);
  padding: var(--space-2) var(--space-3);
  background: color-mix(in srgb, var(--color-rust), transparent 94%);
}

.desktop-run-away strong,
.desktop-pending-decision strong {
  overflow-wrap: anywhere;
}

.desktop-run-away .eyebrow,
.desktop-pending-decision .eyebrow {
  margin: 0;
}

.desktop-pending-decision {
  border-left-color: var(--color-info);
  background: color-mix(in srgb, var(--color-info), transparent 94%);
}

.desktop-resolving-rail :deep(.card-frame--compact) {
  flex-basis: 152px;
  width: 152px;
}

.desktop-strength-breakdown {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.desktop-strength-breakdown div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  border-bottom: 1px solid var(--color-line);
  padding-bottom: var(--space-2);
}

.desktop-strength-breakdown dt {
  color: var(--color-text-muted);
}

.desktop-strength-breakdown dd {
  margin: 0;
  color: var(--color-accent-strong);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.desktop-strength-total {
  margin-top: var(--space-3);
}

@media (width <= 1023px) {
  .desktop-encounter-stage__board {
    grid-template-columns: 76px minmax(0, 1fr);
    gap: var(--space-2);
    padding: var(--space-3);
  }

  .desktop-deck-rail {
    gap: var(--space-2);
  }

  .desktop-deck :deep(.deck-back) {
    width: 4.3rem;
  }

  .desktop-encounter-card {
    flex-basis: min(280px, 70%);
  }

  .desktop-encounter-card :deep(.card-frame),
  .desktop-phase-card {
    height: 340px;
    min-height: 340px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .desktop-encounter-stage,
  .desktop-encounter-stage :deep(*) {
    scroll-behavior: auto;
  }
}

@media (forced-colors: active) {
  .desktop-encounter-stage__board,
  .desktop-encounter-card,
  .desktop-phase-card,
  .desktop-run-away,
  .desktop-pending-decision {
    border-color: CanvasText;
  }
}
</style>
