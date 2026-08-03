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
const winner = computed(() => {
  const participants = [props.projection.you, ...props.projection.players];
  return participants.find((player) => player.player_id === props.projection.winner_player_id)
    ?? props.projection.you;
});
const viewerWon = computed(() => props.projection.winner_player_id === props.projection.you.player_id);
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
    <header
      class="desktop-encounter-stage__heading"
      :class="{'desktop-encounter-stage__heading--finished': projection.status === 'finished'}"
    >
      <div>
        <p class="eyebrow">{{ projection.status === "finished" ? "ИТОГ ПАРТИИ" : "ЦЕНТР СТОЛА" }}</p>
        <h2 id="desktop-encounter-title">
          {{ projection.status === "finished"
            ? viewerWon ? "Победа!" : "Партия завершена"
            : encounterCards.length ? "Открытая встреча" : "Состояние стола" }}
        </h2>
        <p v-if="projection.status === 'finished'" class="desktop-encounter-stage__finished-context">
          {{ viewerWon ? "Последний уровень получен за победу." : "Ты открыл уже завершённую игру." }}
        </p>
      </div>
      <PhaseLabel v-if="projection.status !== 'finished'" :phase="projection.turn.phase" />
    </header>

    <div v-if="encounterCards.length" class="desktop-encounter-pager" aria-live="polite">
      {{ activeCardIndex + 1 }} / {{ encounterCards.length }} · {{ activeCard?.name }}
    </div>

    <div v-if="projection.status === 'finished'" class="desktop-victory-result" role="status">
      <span class="desktop-victory-result__badge">
        {{ viewerWon ? "ПОБЕДИТЕЛЬ" : "ЗАВЕРШЕНО" }}
      </span>
      <strong>
        {{ viewerWon ? `${winner.name} · ${winner.level} уровень` : `Победитель: ${winner.name}` }}
      </strong>
      <p>
        {{ viewerWon
          ? "Последний уровень получен за победу над Архивной пылью."
          : `Итоговый уровень ${winner.level}. Партия завершена сервером.` }}
      </p>
      <small>ИТОГ ПОДТВЕРЖДЁН СЕРВЕРОМ</small>
    </div>

    <p v-if="projection.status === 'finished'" class="desktop-victory-stage__note">
      {{ viewerWon
        ? "ИТОГ ПАРТИИ ЗАФИКСИРОВАН СЕРВЕРОМ"
        : "ИСТОРИЯ И ФИНАЛЬНЫЕ РЕЗУЛЬТАТЫ ДОСТУПНЫ ТОЛЬКО ДЛЯ ЧТЕНИЯ" }}
    </p>

    <div v-else class="desktop-encounter-stage__board">
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
            <span
              v-if="card.combat_strength"
              class="desktop-encounter-card__strength"
              :aria-label="`Сила карты ${card.combat_strength}`"
            >
              {{ card.combat_strength }}
            </span>
          </div>
        </CardRail>
        <div v-else class="desktop-phase-card" role="status">
          <span class="desktop-phase-card__mark" aria-hidden="true">+</span>
          <PhaseLabel :phase="projection.turn.phase" />
          <strong>Ждём следующую карту</strong>
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

