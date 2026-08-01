<script setup lang="ts">
import {
  computed,
  nextTick,
  ref,
  watch,
} from "vue";
import type {
  CardView,
  Projection,
} from "@munchkin/contracts";

import type {GameConnectionState} from "../../composables/useGameSessionController";
import {useInteractionCountdown} from "../../composables/useInteractionCountdown";
import {
  actionIsSelectable,
  interactionActionDescription,
  interactionActionIntent,
  interactionActionKey,
  interactionActionLabel,
  interactionCanDismiss,
  interactionIsTerminal,
  interactionResponseMessage,
  interactionRevisionKey,
  interactionTitle,
  type InteractionActionView,
} from "./interactionModel";
import {
  formatAbsoluteDeadline,
  helperCancelAction,
  helperOfferAction,
  helperOfferOptions as buildHelperOfferOptions,
  helperRewardsFor,
  isCombatantHelperOffer,
  isInvitedHelperOffer,
  projectedPlayerName,
} from "./helperOfferModel";
import {
  advancedCombatActionDetails,
  advancedCombatActionLabel,
  advancedCombatActions,
  type AdvancedCombatAction,
} from "./advancedCombatModel";
import {
  isRunAwayInteraction,
  isTargetInteraction,
  runAwayCurrentPlayerName,
  runAwayMonsterName,
  runAwayState,
  targetPlayerName,
  targetRunAwayActionDetails,
  targetRunAwayActionLabel,
} from "./targetRunAwayModel";
import EconomySurface from "./EconomySurface.vue";
import {
  interactionHasCharityForm,
  type EconomySubmission,
} from "./economyModel";

