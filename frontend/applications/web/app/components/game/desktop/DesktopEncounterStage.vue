<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import GameCard from "../../GameCard.vue";
import CardRail from "../primitives/CardRail.vue";
import DeckBack from "../primitives/DeckBack.vue";
import RailPager from "../primitives/RailPager.vue";
import type {GamePresentationModel} from "../gamePresentationModel";

const props = defineProps<{
  projection: Projection;
  presentationModel: GamePresentationModel;
}>();

const activeCardIndex = ref(0);
const encounterStage = ref<HTMLElement>();
const encounterCards = computed(() => props.presentationModel.encounterCards);
const primarySurface = computed(() => props.presentationModel.primary);
const activeCard = computed(() => encounterCards.value[activeCardIndex.value]);
const preparationCards = computed(() => [
  ...props.projection.you.carried,
  ...props.projection.you.equipped,
  ...props.projection.you.hand,
].slice(0, 3));
const rewardCards = computed(() => props.projection.you.hand.slice(0, 2));
const winner = computed(() => {
  const participants = [props.projection.you, ...props.projection.players];
  return participants.find((player) => player.player_id === props.projection.winner_player_id)
    ?? props.projection.you;
});
const viewerWon = computed(() => props.projection.winner_player_id === props.projection.you.player_id);
watch(() => encounterCards.value.length, (length) => {
  activeCardIndex.value = Math.min(activeCardIndex.value, Math.max(0, length - 1));
}, {immediate: true});

watch(
  () => props.presentationModel.activeEncounterIndex,
  (index) => {
    activeCardIndex.value = index;
  },
  {immediate: true},
);

function selectCard(index: number) {
  activeCardIndex.value = index;
  void nextTick(() => {
    encounterStage.value?.querySelector<HTMLElement>(
      `.desktop-encounter-stage [data-card-index="${index}"]`,
    )?.scrollIntoView({behavior: "smooth", block: "nearest", inline: "center"});
  });
}
</script>

