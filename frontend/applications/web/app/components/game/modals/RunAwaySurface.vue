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

const props = defineProps<{
  projection: Projection;
  interaction: InteractionView;
  busy: boolean;
}>();

const emit = defineEmits<{
  submit: [action: InteractionActionView];
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
  <SheetDialog
    v-if="interaction?.response_required_for_you"
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
:deep(.run-away-dialog) { --sheet-dialog-max-width: 768px; }
:deep(.run-away-dialog .sheet-dialog__surface) { min-height: 502px; box-sizing: border-box; }
:global(.run-away-dialog .sheet-dialog__header) { padding-inline: 4px; }
.run-away-sheet { min-width: 0; min-height: 390px; display: flex; flex-direction: column; gap: 12px; }
.run-away-sheet__rail { min-width: 0; display: flex; align-items: center; justify-content: safe center; gap: 58px; overflow-x: auto; padding: 6px; }
.run-away-sheet__rail button { position: relative; flex: 0 0 150px; height: 218px; display: grid; grid-template-rows: 92px auto auto minmax(0, 1fr); gap: 6px; overflow: hidden; box-sizing: border-box; border: 1px solid var(--color-line); border-radius: 14px; padding: 0; color: inherit; background: var(--color-surface-card); box-shadow: 0 7px 18px rgb(59 46 40 / 14%); font: inherit; font-weight: 400; text-align: left; }
.run-away-sheet__art { display: grid; place-items: center; color: #2d342f; background: #aabdb5; font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.run-away-sheet__rail strong,
.run-away-sheet__rail small,
.run-away-sheet__rail p { margin: 0; padding-inline: 10px; }
.run-away-sheet__rail strong { padding-top: 4px; font-size: 11px; font-weight: 500; line-height: 14px; }
.run-away-sheet__rail small { color: var(--color-text-muted); font-size: 9px; }
.run-away-sheet__rail p { font-size: 10px; line-height: 14px; }
.run-away-sheet__status { position: absolute; left: 10px; bottom: 8px; color: var(--color-accent-strong); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.run-away-sheet__rail button:disabled { opacity: .62; }
.run-away-sheet__monster--selected { border-color: var(--color-accent-strong) !important; }
.run-away-sheet__progress { margin: 0; color: var(--color-text-muted); font-size: 11px; }
.run-away-sheet__effects,
.run-away-sheet__responses { display: flex; flex-wrap: wrap; gap: 8px; }
.run-away-sheet__effects span,
.run-away-sheet__responses button { min-height: 32px; border: 1px solid var(--color-line); border-radius: 999px; padding: 7px 12px; color: var(--color-text-secondary); background: var(--color-surface-control); font: inherit; font-size: 10px; }
.run-away-sheet__responses button[aria-pressed="true"] { border-color: var(--color-accent-strong); color: #fff9ef; background: var(--color-accent-strong); }
.run-away-sheet__submit { width: min(100%, 328px); min-height: 52px; margin-top: auto; align-self: end; border: 0; border-radius: 14px; color: #fff9ef; background: var(--color-accent-strong); font: inherit; font-weight: 800; }

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

<style lang="scss">
.run-away-dialog .run-away-sheet__timer {
  min-width: 70px;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1px solid var(--color-status-warning, #765044);
  border-radius: 12px;
  margin: 0;
  color: var(--color-status-warning, #765044);
  background: var(--color-surface-raised, #fffdf8);
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