const props = defineProps<{
  projection: Projection;
  connectionState: GameConnectionState;
  busy: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  submit: [action: InteractionActionView];
  "submit-economy": [request: EconomySubmission];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const selectedActionID = ref<string | null>(null);
const selectedHelperPlayerID = ref("");
const selectedRewardValue = ref("");
const helperFormError = ref("");
const surfaceOpen = ref(false);
const lastRevisionKey = ref("");
const dialogID = "game-interaction-dialog";
const helperErrorID = "interaction-helper-error";

const interaction = computed(() => props.projection.interaction);
const ownCards = computed<CardView[]>(() => [
  ...props.projection.you.hand,
  ...props.projection.you.carried,
  ...props.projection.you.equipped,
  ...props.projection.you.traits,
  ...props.projection.you.attachments,
  ...props.projection.you.persistent_curses,
]);
const selectableActions = computed(() =>
  (interaction.value?.actions ?? []).filter(actionIsSelectable),
);
const helperOptions = computed(() => buildHelperOfferOptions(
  interaction.value?.actions ?? [],
));
const helperOfferMode = computed(() => isCombatantHelperOffer(interaction.value));
const invitedHelperOffer = computed(() => isInvitedHelperOffer(interaction.value));
const targetInteraction = computed(() => isTargetInteraction(interaction.value)
  ? interaction.value
  : undefined);
const runAwayInteraction = computed(() => isRunAwayInteraction(interaction.value)
  ? interaction.value
  : undefined);
const economyOffer = computed(() => interaction.value?.economy_offer);
const charityForm = computed(() => interactionHasCharityForm(interaction.value));
const runAway = computed(() => runAwayState(props.projection));
const helperCancel = computed(() => helperCancelAction(interaction.value));
const helperRewardValues = computed(() => helperRewardsFor(
  helperOptions.value,
  selectedHelperPlayerID.value,
));
const selectedReward = computed(() => Number(selectedRewardValue.value));
const selectedHelperAction = computed(() => helperOfferAction(
  interaction.value?.actions ?? [],
  selectedHelperPlayerID.value,
  selectedReward.value,
));
const invitedCombatantName = computed(() => invitedHelperOffer.value
  ? projectedPlayerName(props.projection, props.projection.turn.player_id)
  : "");
const invitedDeadlineText = computed(() => invitedHelperOffer.value && interaction.value
  ? formatAbsoluteDeadline(interaction.value.deadline_at)
  : "");
const selectedAction = computed(() => selectableActions.value.find((action) =>
  action.action_id === selectedActionID.value,
));
const selectedActionIndex = computed(() => selectableActions.value.findIndex((action) =>
  action.action_id === selectedActionID.value,
));
const dismissible = computed(() => interaction.value
  ? interactionCanDismiss(interaction.value)
  : true);
const terminal = computed(() => interaction.value
  ? interactionIsTerminal(interaction.value)
  : false);
const responseStateMessage = computed(() => interactionResponseMessage(
  interaction.value?.my_response_state,
));
const countdown = useInteractionCountdown(
  () => interaction.value?.deadline_at,
  () => interaction.value?.server_time,
);
const countdownText = computed(() => countdown.expired.value
  ? "Срок по часам истёк; ждём актуальную проекцию сервера."
  : `Осталось примерно ${countdown.remainingSeconds.value} сек.`);
const connectionText = computed(() => {
  switch (props.connectionState) {
    case "offline":
      return "Связь потеряна. Последняя проекция окна сохранена.";
    case "resyncing":
      return "Сверяем окно с сервером…";
    case "failed":
      return "Ожидается ручное обновление проекции.";
    default:
      return "";
  }
});

function focusableElements(): HTMLElement[] {
  return Array.from(dialogRef.value?.querySelectorAll<HTMLElement>(
    "button:not([disabled]), input:not([disabled]), select:not([disabled]), "
      + "textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
  ) ?? []);
}

function focusDialog(): void {
  void nextTick(() => {
    const first = focusableElements()[0];
    first?.focus();
  });
}

function openSurface(): void {
  surfaceOpen.value = true;
  focusDialog();
}

function closeSurface(): void {
  if (!dismissible.value) {
    return;
  }
  surfaceOpen.value = false;
  void nextTick(() => triggerRef.value?.focus());
}

function handleBackdropClick(): void {
  closeSurface();
}

function handleDialogKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    if (dismissible.value) {
      event.preventDefault();
      closeSurface();
    }
    return;
  }
  if (event.key !== "Tab") {
    return;
  }
  const focusable = focusableElements();
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function selectAction(action: InteractionActionView): void {
  if (!actionIsSelectable(action) || terminal.value || props.busy) {
    return;
  }
  selectedActionID.value = action.action_id;
}

function resetHelperForm(): void {
  const firstOption = helperOptions.value[0];
  selectedHelperPlayerID.value = firstOption?.helperPlayerID ?? "";
  selectedRewardValue.value = firstOption?.rewardTreasures[0]?.toString() ?? "";
  helperFormError.value = "";
}

function submitHelperOffer(): void {
  const action = selectedHelperAction.value;
  if (!action) {
    helperFormError.value = "Выберите помощника и награду из текущей проекции.";
    return;
  }
  helperFormError.value = "";
  emit("submit", action);
}

function submitHelperCancel(): void {
  if (helperCancel.value && !props.busy) {
    emit("submit", helperCancel.value);
  }
}

function submitSelected(): void {
  const action = selectedAction.value;
  if (!action || terminal.value || props.busy) {
    return;
  }
  if (!interactionActionIntent(action)) {
    return;
  }
  emit("submit", action);
}

function isAdvancedCombatAction(
  action: InteractionActionView,
): action is AdvancedCombatAction {
  return advancedCombatActions([action]).length === 1;
}

function isTargetRunAwayAction(_action: InteractionActionView): boolean {
  return Boolean(targetInteraction.value || runAwayInteraction.value);
}

function actionLabelFor(action: InteractionActionView, actionIndex: number): string {
  if (action.theft_capability) {
    return "Выставить контрмеру";
  }
  if (isTargetRunAwayAction(action)) {
    return targetRunAwayActionLabel(action, actionIndex, ownCards.value);
  }
  if (isAdvancedCombatAction(action)) {
    return advancedCombatActionLabel(action);
  }
  return interactionActionLabel(action);
}