.desktop-encounter-stage__finished-context {
  margin: .35rem 0 0;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.desktop-victory-result {
  min-width: 0;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: var(--space-3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  padding: var(--space-6);
  color: var(--color-text-primary);
  background: var(--color-surface);
  text-align: center;
}

.desktop-victory-result__badge {
  border: 1px solid var(--color-accent-strong);
  border-radius: 999px;
  padding: .45rem 1.5rem;
  color: var(--color-surface);
  background: var(--color-accent-strong);
  font-size: .68rem;
  font-weight: 800;
  letter-spacing: .08em;
}

.desktop-victory-result strong {
  font-size: clamp(1.35rem, 2.5vw, 1.8rem);
}

.desktop-victory-result p,
.desktop-victory-result small,
.desktop-victory-stage__note {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.45;
}

.desktop-victory-result small,
.desktop-victory-stage__note {
  font-size: .68rem;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.desktop-victory-stage__note {
  border: 0;
  color: var(--color-text-muted);
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

@media (width >= 1024px) {
  .desktop-encounter-stage {
    position: relative;
    height: 100%;
    box-sizing: border-box;
    display: block;
    overflow: hidden;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-panel);
    padding: 0;
    background: var(--color-surface);
  }

  .desktop-encounter-stage__heading {
    position: absolute;
    z-index: -1;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .desktop-encounter-stage__heading--finished {
    position: absolute;
    z-index: 1;
    top: 20px;
    right: 24px;
    left: 24px;
    width: auto;
    height: auto;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }

  .desktop-encounter-stage__heading--finished h2 {
    margin-top: 6px;
    font-size: 1.2rem;
  }

  .desktop-encounter-stage__heading--finished .desktop-encounter-stage__finished-context {
    margin-top: 6px;
    font-size: .72rem;
  }

  .desktop-victory-result {
    position: absolute;
    top: 129px;
    left: 103px;
    width: 560px;
    height: 250px;
    box-sizing: border-box;
    border-radius: 16px;
    padding: 24px;
  }

  .desktop-victory-stage__note {
    position: absolute;
    right: 24px;
    bottom: 44px;
    left: 24px;
  }

  .desktop-encounter-stage__heading .eyebrow {
    margin: 0;
    color: var(--color-text-muted);
    font-size: .58rem;
    letter-spacing: .1em;
  }

  .desktop-encounter-stage__heading h2 {
    margin-top: 3px;
    color: var(--color-text-primary);
    font-size: .86rem;
    letter-spacing: .02em;
  }

  .desktop-encounter-stage__heading :deep(.phase-label) {
    font-size: .62rem;
  }

  .desktop-encounter-stage__board {
    min-height: 0;
    height: 100%;
    display: block;
    overflow: hidden;
    border: 0;
    border-radius: 0;
    padding: 0;
    background: transparent;
  }

  .desktop-deck-rail {
    display: none;
  }

  .desktop-encounter-stage__content {
    position: relative;
    min-height: 0;
    height: 100%;
    display: block;
  }

  .desktop-encounter-pager {
    position: absolute;
    z-index: 5;
    top: 7px;
    left: 50%;
    width: 140px;
    min-height: 32px;
    box-sizing: border-box;
    display: grid;
    place-items: center;
    overflow: hidden;
    transform: translateX(-50%);
    border: 1px solid var(--color-line);
    border-radius: 999px;
    padding: 0 14px;
    color: var(--color-text-secondary);
    background: var(--color-surface);
    font-size: .62rem;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .desktop-encounter-stage__content > .card-rail {
    min-height: 0;
    height: 100%;
    display: block;
  }

  .desktop-encounter-stage__content > .card-rail :deep(.card-rail__header) {
    display: none;
  }

  .desktop-encounter-stage__content :deep(.card-rail__viewport) {
    position: absolute;
    top: 83px;
    right: 0;
    bottom: 0;
    left: 0;
    min-height: 0;
    height: auto;
    align-items: stretch;
    gap: 16px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 0 12px;
  }

  .desktop-encounter-card {
    flex: 0 0 240px;
    width: 240px;
    height: 400px;
    box-sizing: border-box;
    gap: 0;
    border: 0;
    border-radius: 16px;
    padding: 0;
    background: transparent;
  }

  .desktop-encounter-card__index {
    position: absolute;
    z-index: 2;
    top: 10px;
    left: 12px;
    color: var(--color-text-secondary);
    font-family: var(--font-meta);
    font-size: .56rem;
    letter-spacing: .08em;
  }

  .desktop-encounter-card :deep(.card-frame) {
    width: 240px;
    height: 400px;
    min-height: 400px;
    box-sizing: border-box;
    grid-template-rows: 0 236px minmax(0, 1fr) auto;
    gap: 0;
    border: 1px solid var(--color-border-card);
    border-radius: 16px;
    padding: 0;
    background: var(--color-surface);
    box-shadow: 0 3px 12px rgb(46 43 41 / 10%);
  }

  .desktop-encounter-card :deep(.card-frame__art) {
    aspect-ratio: auto;
    border: 0;
    border-bottom: 1px solid var(--color-line);
  }

  .desktop-encounter-card :deep(.card-frame__content) {
    min-height: 0;
    overflow: visible;
    padding: 0;
  }

  .desktop-encounter-card :deep(.game-card__copy) {
    position: relative;
    gap: 8px;
    padding: 14px 16px 12px;
  }

  .desktop-encounter-card :deep(.game-card__copy)::before {
    position: absolute;
    top: -56px;
    right: 0;
    left: 0;
    height: 56px;
    background: rgb(40 49 46 / 82%);
    content: "";
  }

  .desktop-encounter-card :deep(.game-card__name) {
    position: absolute;
    z-index: 1;
    top: -44px;
    right: 16px;
    left: 16px;
    margin: 0;
    font-family: var(--font-card);
    color: #fff9ef;
    font-size: 1.05rem;
    line-height: 1.2;
  }

  .desktop-encounter-card :deep(.game-card__rules) {
    color: var(--color-text-secondary);
    font-size: .72rem;
    line-height: 1.35;
  }

  .desktop-encounter-card :deep(.game-card__flavor) {
    color: var(--color-text-muted);
  }

  .desktop-encounter-card--active {
    flex-basis: 256px;
    width: 256px;
    height: 416px;
    margin-top: -8px;
    margin-bottom: -8px;
    border: 8px solid var(--color-action-response);
    padding: 0;
    background: var(--color-action-response);
  }

  .desktop-encounter-card--active :deep(.card-frame) {
    width: 240px;
    height: 400px;
    min-height: 400px;
    border-color: var(--color-action-response);
    border-radius: 9px;
  }

  .desktop-encounter-card__strength {
    position: absolute;
    z-index: 3;
    top: 14px;
    left: 14px;
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border: 3px solid var(--color-border-card);
    border-radius: 50%;
    color: var(--color-action-response);
    background: var(--color-surface);
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 800;
  }

  .desktop-encounter-card--active .desktop-encounter-card__strength {
    top: 14px;
    left: 14px;
  }

  .desktop-encounter-card :deep(.game-card__stats) {
    display: none;
  }

  .desktop-encounter-card--active .desktop-encounter-card__index {
    top: 6px;
    left: 8px;
    color: #fff9ef;
  }

  .desktop-encounter-stage__content :deep(.card-rail__pager) {
    justify-content: center;
    gap: 12px;
    color: var(--color-text-secondary);
    font-size: .64rem;
  }

  .desktop-encounter-stage__content :deep(.card-rail__pager button) {
    min-height: 28px;
    border-color: var(--color-line);
    border-radius: 999px;
    padding: 0 10px;
    background: var(--color-surface-control);
    font-size: .62rem;
  }

  .desktop-phase-card {
    min-height: 400px;
    border-color: var(--color-line);
    border-radius: 16px;
    background: var(--color-surface-control);
  }

  .desktop-combat-summary {
    position: absolute;
    right: 16px;
    bottom: 8px;
    left: 16px;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: end;
    gap: 8px;
    border-top: 0;
    padding-top: 0;
    pointer-events: none;
  }

  .desktop-combat-summary__numbers,
  .desktop-combat-summary__result,
  .desktop-combat-summary__details {
    font-size: .6rem;
  }

  .desktop-combat-summary__numbers {
    gap: 6px;
  }

  .desktop-combat-summary__result {
    flex: 0 1 auto;
    color: var(--color-text-muted);
  }

  .desktop-combat-summary__details {
    min-height: 28px;
    padding: 4px 8px;
    pointer-events: auto;
  }

  .desktop-run-away,
  .desktop-pending-decision,
  .desktop-resolving-rail {
    position: absolute;
    right: 16px;
    bottom: 42px;
    left: 16px;
    z-index: 4;
  }
}
</style>