<template>
  <section
    ref="encounterStage"
    class="desktop-encounter-stage"
    :data-primary-surface="primarySurface.kind"
    aria-labelledby="desktop-encounter-title"
    :data-has-encounter="encounterCards.length > 0"
  >
    <header
      v-if="projection.status === 'finished'"
      class="desktop-encounter-stage__heading"
      :class="{'desktop-encounter-stage__heading--finished': true}"
    >
      <div>
        <p class="eyebrow">ИТОГ ПАРТИИ</p>
        <h2 id="desktop-encounter-title">
          {{ viewerWon ? "Победа!" : "Партия завершена" }}
        </h2>
        <p class="desktop-encounter-stage__finished-context">
          {{ viewerWon ? "Победа подтверждена сервером." : "Партия завершена." }}
        </p>
      </div>
    </header>

    <div
      v-if="encounterCards.length && (primarySurface.kind === 'combat' || primarySurface.kind === 'waiting')"
      class="desktop-encounter-pager"
      aria-live="polite"
    >
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
          ? "Последний уровень получен за победу."
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
      <div class="desktop-encounter-stage__content">
        <CardRail
          v-if="encounterCards.length && (primarySurface.kind === 'combat' || primarySurface.kind === 'waiting')"
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
            <GameCard
              :card="card"
              :content-set-id="projection.content_set_id"
              encounter
            />
          </div>
        </CardRail>
        <section
          v-else-if="primarySurface.kind === 'door-choice'"
          class="desktop-flow-surface desktop-flow-surface--door"
          aria-label="Открытие двери"
        >
          <header><div><h2>Дверь</h2><p>Открой верхнюю карту — результат определит продолжение хода.</p></div></header>
          <div class="desktop-door-decision">
            <div class="desktop-door-decision__deck">
              <DeckBack deck="door" label="Верхняя карта колоды дверей" />
            </div>
            <span>{{ projection.door_deck_count }} КАРТЫ</span>
            <strong>ОТКРЫТЬ</strong>
          </div>
          <small>НАЖМИ НА КОЛОДУ ИЛИ ИСПОЛЬЗУЙ ДЕЙСТВИЕ СПРАВА</small>
        </section>
        <section
          v-else-if="primarySurface.kind === 'run-away'"
          class="desktop-flow-surface desktop-flow-surface--run-away"
          aria-label="Выбор монстра для побега"
        >
          <header>
            <h2>Смыться</h2>
            <p>Выбери монстра, от которого пытаешься сбежать первым.</p>
          </header>
          <div class="desktop-flow-surface__cards" role="list">
            <GameCard
              v-for="(card, index) in encounterCards"
              :key="`run-away-choice-${card.instance_id}`"
              :card="card"
              :content-set-id="projection.content_set_id"
              choice
              :class="{'desktop-flow-card--selected': index === activeCardIndex}"
              role="listitem"
            />
          </div>
          <p class="desktop-flow-surface__pill">БОНУС К ПОБЕГУ {{ projection.you.escape_bonus >= 0 ? '+' : '' }}{{ projection.you.escape_bonus }}</p>
          <small>ЦЕЛЬ БРОСКА: 5+ · РЕЗУЛЬТАТ И ПОСЛЕДСТВИЯ ОПРЕДЕЛИТ СЕРВЕР</small>
        </section>

        <section
          v-else-if="primarySurface.kind === 'result' && primarySurface.source === 'reward'"
          class="desktop-flow-surface desktop-flow-surface--reward"
          aria-label="Полученная награда"
        >
          <header>
            <div>
              <h2>Награда получена</h2>
              <p>Сервер уже добавил сокровища в руку и повысил уровень.</p>
            </div>
            <strong class="desktop-flow-surface__confirmed">ПОДТВЕРЖДЕНО</strong>
          </header>
          <div class="desktop-reward-content">
            <div class="desktop-level-reward">
              <strong>+{{ primarySurface.levels }}</strong>
              <span>{{ primarySurface.levels === 1 ? "УРОВЕНЬ" : "УРОВНЯ" }}</span>
              <small>Рука: {{ projection.you.hand.length }} / {{ projection.you.hand_limit }}</small>
            </div>
            <GameCard
              v-for="card in rewardCards"
              :key="`reward-${card.instance_id}`"
              :card="card"
              :content-set-id="projection.content_set_id"
              choice
            />
          </div>
          <p class="desktop-flow-surface__pill">{{ primarySurface.treasures }} СОКРОВИЩА</p>
          <small>ДАЛЬШЕ: БЛАГОТВОРИТЕЛЬНОСТЬ, ЕСЛИ РУКА ПРЕВЫШАЕТ ЛИМИТ</small>
        </section>

        <section
          v-else-if="primarySurface.kind === 'result' && primarySurface.source === 'run-away'"
          class="desktop-flow-surface desktop-flow-surface--run-away-result"
          aria-label="Результат побега"
        >
          <header>
            <div>
              <h2>{{ primarySurface.escaped ? "Ты смылся" : "Сбежать не удалось" }}</h2>
              <p>Попытка побега завершилась {{ primarySurface.escaped ? "успешно" : "неудачно" }}.</p>
            </div>
          </header>
          <div class="desktop-run-away-result" :data-result="primarySurface.escaped ? 'success' : 'failure'">
            <strong>{{ primarySurface.escaped ? "УСПЕХ" : "НЕУДАЧА" }}</strong>
            <h3>
              Бросок {{ primarySurface.roll }} {{ primarySurface.modifier >= 0 ? "+" : "−" }} {{ Math.abs(primarySurface.modifier) }}
            </h3>
            <p>
              Итог {{ primarySurface.total }} — {{ primarySurface.escaped
                ? "побег успешен. Непотребство не применяется."
                : "побег не удался. Последствия применяет сервер." }}
            </p>
            <span>{{ primarySurface.monsterName }} {{ primarySurface.escaped ? "пройдена" : "догнал тебя" }}</span>
          </div>
          <small>{{ primarySurface.escaped ? "ЭТОТ МОНСТР БОЛЬШЕ НЕ ПРЕСЛЕДУЕТ ТЕБЯ" : "РЕЗУЛЬТАТ И ПОСЛЕДСТВИЯ ПОДТВЕРЖДЕНЫ СЕРВЕРОМ" }}</small>
        </section>

        <section
          v-else-if="primarySurface.kind === 'phase' && (primarySurface.family === 'setup' || primarySurface.family === 'preparation')"
          class="desktop-flow-surface desktop-flow-surface--preparation"
          aria-label="Подготовка персонажа"
        >
          <header>
            <h2>Подготовка персонажа</h2>
            <p>Выбери карты, которые хочешь экипировать перед открытием двери.</p>
          </header>
          <div class="desktop-flow-surface__cards" role="list">
            <GameCard
              v-for="card in preparationCards"
              :key="`preparation-${card.instance_id}`"
              :card="card"
              :content-set-id="projection.content_set_id"
              choice
              role="listitem"
            />
          </div>
          <small>КАРТЫ МОЖНО ЭКИПИРОВАТЬ, ПРОДАТЬ ИЛИ ОСТАВИТЬ В РУКЕ</small>
        </section>

        <section
          v-else-if="primarySurface.kind === 'phase' && primarySurface.family === 'charity'"
          class="desktop-flow-surface desktop-flow-surface--charity"
          aria-label="Благотворительность"
        >
          <header><div><h2>Благотворительность</h2><p>Выбери карты для передачи или сброса в пределах серверного лимита.</p></div></header>
          <div class="desktop-flow-surface__cards" role="list">
            <GameCard v-for="card in projection.you.hand.slice(0, 3)" :key="`charity-${card.instance_id}`" :card="card" :content-set-id="projection.content_set_id" choice role="listitem" />
          </div>
          <small>РУКА · {{ projection.you.hand.length }} / {{ projection.you.hand_limit }}</small>
        </section>

        <section
          v-else-if="primarySurface.kind === 'phase' && primarySurface.family === 'end-turn'"
          class="desktop-flow-surface desktop-flow-surface--end-turn"
          aria-label="Завершение хода"
        >
          <header><div><h2>Ход завершён</h2><p>Стол готов передать ход следующему игроку.</p></div></header>
          <div class="desktop-end-turn-result"><strong>ГОТОВО</strong><p>Все обязательные решения текущего хода закрыты.</p></div>
          <small>СЛЕДУЮЩИЙ ХОД ОПРЕДЕЛЯЕТ СЕРВЕР</small>
        </section>

        <RailPager
          v-if="encounterCards.length > 1 && (primarySurface.kind === 'combat' || primarySurface.kind === 'waiting')"
          :page="activeCardIndex"
          :page-count="encounterCards.length"
          label="Навигация по картам встречи"
          @select="selectCard"
        />

        <section v-if="primarySurface.kind === 'required-decision' && projection.turn.pending_decision" class="desktop-pending-decision" aria-label="Ожидающее решение">
          <p class="eyebrow">ОЖИДАЮЩЕЕ РЕШЕНИЕ</p>
          <strong>Выбор из {{ projection.turn.pending_decision.options.length }} вариантов</strong>
          <span>Доступность и границы выбора пришли из server projection.</span>
        </section>

        <CardRail
          v-if="primarySurface.kind === 'resolving'"
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