function actionDetailsFor(action: InteractionActionView): string[] {
  if (action.theft_capability) {
    return [
      "Собственная контркарта из текущей проекции.",
      "Итог и скрытые варианты остаются на сервере.",
    ];
  }
  if (isTargetRunAwayAction(action) && interaction.value) {
    return targetRunAwayActionDetails(
      action,
      props.projection,
      ownCards.value,
      interaction.value,
    );
  }
  if (isAdvancedCombatAction(action)) {
    return advancedCombatActionDetails(action, props.projection, ownCards.value);
  }
  return [interactionActionDescription(action, ownCards.value)];
}

watch(
  () => interactionRevisionKey(interaction.value),
  (revisionKey) => {
    if (revisionKey === lastRevisionKey.value) {
      return;
    }
    lastRevisionKey.value = revisionKey;
    if (!revisionKey) {
      selectedActionID.value = null;
      surfaceOpen.value = false;
      resetHelperForm();
      return;
    }
    selectedActionID.value = selectableActions.value[0]?.action_id ?? null;
    resetHelperForm();
    surfaceOpen.value = true;
    focusDialog();
  },
  {immediate: true},
);

watch(
  () => selectableActions.value.map((action) => actionActionKey(action)).join("|"),
  () => {
    if (!selectableActions.value.some((action) =>
      action.action_id === selectedActionID.value,
    )) {
      selectedActionID.value = selectableActions.value[0]?.action_id ?? null;
    }
  },
);

watch(
  () => selectedHelperPlayerID.value,
  (helperPlayerID) => {
    const rewards = helperRewardsFor(helperOptions.value, helperPlayerID);
    if (!rewards.includes(Number(selectedRewardValue.value))) {
      selectedRewardValue.value = rewards[0]?.toString() ?? "";
    }
    helperFormError.value = "";
  },
);

function actionActionKey(action: InteractionActionView): string {
  return interactionActionKey(action);
}
</script>

