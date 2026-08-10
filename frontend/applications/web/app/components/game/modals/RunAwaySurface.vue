<script setup lang="ts">
import type {CardView, InteractionView, Projection} from "@munchkin/contracts";

import {useInteractionCountdown} from "../../../composables/useInteractionCountdown";
import {
  actionIsSelectable,
  type InteractionActionView,
} from "../../interaction/interactionModel";
import {
  isRunAwayInteraction,
  runAwayEffectLabel,
  targetRunAwayActionDetails,
  targetRunAwayActionLabel,
} from "../../interaction/targetRunAwayModel";
import SheetDialog from "../../ui/SheetDialog.vue";

const props = withDefaults(defineProps<{
  projection: Projection;
  interaction: InteractionView;
  busy: boolean;
  variant?: "compact" | "desktop";
}>(), {variant: "compact"});

const emit = defineEmits<{
  submit: [action: InteractionActionView];
  "open-character": [];
}>();

const isMonsterChoice = computed(() =>
  props.projection.turn.pending_decision?.type === "run_away_monster" &&
  props.interaction.public_kind === "private_choice",
);
const interaction = computed(() => isRunAwayInteraction(props.interaction) || isMonsterChoice.value
  ? props.interaction
  : undefined);
const actions = computed(() => interaction.value?.response_required_for_you
  ? interaction.value.actions.filter(actionIsSelectable)
  : []);
const ownCards = computed<CardView[]>(() => [
  ...props.projection.you.hand,
  ...props.projection.you.carried,
  ...props.projection.you.equipped,
]);
const monsters = computed(() => [...new Map([
  ...props.projection.turn.resolving,
  ...(props.projection.turn.combat?.monsters ?? []),
  ...(props.projection.turn.encounter ? [props.projection.turn.encounter] : []),
].filter((card) => card.kind === "monster").map((card) => [card.instance_id, card])).values()]);
const activeRunAwayMonsters = computed(() => {
  if (isMonsterChoice.value) return monsters.value;
  const currentPlayerID = props.projection.turn.run_away?.current_player_id;
  const attempted = new Set((props.projection.turn.run_away?.attempts ?? [])
    .filter((attempt) => attempt.player_id === currentPlayerID)
    .map((attempt) => attempt.monster_instance_id));
  return monsters.value.filter((card) => !attempted.has(card.instance_id));
});
const orderedMonsters = computed(() => {
  if (!isMonsterChoice.value) return activeRunAwayMonsters.value;
  const optionOrder = props.projection.turn.pending_decision?.options ?? [];
  const order = new Map(optionOrder.map((instanceID, index) => [instanceID, index]));
  return [...monsters.value].sort((left, right) => {
    const leftIndex = order.get(left.instance_id);
    const rightIndex = order.get(right.instance_id);
    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return 0;
  });
});
const selectedActionID = ref<string>();
const selectedAction = computed(() => actions.value.find((action) =>
  action.action_id === selectedActionID.value,
));
const currentMonsterID = computed(() => props.projection.turn.run_away?.current_monster_instance_id);
const effects = computed(() => props.projection.turn.run_away?.effects.filter((effect) =>
  effect.active,
) ?? []);
const countdown = useInteractionCountdown(
  () => interaction.value?.deadline_at,
  () => interaction.value?.server_time,
);
const timerText = computed(() => interaction.value?.deadline_at
  ? `${Math.floor(countdown.remainingSeconds.value / 60).toString().padStart(2, "0")}:${(countdown.remainingSeconds.value % 60).toString().padStart(2, "0")}`
  : "");
const progressText = computed(() => {
  const total = Math.max(orderedMonsters.value.length, 1);
  const currentIndex = Math.max(0, orderedMonsters.value.findIndex((card) =>
    card.instance_id === currentMonsterID.value,
  ));
  const escapeBonus = props.projection.you.escape_bonus;
  return `Выбран ${currentIndex + 1} / ${total} · побег ${escapeBonus >= 0 ? "+" : ""}${escapeBonus} · нужно 5+`;
});
const desktopNode = computed(() =>
  (props.projection.turn.run_away?.attempts.length ?? 0) > 0 ? "293:2026" : "285:1473",
);
const attemptedMonsterNames = computed(() => {
  const attempted = new Set((props.projection.turn.run_away?.attempts ?? [])
    .filter((attempt) => attempt.player_id === props.projection.you.player_id)
    .map((attempt) => attempt.monster_instance_id));
  return monsters.value.filter((card) => attempted.has(card.instance_id)).map((card) => card.name);
});