</template>

<style scoped lang="scss">
.desktop-encounter-stage {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space-3);
}

.desktop-encounter-stage__heading {
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

.desktop-pending-decision span {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.desktop-flow-surface {
  position: absolute;
  inset: 0;
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
  box-sizing: border-box;
  padding: 16px;
  color: var(--color-text-primary);
  background: var(--color-surface);
}

.desktop-flow-surface header {
  min-width: 0;
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}

.desktop-flow-surface h2,
.desktop-flow-surface p { margin: 0; }
.desktop-flow-surface h2 { font-size: 18px; line-height: 24px; }
.desktop-flow-surface header p { margin-top: 8px; color: var(--color-text-secondary); font-size: 11px; line-height: 14px; }
.desktop-flow-surface__cards {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 42px;
}
.desktop-flow-surface__cards :deep(.choice-card-presentation) { box-shadow: 0 7px 18px rgb(59 46 40 / 14%); }
.desktop-flow-surface__cards :deep(.desktop-flow-card--selected) { border-color: var(--color-action-primary); }
.desktop-flow-surface > small {
  color: var(--color-text-muted);
  font-size: 9px;
  font-weight: 600;
  line-height: 12px;
  letter-spacing: .04em;
}
.desktop-flow-surface__pill {
  justify-self: center;
  min-width: 164px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: 10px;
}
.desktop-flow-surface--run-away { grid-template-rows: auto 1fr auto auto; }
.desktop-flow-surface--reward { grid-template-rows: auto 1fr auto auto; }
.desktop-flow-surface--door { grid-template-rows: auto 1fr auto; }
.desktop-door-decision {
  position: relative;
  align-self: stretch;
  justify-self: stretch;
}
.desktop-door-decision__deck {
  position: absolute;
  top: 30px;
  left: calc(50% - 90px);
  width: 180px;
  height: 262px;
}
.desktop-door-decision__deck::before,
.desktop-door-decision__deck::after {
  position: absolute;
  inset: 0;
  z-index: 0;
  border: 1px solid var(--color-border-strong);
  border-radius: 14px;
  background: var(--color-surface-control);
  box-shadow: 0 7px 18px rgb(59 46 40 / 14%);
  content: "";
}
.desktop-door-decision__deck::before { transform: translateX(16px); opacity: .42; }
.desktop-door-decision__deck::after { transform: translateX(8px); opacity: .72; }
.desktop-door-decision__deck :deep(.deck-back) {
  position: relative;
  z-index: 1;
  width: 180px;
  height: 262px;
  border-radius: 14px;
}
.desktop-door-decision > span {
  position: absolute;
  top: 270px;
  left: calc(50% + 120px);
  min-width: 112px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.desktop-door-decision > strong {
  position: absolute;
  top: 300px;
  left: 50%;
  transform: translateX(-50%);
  color: var(--color-action-primary);
  font-size: 12px;
}
.desktop-flow-surface__confirmed {
  border-radius: 999px;
  padding: 7px 14px;
  color: #fff;
  background: var(--color-action-primary);
  font-size: 9px;
  letter-spacing: .06em;
}
.desktop-reward-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 34px;
}
.desktop-level-reward {
  width: 134px;
  height: 218px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  background: var(--color-surface-raised);
}
.desktop-level-reward strong { color: var(--color-action-primary); font-size: 42px; line-height: 48px; }
.desktop-level-reward span { color: var(--color-text-secondary); font-size: 9px; }
.desktop-level-reward small { color: var(--color-text-primary); font-size: 10px; }
.desktop-flow-surface--run-away-result,
.desktop-flow-surface--end-turn { grid-template-rows: auto 1fr auto; }
.desktop-run-away-result,
.desktop-end-turn-result {
  align-self: center;
  justify-self: center;
  width: min(560px, 100%);
  min-height: 250px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  border-radius: 20px;
  padding: 28px 32px 24px;
  background: var(--color-surface-raised);
  text-align: center;
}
.desktop-run-away-result > strong,
.desktop-end-turn-result > strong {
  min-width: 132px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: #fff;
  background: var(--color-action-primary);
  font-size: 11px;
}
.desktop-run-away-result[data-result="failure"] > strong { background: var(--color-danger); }
.desktop-run-away-result h3 { margin: 0; font-size: 28px; line-height: 36px; }
.desktop-run-away-result p,
.desktop-end-turn-result p { color: var(--color-text-secondary); font-size: 14px; line-height: 20px; }
.desktop-run-away-result span { color: var(--color-action-primary); font-size: 13px; }
.desktop-flow-surface--waiting { place-content: center; text-align: center; }

.desktop-pending-decision {
  display: grid;
  gap: var(--space-1);
  border-left: 3px solid var(--color-rust);
  padding: var(--space-2) var(--space-3);
  background: color-mix(in srgb, var(--color-rust), transparent 94%);
}

.desktop-pending-decision strong {
  overflow-wrap: anywhere;
}

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

  .desktop-encounter-card :deep(.card-frame) {
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