<template>
  <section
    v-if="interaction"
    class="interaction-surface"
    data-testid="interaction-surface"
    :data-state="terminal ? 'terminal' : busy ? 'pending' : 'open'"
  >
    <aside class="interaction-inbox" data-testid="interaction-inbox">
      <div>
        <p class="eyebrow">ВХОДЯЩЕЕ ВЗАИМОДЕЙСТВИЕ</p>
        <strong>{{ interactionTitle(interaction) }}</strong>
        <span v-if="interaction.response_required_for_you">Требуется решение</span>
        <span v-else>Окно открыто для текущей проекции</span>
      </div>
      <button
        ref="triggerRef"
        type="button"
        :aria-controls="dialogID"
        :aria-expanded="surfaceOpen"
        @click="openSurface"
      >
        {{ surfaceOpen ? "Окно открыто" : "Открыть окно" }}
      </button>
    </aside>

    <div
      v-if="surfaceOpen"
      class="interaction-backdrop"
      data-testid="interaction-backdrop"
      @click.self="handleBackdropClick"
    >
      <section
        :id="dialogID"
        ref="dialogRef"
        class="interaction-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interaction-dialog-title"
        tabindex="-1"
        @keydown="handleDialogKeydown"
      >
        <header class="interaction-dialog__header">
          <div>
            <p class="eyebrow">СЕРВЕРНОЕ ОКНО</p>
            <h2 id="interaction-dialog-title">{{ interactionTitle(interaction) }}</h2>
            <p class="interaction-dialog__context">
              {{ helperOfferMode
                ? "Выберите только помощника и награду из текущих дескрипторов."
                : charityForm
                ? "Назначьте ровно server-required excess карт; transfer произойдёт после подтверждения."
                : economyOffer
                ? "Детали карт видны только сторонам предложения; observer получает opaque окно."
                : targetInteraction
                ? "Цель, private choice и counter доступны только из actor-specific дескрипторов."
                : runAwayInteraction
                ? "Шаг побега и его исход меняются только новой проекцией сервера."
                : interaction.response_required_for_you
                ? "Выберите только действие, которое передала текущая проекция."
                : "Окно остаётся видимым, даже если сейчас нет действия для этого игрока." }}
            </p>
          </div>
          <button
            v-if="dismissible"
            class="interaction-dialog__close"
            type="button"
            aria-label="Свернуть окно взаимодействия"
            @click="closeSurface"
          >
            Свернуть
          </button>
        </header>

        <div class="interaction-dialog__status" aria-live="polite">
          <p v-if="responseStateMessage" role="status">{{ responseStateMessage }}</p>
          <p v-else-if="connectionText" role="status">{{ connectionText }}</p>
          <p v-else-if="interaction.response_required_for_you" role="status">
            Решение принадлежит текущему игроку.
          </p>
          <p v-else role="status">Текущее окно доступно только по проекции сервера.</p>
        </div>

        <p class="interaction-countdown" role="timer" aria-live="off">
          {{ countdownText }}
        </p>

        <section
          v-if="targetInteraction"
          class="interaction-domain-summary"
          aria-label="Цель эффекта"
        >
          <p class="eyebrow">ЦЕЛЕВОЙ ЭФФЕКТ</p>
          <p v-if="targetInteraction.target_player_id">
            Цель:
            <strong>{{ targetPlayerName(projection, targetInteraction.target_player_id) }}</strong>
          </p>
          <p v-if="targetInteraction.public_kind === 'private_choice'">
            Варианты выбора доступны только текущему игроку.
          </p>
          <p v-else>
            Окно ответа остаётся opaque; наличие counter у других игроков не раскрывается.
          </p>
        </section>

        <section
          v-if="runAwayInteraction && runAway"
          class="interaction-domain-summary"
          aria-label="Текущий шаг побега"
        >
          <p class="eyebrow">ТЕКУЩИЙ ШАГ ПОБЕГА</p>
          <p>
            Участник:
            <strong>{{ runAwayCurrentPlayerName(projection) }}</strong>
          </p>
          <p>
            Монстр:
            <strong>{{ runAwayMonsterName(projection, runAway.current_monster_instance_id) }}</strong>
          </p>
          <p>
            Срок —
            <time :datetime="interaction.deadline_at">
              {{ formatAbsoluteDeadline(interaction.deadline_at) }}
            </time>; часы advisory.
          </p>
        </section>

        <section
          v-if="interaction.public_kind === 'economy_offer'"
          class="interaction-domain-summary interaction-domain-summary--offer"
          aria-label="Предложение обмена или подарка"
        >
          <p class="eyebrow">ПРЕДЛОЖЕНИЕ</p>
          <template v-if="economyOffer">
            <p>
              {{ economyOffer.kind === "trade" ? "Обмен" : "Подарок" }} от
              <strong>{{ projectedPlayerName(projection, economyOffer.offerer_player_id) }}</strong>
              игроку
              <strong>{{ projectedPlayerName(projection, economyOffer.recipient_player_id) }}</strong>
            </p>
            <div class="interaction-card-columns">
              <div>
                <span>Передаётся</span>
                <ul>
                  <li v-for="card in economyOffer.offered" :key="card.instance_id">
                    {{ card.name }}
                  </li>
                </ul>
              </div>
              <div>
                <span>{{ economyOffer.kind === "trade" ? "Запрошено" : "Оговорка" }}</span>
                <ul v-if="economyOffer.requested.length">
                  <li v-for="card in economyOffer.requested" :key="card.instance_id">
                    {{ card.name }}
                  </li>
                </ul>
                <p v-else>Подарок без встречной передачи.</p>
              </div>
            </div>
          </template>
          <p v-else>
            Детали предложения доступны только участникам; identities карт observer не видит.
          </p>
        </section>

        <section
          v-if="invitedHelperOffer && interaction.combat_help_offer"
          class="interaction-helper-summary"
          aria-label="Предложение помощи"
        >
          <p class="eyebrow">ПРЕДЛОЖЕНИЕ ПОМОЩИ</p>
          <p>Участник боя: <strong>{{ invitedCombatantName }}</strong></p>
          <p>Награда: <strong>{{ interaction.combat_help_offer.reward_treasures }} сокр.</strong></p>
          <p>
            Срок до
            <time :datetime="interaction.deadline_at">{{ invitedDeadlineText }}</time>
          </p>
        </section>

        <div v-if="errorMessage" class="interaction-dialog__error" role="alert">
          {{ errorMessage }}
        </div>

        <EconomySurface
          v-if="charityForm && interaction"
          :projection="projection"
          :interaction="interaction"
          :busy="busy"
          @submit="emit('submit-economy', $event)"
        />

        <form
          v-if="helperOfferMode"
          class="interaction-helper-form"
          novalidate
          @submit.prevent="submitHelperOffer"
        >
          <fieldset :disabled="busy || terminal">
            <legend>Параметры предложения</legend>
            <label for="interaction-helper-player">Помощник</label>
            <select
              id="interaction-helper-player"
              v-model="selectedHelperPlayerID"
              required
              :aria-describedby="helperFormError ? helperErrorID : undefined"
              :aria-invalid="helperFormError ? 'true' : undefined"
            >
              <option
                v-for="option in helperOptions"
                :key="option.helperPlayerID"
                :value="option.helperPlayerID"
              >
                {{ projectedPlayerName(projection, option.helperPlayerID) }}
              </option>
            </select>

            <label for="interaction-helper-reward">Награда помощнику, сокровищ</label>
            <input
              id="interaction-helper-reward"
              v-model="selectedRewardValue"
              type="number"
              inputmode="numeric"
              :min="helperRewardValues[0]"
              :max="helperRewardValues[helperRewardValues.length - 1]"
              step="1"
              required
              :aria-describedby="helperFormError ? helperErrorID : undefined"
              :aria-invalid="helperFormError ? 'true' : undefined"
              @input="helperFormError = ''"
            >
            <small v-if="helperRewardValues.length">
              Доступно по текущей проекции: {{ helperRewardValues.join(", ") }}.
            </small>
          </fieldset>
          <p v-if="helperFormError" :id="helperErrorID" role="alert">
            {{ helperFormError }}
          </p>
          <button
            class="interaction-dialog__submit"
            type="submit"
            :disabled="busy || terminal || !selectedHelperAction"
          >
            {{ busy ? "Отправляем предложение…" : "Предложить помощь" }}
          </button>
        </form>

        <p
          v-if="!interaction.actions.length && !charityForm"
          class="interaction-dialog__opaque"
          role="status"
        >
          Окно открыто. Сейчас нет действия для этого игрока.
        </p>

        <p
          v-else-if="!selectableActions.length && !helperOfferMode && !helperCancel && !charityForm"
          class="interaction-dialog__opaque"
          role="status"
        >
          Это действие будет доступно в специализированном окне.
        </p>

        <fieldset
          v-else-if="selectableActions.length"
          class="interaction-actions"
          :disabled="busy || terminal"
        >
          <legend>Доступные действия текущего окна</legend>
          <label
            v-for="(action, actionIndex) in selectableActions"
            :key="interactionActionKey(action)"
            class="interaction-action"
            :class="{
              'interaction-action--selected': action.action_id === selectedActionID,
              'interaction-action--advanced': isAdvancedCombatAction(action),
              'interaction-action--domain': isTargetRunAwayAction(action),
            }"
            :data-state="action.action_id === selectedActionID ? 'selected' : 'available'"
          >
            <input
              type="radio"
              name="interaction-action"
              :value="action.action_id"
              :checked="action.action_id === selectedActionID"
              :disabled="busy || terminal"
              @change="selectAction(action)"
            >
            <span>
              <strong>{{ actionLabelFor(action, actionIndex) }}</strong>
              <small>{{ actionDetailsFor(action).join(" · ") }}</small>
            </span>
          </label>
        </fieldset>

        <footer class="interaction-dialog__footer">
          <button
            v-if="helperCancel"
            class="interaction-dialog__submit interaction-dialog__submit--secondary"
            type="button"
            :disabled="busy || terminal"
            @click="submitHelperCancel"
          >
            {{ busy ? "Отменяем…" : "Отменить предложение" }}
          </button>
          <button
            v-else-if="selectedAction"
            class="interaction-dialog__submit"
            type="button"
            :disabled="busy || terminal"
            @click="submitSelected"
          >
            {{ busy ? "Отправляем…" : actionLabelFor(selectedAction, selectedActionIndex) }}
          </button>
          <span v-else-if="!helperOfferMode && !charityForm" class="interaction-dialog__submit-placeholder">
            Действие недоступно
          </span>
          <small>Окончательное решение принимает сервер.</small>
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.interaction-surface {
  position: relative;
  z-index: 40;
  min-width: 0;
}