watch(actions, (next) => {
  if (!next.some((action) => action.action_id === selectedActionID.value)) {
    selectedActionID.value = isMonsterChoice.value
      ? undefined
      : next.find((action) => action.type === "pass")?.action_id ?? next[0]?.action_id;
  }
}, {immediate: true});

function monsterChoiceAction(instanceID: string): InteractionActionView | undefined {
  return actions.value.find((action) =>
    action.choice_ids?.length === 1 && action.choice_ids[0] === instanceID,
  );
}

function actionLabel(action: InteractionActionView, index: number): string {
  if (action.type === "pass") return "Без бонуса";
  return targetRunAwayActionLabel(action, index, ownCards.value);
}

function submitLabel(action: InteractionActionView, index: number): string {
  return action.type === "pass" ? "Бросить кубик" : actionLabel(action, index);
}

function submit(): void {
  if (props.busy || !selectedAction.value) return;
  emit("submit", selectedAction.value);
}
</script>

<template>
  <template v-if="variant === 'desktop' && interaction?.response_required_for_you">
    <main class="game-table__stage">
      <section
        v-if="isMonsterChoice"
        class="game-table__run-away-next"
        data-figma-owner="game-board:run-away-next"
        data-figma-desktop-node="294:2146"
        aria-labelledby="desktop-run-away-next-title"
      >
        <header>
          <div>
            <h2 id="desktop-run-away-next-title">Следующий монстр</h2>
            <p>Выбери, от кого пытаешься сбежать теперь.</p>
          </div>
        </header>
        <div class="game-table__run-away-next-cards" aria-label="Порядок побега">
          <button
            v-for="card in orderedMonsters"
            :key="card.instance_id"
            type="button"
            :disabled="!monsterChoiceAction(card.instance_id)"
            :aria-pressed="selectedAction?.action_id === monsterChoiceAction(card.instance_id)?.action_id"
            @click="selectedActionID = monsterChoiceAction(card.instance_id)?.action_id"
          >
            <span class="game-table__run-away-next-art">ИЛЛЮСТРАЦИЯ</span>
            <strong>{{ card.name }}</strong>
            <small v-if="monsterChoiceAction(card.instance_id)">
              Уровень {{ card.combat_strength ?? 0 }} · не пройден
            </small>
            <small v-else>Побег завершён</small>
            <p v-if="monsterChoiceAction(card.instance_id)">
              Непотребство: {{ card.bad_stuff_text ?? "применит сервер." }}
            </p>
            <p v-else>Этот монстр больше недоступен.</p>
          </button>
        </div>
        <footer>
          <span>ПОРЯДОК ВЛИЯЕТ НА ПОСЛЕДСТВИЯ ПРИ ПРОВАЛЕ</span>
          <time :datetime="interaction.deadline_at">{{ timerText }}</time>
        </footer>
      </section>

      <section
        v-else
        class="game-table__run-away"
        data-figma-owner="game-board:run-away-wide"
        :data-figma-desktop-node="desktopNode"
        aria-labelledby="desktop-run-away-title"
      >
        <header>
          <div>
            <h2 id="desktop-run-away-title">Смыться</h2>
            <p>Выбери монстра, от которого пытаешься сбежать первым.</p>
          </div>
          <time :datetime="interaction.deadline_at">{{ timerText }}</time>
        </header>
        <div class="game-table__run-away-cards" role="region" aria-label="Монстры для побега" tabindex="0">
          <article
            v-for="(card, index) in orderedMonsters"
            :key="card.instance_id"
            :class="{'game-table__run-away-card--selected': card.instance_id === currentMonsterID}"
            :aria-current="card.instance_id === currentMonsterID ? 'true' : undefined"
          >
            <span class="game-table__run-away-art">ИЛЛЮСТРАЦИЯ</span>
            <h3>{{ card.name }}</h3>
            <small>{{ card.combat_strength ? `Уровень ${card.combat_strength}` : "Монстр" }} · {{ card.instance_id === currentMonsterID ? "выбран" : `попытка ${index + 1}/${orderedMonsters.length}` }}</small>
            <p v-if="card.bad_stuff_text">Непотребство: {{ card.bad_stuff_text }}</p>
            <b v-if="card.instance_id === currentMonsterID">ВЫБРАНО</b>
          </article>
        </div>
        <p class="game-table__run-away-bonus">БОНУС К ПОБЕГУ {{ projection.you.escape_bonus >= 0 ? "+" : "" }}{{ projection.you.escape_bonus }}</p>
        <footer>ЦЕЛЬ БРОСКА: 5+ · РЕЗУЛЬТАТ И ПОСЛЕДСТВИЯ ОПРЕДЕЛИТ СЕРВЕР</footer>
      </section>
    </main>

    <aside class="game-table__sidebar" aria-label="Твой персонаж">
      <section class="game-table__run-away-priority">
        <span>ПОБЕГ</span>
        <div>
          <span>{{ isMonsterChoice ? "ПОБЕГ" : progressText }}</span>
          <strong>{{ isMonsterChoice ? `Осталось ${projection.turn.pending_decision?.options.length ?? 0}` : orderedMonsters.find((card) => card.instance_id === currentMonsterID)?.name ?? "Монстр" }}</strong>
          <p v-if="isMonsterChoice">
            Пройдено: {{ attemptedMonsterNames.join(", ") || "—" }}<br>
            Бонус к побегу: {{ projection.you.escape_bonus >= 0 ? "+" : "" }}{{ projection.you.escape_bonus }}
          </p>
          <p v-else>Твой бонус к побегу: {{ projection.you.escape_bonus >= 0 ? "+" : "" }}{{ projection.you.escape_bonus }}<br>Цель броска: 5+<br>При провале сработает непотребство.</p>
        </div>
      </section>
      <button class="game-table__character" type="button" @click="emit('open-character')">
        <span>Твой персонаж</span>
        <b>Персонаж</b>
        <strong>{{ projection.you.name }} · {{ projection.you.level }} уровень</strong>
        <em>Экипировка, класс и раса открываются отдельно.</em>
      </button>
      <section class="game-table__action-panel" aria-live="polite">
        <span>{{ isMonsterChoice ? "ТРЕБУЕТСЯ ВЫБОР" : "ДОСТУПНОЕ ДЕЙСТВИЕ" }}</span>
        <strong>{{ isMonsterChoice ? "Выбери следующего монстра" : "Можно бросить кубик" }}</strong>
        <p>{{ isMonsterChoice ? "После выбора станет доступен бросок." : "Сервер определит бросок и последствия." }}</p>
        <button class="game-primary-action" type="button" :disabled="busy || !selectedAction" @click="submit">
          {{ busy ? "Подтверждаем…" : isMonsterChoice ? "Подтвердить" : "Бросить кубик" }}
        </button>
      </section>
    </aside>
  </template>

  <SheetDialog
    v-else-if="interaction?.response_required_for_you"
    class="run-away-dialog"
    :open="true"
    :title="isMonsterChoice ? 'Следующий монстр' : 'Смыться'"
    :description="isMonsterChoice ? 'Выбери, от кого пытаешься сбежать теперь.' : 'Выбери монстра, от которого пытаешься сбежать первым.'"
    :compact-description="isMonsterChoice ? 'Порядок влияет на последствия при провале.' : 'Выбери монстра · затем сервер бросит кубик.'"
    :dismissible="false"
    desktop-width="768px"
    compact-gap="22px"
    :data-figma-owner="isMonsterChoice ? 'game-modal:run-away-next' : 'game-modal:run-away-response'"
    data-figma-compact-node="183:1671"
  >
    <template #header-action>
      <span
        v-if="timerText"
        class="run-away-sheet__timer"
      >{{ timerText }}</span>
    </template>

    <div class="run-away-sheet">
      <div class="run-away-sheet__rail" aria-label="Монстры для побега">
        <button
          v-for="(card, index) in orderedMonsters"
          :key="card.instance_id"
          type="button"
          :class="{'run-away-sheet__monster--selected': isMonsterChoice
            ? selectedAction?.action_id === monsterChoiceAction(card.instance_id)?.action_id
            : card.instance_id === currentMonsterID}"
          :aria-pressed="isMonsterChoice ? selectedAction?.action_id === monsterChoiceAction(card.instance_id)?.action_id : undefined"
          :aria-current="!isMonsterChoice && card.instance_id === currentMonsterID ? 'true' : undefined"
          :disabled="isMonsterChoice && !monsterChoiceAction(card.instance_id)"
          @click="isMonsterChoice && (selectedActionID = monsterChoiceAction(card.instance_id)?.action_id)"
        >
          <span class="run-away-sheet__art">МОНСТР {{ index + 1 }}</span>
          <strong>{{ card.name }}</strong>
          <small>Побег 5+</small>
          <p>Провал: {{ card.bad_stuff_text ?? "последствие определит сервер." }}</p>
          <span v-if="isMonsterChoice && selectedAction?.action_id === monsterChoiceAction(card.instance_id)?.action_id" class="run-away-sheet__status">ВЫБРАНО</span>
          <span v-else-if="!isMonsterChoice && card.instance_id === currentMonsterID" class="run-away-sheet__status">ВЫБРАНО</span>
          <span v-else-if="isMonsterChoice && !monsterChoiceAction(card.instance_id)" class="run-away-sheet__status">ПРОЙДЕН</span>
        </button>
      </div>

      <p class="run-away-sheet__progress">
        {{ isMonsterChoice ? `Осталось ${projection.turn.pending_decision?.options.length ?? 0} · бонус к побегу ${projection.you.escape_bonus >= 0 ? "+" : ""}${projection.you.escape_bonus}` : progressText }}
      </p>

      <div v-if="effects.length" class="run-away-sheet__effects" aria-label="Модификаторы побега">
        <span v-for="effect in effects" :key="effect.effect_id">
          {{ runAwayEffectLabel(effect) }}
        </span>
      </div>

      <div v-if="!isMonsterChoice && actions.length > 1" class="run-away-sheet__responses" aria-label="Разрешённые ответы">
        <button
          v-for="(action, index) in actions"
          :key="action.action_id"
          type="button"
          :aria-pressed="selectedAction?.action_id === action.action_id"
          :title="targetRunAwayActionDetails(action, projection, ownCards, interaction).join(' ')"
          @click="selectedActionID = action.action_id"
        >
          {{ actionLabel(action, index) }}
        </button>
      </div>

      <button
        class="run-away-sheet__submit"
        type="button"
        :disabled="busy || !selectedAction"
        @click="submit"
      >
        {{ busy ? "Подтверждаем…" : isMonsterChoice ? "Подтвердить" : selectedAction ? submitLabel(selectedAction, actions.indexOf(selectedAction)) : "Ожидаем сервер" }}
      </button>
    </div>
  </SheetDialog>