.interaction-inbox {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
  border: 1px solid var(--acid);
  padding: .75rem 1rem;
  background: #191d0e;
  box-shadow: 0 8px 24px rgb(0 0 0 / 20%);
}

.interaction-inbox > div {
  display: grid;
  gap: .25rem;
  min-width: 0;
}

.interaction-inbox .eyebrow {
  margin: 0;
}

.interaction-inbox strong,
.interaction-inbox span {
  overflow-wrap: anywhere;
}

.interaction-inbox span {
  color: var(--muted);
  font-size: .82rem;
}

.interaction-inbox button,
.interaction-dialog button {
  min-height: 2.75rem;
}

.interaction-backdrop {
  position: fixed;
  z-index: 50;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  overflow-y: auto;
  background: rgb(0 0 0 / 68%);
}

.interaction-dialog {
  width: min(100%, 42rem);
  max-height: min(90dvh, 52rem);
  display: grid;
  gap: 1rem;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid var(--acid);
  padding: 1.25rem;
  background: var(--color-board);
  box-shadow: 0 22px 80px rgb(0 0 0 / 45%);
}

.interaction-dialog__header,
.interaction-dialog__footer {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
}

.interaction-dialog__header > div,
.interaction-dialog__footer > * {
  min-width: 0;
  max-width: 100%;
}

.interaction-dialog__header h2 {
  margin: .35rem 0 0;
  overflow-wrap: anywhere;
}

.interaction-dialog__context,
.interaction-dialog__status p,
.interaction-dialog__footer small {
  margin: .35rem 0 0;
  color: var(--muted);
  line-height: 1.45;
}

.interaction-dialog__status {
  min-height: 1.5rem;
}

.interaction-countdown {
  margin: 0;
  color: var(--acid);
  font-variant-numeric: tabular-nums;
}

.interaction-domain-summary {
  display: grid;
  gap: .35rem;
  min-width: 0;
  border: 1px solid var(--line);
  padding: .8rem;
  overflow-wrap: anywhere;
  line-height: 1.45;
}

.interaction-domain-summary p {
  margin: 0;
}

.interaction-domain-summary .eyebrow {
  color: var(--acid);
}

.interaction-card-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: .75rem;
}

.interaction-card-columns > div {
  min-width: 0;
  border: 1px solid var(--line);
  padding: .6rem;
}

.interaction-card-columns span {
  color: var(--muted);
  font-size: .75rem;
  text-transform: uppercase;
}

.interaction-card-columns ul {
  display: grid;
  gap: .35rem;
  margin: .45rem 0 0;
  padding-left: 1.1rem;
}

.interaction-card-columns p {
  margin: .45rem 0 0;
  color: var(--muted);
}

.interaction-domain-summary time {
  color: var(--acid);
  font-variant-numeric: tabular-nums;
}

.interaction-dialog__error {
  border: 1px solid #ef8d74;
  padding: .75rem;
  color: #ffd2c6;
  line-height: 1.45;
}

.interaction-helper-summary,
.interaction-helper-form {
  display: grid;
  gap: .65rem;
  min-width: 0;
  border: 1px solid var(--line);
  padding: .85rem;
}