</template>

<style scoped lang="scss">
.game-table {
  &__stage,
  &__sidebar {
    min-width: 0;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-panel);
    background: var(--color-surface);
  }

  &__stage {
    position: relative;
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  &__run-away,
  &__run-away-next {
    width: 100%;
    height: 100%;
    min-width: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 16px;
    box-sizing: border-box;
    padding: 18px 24px 44px;

    h2,
    header p,
    footer { margin: 0; }

    h2 { font-size: 20px; line-height: 24px; }
    header p { margin-top: 6px; color: var(--color-text-muted); font-size: 12px; }
    footer { color: var(--color-text-muted); font-size: 9px; font-weight: 700; letter-spacing: .02em; }
  }

  &__run-away {
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    padding-bottom: 20px;

    header { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
    header time { flex: 0 0 70px; min-height: 28px; display: grid; place-items: center; border-radius: 999px; color: var(--color-surface); background: var(--color-status-warning); font-size: 11px; }
  }

  &__run-away-cards,
  &__run-away-next-cards {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: safe center;
    gap: clamp(18px, 5vw, 58px);
    overflow-x: auto;
    padding: 6px;
  }

  &__run-away-cards article,
  &__run-away-next-cards > button {
    position: relative;
    flex: 0 0 150px;
    height: 218px;
    display: grid;
    grid-template-rows: 92px auto auto minmax(0, 1fr);
    gap: 6px;
    overflow: hidden;
    box-sizing: border-box;
    border: 1px solid transparent;
    border-radius: 14px;
    padding: 0;
    color: inherit;
    background: var(--color-surface-card);
    box-shadow: 0 7px 18px rgb(59 46 40 / 14%);
    font: inherit;
    text-align: left;
  }

  &__run-away-next-cards > button { cursor: pointer; }
  &__run-away-next-cards > button:disabled { color: var(--color-text-muted); cursor: default; }
  &__run-away-next-cards > button[aria-pressed="true"],
  &__run-away-card--selected { border-color: var(--color-accent-strong); }

  &__run-away-art,
  &__run-away-next-art {
    display: grid;
    place-items: center;
    color: var(--color-text-primary);
    background: color-mix(in srgb, var(--color-accent) 30%, var(--color-surface));
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .08em;
  }

  &__run-away-cards h3,
  &__run-away-cards small,
  &__run-away-cards p,
  &__run-away-next-cards strong,
  &__run-away-next-cards small,
  &__run-away-next-cards p { margin: 0; padding-inline: 10px; }

  &__run-away-cards h3,
  &__run-away-next-cards strong { padding-top: 4px; font-size: 11px; line-height: 14px; }
  &__run-away-cards small,
  &__run-away-next-cards small { color: var(--color-text-muted); font-size: 9px; }
  &__run-away-cards p,
  &__run-away-next-cards p { font-size: 10px; line-height: 14px; }
  &__run-away-cards b { position: absolute; right: 10px; bottom: 8px; color: var(--color-action-primary); font-size: 8px; letter-spacing: .08em; }
  &__run-away-bonus { justify-self: center; min-width: 230px; margin: 0; border: 1px solid var(--color-line); border-radius: 999px; padding: 6px 14px; color: var(--color-text-muted); font-size: 11px; text-align: center; }
  &__run-away-next footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  &__run-away-next footer time { flex: 0 0 auto; color: var(--color-text-primary); font-size: 12px; letter-spacing: 0; }

  &__sidebar {
    grid-column: 3;
    grid-row: 1 / span 2;
    display: grid;
    grid-template-rows: 332px 188px minmax(194px, 1fr);
    gap: 24px;
    padding: 16px;
  }

  &__run-away-priority { min-width: 0; display: grid; grid-template-rows: auto 1fr; gap: 76px; }
  &__run-away-priority > span,
  &__run-away-priority > div > span,
  &__action-panel > span { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  &__run-away-priority > div { display: grid; align-content: start; gap: 18px; border: 1px solid var(--color-line); border-radius: 16px; padding: 16px; background: var(--color-surface-card); }
  &__run-away-priority strong { font-size: 20px; }
  &__run-away-priority p { margin: 0; color: var(--color-text-muted); font-size: 12px; line-height: 1.45; }

  &__character { min-width: 0; display: grid; align-content: start; border: 0; border-radius: 16px; padding: 16px; color: var(--color-surface); background: var(--color-ink); font: inherit; text-align: left; cursor: pointer; }
  &__character > span { color: var(--color-surface); font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  &__character b { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  &__character strong { margin-top: 12px; font-family: var(--font-card); font-size: 19px; }
  &__character em { margin-top: auto; color: var(--color-surface-muted); font-size: 10px; font-style: normal; line-height: 1.4; }

  &__action-panel { min-width: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; align-content: start; gap: 12px; border: 1px solid var(--color-line); border-radius: 16px; padding: 14px; }
  &__action-panel > strong { font-size: 14px; }
  &__action-panel p { margin: 0; color: var(--color-text-muted); font-size: 10px; line-height: 1.45; }
}

.game-primary-action { width: 100%; min-height: 52px; border: 0; border-radius: 14px; padding: 0 18px; color: var(--color-surface); background: var(--color-accent-strong); font: inherit; font-weight: 800; cursor: pointer; }
.game-primary-action:disabled { color: var(--color-text-primary); background: var(--color-surface-control); cursor: default; }
</style>

<style scoped lang="scss">
:deep(.run-away-dialog) { --sheet-dialog-max-width: 768px; }
:deep(.run-away-dialog .sheet-dialog__surface) { min-height: 502px; box-sizing: border-box; }
:deep(.run-away-dialog .sheet-dialog__header) { padding-inline: 4px; }
.run-away-sheet { min-width: 0; min-height: 390px; display: flex; flex-direction: column; gap: 12px; }
.run-away-sheet__rail { min-width: 0; display: flex; align-items: center; justify-content: safe center; gap: 58px; overflow-x: auto; padding: 6px; }
.run-away-sheet__rail button { position: relative; flex: 0 0 150px; height: 218px; display: grid; grid-template-rows: 92px auto auto minmax(0, 1fr); gap: 6px; overflow: hidden; box-sizing: border-box; border: 1px solid var(--color-line); border-radius: 14px; padding: 0; color: inherit; background: var(--color-surface-card); box-shadow: 0 7px 18px rgb(59 46 40 / 14%); font: inherit; font-weight: 400; text-align: left; }
.run-away-sheet__art { display: grid; place-items: center; color: var(--color-text-primary); background: color-mix(in srgb, var(--color-accent) 30%, var(--color-surface)); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.run-away-sheet__rail strong,
.run-away-sheet__rail small,
.run-away-sheet__rail p { margin: 0; padding-inline: 10px; }
.run-away-sheet__rail strong { padding-top: 4px; font-size: 11px; font-weight: 500; line-height: 14px; }
.run-away-sheet__rail small { color: var(--color-text-muted); font-size: 9px; }
.run-away-sheet__rail p { font-size: 10px; line-height: 14px; }
.run-away-sheet__status { position: absolute; left: 10px; bottom: 8px; color: var(--color-accent-strong); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.run-away-sheet__rail button:disabled { opacity: .62; }
.run-away-sheet__rail .run-away-sheet__monster--selected { border-color: var(--color-accent-strong); }
.run-away-sheet__progress { margin: 0; color: var(--color-text-muted); font-size: 11px; }
.run-away-sheet__effects,
.run-away-sheet__responses { display: flex; flex-wrap: wrap; gap: 8px; }
.run-away-sheet__effects span,
.run-away-sheet__responses button { min-height: 32px; border: 1px solid var(--color-line); border-radius: 999px; padding: 7px 12px; color: var(--color-text-secondary); background: var(--color-surface-control); font: inherit; font-size: 10px; }
.run-away-sheet__responses button[aria-pressed="true"] { border-color: var(--color-accent-strong); color: var(--color-surface); background: var(--color-accent-strong); }
.run-away-sheet__submit { width: min(100%, 328px); min-height: 52px; margin-top: auto; align-self: end; border: 0; border-radius: 14px; color: var(--color-surface); background: var(--color-accent-strong); font: inherit; font-weight: 800; }

@media (width < 1024px) {
  :deep(.run-away-dialog) { --sheet-dialog-compact-max-width: 560px; max-height: min(470px, calc(100dvh - 24px)); }
  .run-away-sheet { height: 100%; min-height: 0; }
  .run-away-sheet__rail { width: calc(100% + 4px); min-height: 218px; justify-content: start; gap: 12px; margin-left: 4px; padding: 0; }
  .run-away-sheet__progress { margin-left: 4px; }
  .run-away-sheet__submit { width: 100%; }
}

@media (width < 600px) {
  :deep(.run-away-dialog) { --sheet-dialog-mobile-width: 100%; }
}
</style>

<style scoped lang="scss">
.run-away-dialog .run-away-sheet__timer {
  min-width: 70px;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1px solid var(--color-status-warning, var(--color-action-response));
  border-radius: 12px;
  margin: 0;
  color: var(--color-status-warning, var(--color-action-response));
  background: var(--color-surface-raised, var(--color-surface));
  font-size: 14px;
  font-weight: 600;
}

@media (width <= 1023px) {
  .run-away-dialog .sheet-dialog__header > div {
    width: 100%;
  }

  .run-away-dialog .run-away-sheet__timer {
    position: absolute;
    top: -9px;
    right: 0;
  }
}
</style>