.interaction-helper-summary p,
.interaction-helper-form p,
.interaction-helper-form small {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.45;
}

.interaction-helper-summary .eyebrow {
  color: var(--acid);
}

.interaction-helper-summary time {
  color: var(--acid);
  font-variant-numeric: tabular-nums;
}

.interaction-helper-form fieldset {
  display: grid;
  gap: .55rem;
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

.interaction-helper-form legend {
  margin-bottom: .15rem;
  color: var(--muted);
  font-size: .8rem;
  text-transform: uppercase;
}

.interaction-helper-form select,
.interaction-helper-form input {
  width: 100%;
  min-height: 2.75rem;
  border: 1px solid var(--line);
  padding: .55rem .65rem;
  color: inherit;
  background: var(--color-board);
  font: inherit;
}

.interaction-helper-form select:focus-visible,
.interaction-helper-form input:focus-visible {
  outline: 2px solid var(--acid);
  outline-offset: 2px;
}

.interaction-helper-form [aria-invalid="true"] {
  border-color: #ef8d74;
}

.interaction-helper-form > p[role="alert"] {
  color: #ffd2c6;
}

.interaction-dialog__opaque {
  margin: 0;
  border: 1px dashed var(--line);
  padding: 1rem;
  color: var(--muted);
  line-height: 1.45;
}

.interaction-actions {
  display: grid;
  gap: .65rem;
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

.interaction-actions legend {
  margin-bottom: .25rem;
  color: var(--muted);
  font-size: .8rem;
  text-transform: uppercase;
}

.interaction-action {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: .75rem;
  border: 1px solid var(--line);
  padding: .8rem;
  cursor: pointer;
}

.interaction-action--selected {
  border-color: var(--acid);
  background: #20270d;
}

.interaction-action--advanced strong {
  color: var(--acid);
}

.interaction-action--domain {
  border-color: #65751f;
}

.interaction-action--domain strong {
  color: var(--acid);
}

.interaction-action--unsupported {
  cursor: not-allowed;
  opacity: .68;
}

.interaction-action input {
  margin-top: .25rem;
}

.interaction-action span {
  display: grid;
  gap: .25rem;
  min-width: 0;
}

.interaction-action small {
  color: var(--muted);
  line-height: 1.4;
}

.interaction-dialog__footer {
  align-items: center;
  flex-wrap: wrap;
}

.interaction-dialog__submit {
  min-width: min(100%, 16rem);
}

.interaction-dialog__submit--secondary {
  border-color: var(--line);
  color: var(--muted);
  background: transparent;
}

.interaction-dialog__submit-placeholder {
  color: var(--muted);
}

.interaction-dialog__footer small {
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .interaction-backdrop,
  .interaction-dialog,
  .interaction-action {
    scroll-behavior: auto;
    transition: none;
  }
}

@media (width <= 767px) {
  .interaction-backdrop {
    align-items: end;
    padding: 0;
  }

  .interaction-dialog {
    width: 100%;
    max-height: min(88dvh, 48rem);
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    padding: 1rem calc(1rem + env(safe-area-inset-right, 0px))
      calc(1rem + env(safe-area-inset-bottom, 0px))
      calc(1rem + env(safe-area-inset-left, 0px));
  }
}

@media (width <= 420px) {
  .interaction-inbox {
    align-items: start;
    flex-direction: column;
  }

  .interaction-inbox button {
    width: 100%;
  }

  .interaction-dialog__header {
    flex-direction: column;
  }

  .interaction-dialog__close {
    align-self: start;
  }

  .interaction-dialog__footer {
    align-items: stretch;
    flex-direction: column;
  }

  .interaction-dialog__submit,
  .interaction-dialog__submit-placeholder {
    width: 100%;
  }
}

@media (forced-colors: active) {
  .interaction-inbox,
  .interaction-dialog,
  .interaction-action,
  .interaction-dialog__error {
    border-color: CanvasText;
    forced-color-adjust: none;
  }
}
</style>
