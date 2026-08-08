<script setup lang="ts">
import {computed, nextTick, ref, watch} from "vue";
import type {
  CardView,
  InteractionView,
  Projection,
} from "@munchkin/contracts";

import type {GameConnectionState} from "../../composables/useGameSessionController";
import {useInteractionCountdown} from "../../composables/useInteractionCountdown";
import AdvancedCombatSurface from "./domains/AdvancedCombatSurface.vue";
import AcceptedHelperSummary from "./domains/AcceptedHelperSummary.vue";
import EconomyOfferSummary from "./domains/EconomyOfferSummary.vue";
import HelperOfferSurface from "./domains/HelperOfferSurface.vue";
import TargetRunAwaySurface from "./domains/TargetRunAwaySurface.vue";
import InteractionActionList from "./core/InteractionActionList.vue";
import InteractionDialog from "./core/InteractionDialog.vue";
import DeathLootSurface from "./DeathLootSurface.vue";
import {
  advancedCombatActionDetails,
  advancedCombatActionLabel,
  advancedCombatActions,
  type AdvancedCombatAction,
} from "./advancedCombatModel";
import {
  interactionHasCharityForm,
} from "./economyModel";
import {
  actionIsSelectable,
  interactionActionDescription,
  interactionActionIntent,
  interactionActionLabel,
  interactionCanDismiss,
  interactionIsTerminal,
  interactionResponseMessage,
  interactionRevisionKey,
  interactionTitle,
  type InteractionActionView,
} from "./interactionModel";
import {
  acceptedCombatHelper,
  formatAbsoluteDeadline,
  isCombatantHelperOffer,
  isInvitedHelperOffer,
} from "./helperOfferModel";
import {
  isRunAwayInteraction,
  isTargetInteraction,
  targetRunAwayActionDetails,
  targetRunAwayActionLabel,
} from "./targetRunAwayModel";
import {isDeathLootInteraction} from "./deathLootModel";

const props = defineProps<{
  projection: Projection;
  connectionState: GameConnectionState;
  busy: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  submit: [action: InteractionActionView];
}>();

const surfaceOpen = ref(false);
const selectedActionID = ref<string | null>(null);
const lastSurfaceKey = ref("");
const deathLootClosureNotice = ref("");
const deathLootClosureNoticeRef = ref<HTMLElement | null>(null);

const interaction = computed<InteractionView | undefined>(() =>
  props.projection.interaction,
);
const acceptedHelper = computed(() => acceptedCombatHelper(props.projection));
const activeSurface = computed(() => Boolean(
  interaction.value || acceptedHelper.value || showRunAwaySummary.value
    || deathLootClosureNotice.value,
));
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
const targetInteraction = computed(() => isTargetInteraction(interaction.value)
  ? interaction.value
  : undefined);
const runAwayInteraction = computed(() => isRunAwayInteraction(interaction.value)
  ? interaction.value
  : undefined);
const runAwayProjection = computed(() => props.projection.turn.run_away);
const showRunAwaySummary = computed(() => Boolean(
  runAwayProjection.value && (
    runAwayProjection.value.attempts.length > 0 || runAwayProjection.value.completed
  ),
));
const helperOfferMode = computed(() => isCombatantHelperOffer(interaction.value));
const invitedHelperOffer = computed(() => isInvitedHelperOffer(interaction.value));
const charityForm = computed(() => interactionHasCharityForm(interaction.value));
const deathLootInteraction = computed(() =>
  isDeathLootInteraction(interaction.value)
    ? interaction.value
    : undefined,
);
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
const surfaceTitle = computed(() => interaction.value
  ? interactionTitle(interaction.value)
  : "Взаимодействие");
const dialogEyebrow = computed(() => {
  if (charityForm.value) {
    return "БЛАГОТВОРИТЕЛЬНОСТЬ";
  }
  if (helperOfferMode.value || invitedHelperOffer.value) {
    return "ПОМОЩЬ";
  }
  if (interaction.value?.response_required_for_you) {
    return "ОТВЕТ НА ВМЕШАТЕЛЬСТВО";
  }
  return "СЕРВЕРНОЕ ОКНО";
});
const surfaceContext = computed(() => {
  if (helperOfferMode.value) {
    return "Выберите только помощника и награду из текущих дескрипторов.";
  }
  if (charityForm.value) {
    return "Рука и точное число передач показаны в обязательном листе.";
  }
  if (interaction.value?.response_required_for_you) {
    return "Выберите только действие, которое передала текущая проекция.";
  }
  return "Окно остаётся видимым, даже если сейчас нет действия для этого игрока.";
});
const statusMessage = computed(() => {
  if (props.connectionState === "offline") {
    return "Связь потеряна — ждём сервер.";
  }
  if (props.connectionState === "resyncing") {
    return "Сверяем проекцию с сервером…";
  }
  if (props.connectionState === "failed") {
    return "Сервер не подтвердил обновление проекции.";
  }
  if (responseStateMessage.value) {
    return responseStateMessage.value;
  }
  return interaction.value?.response_required_for_you
    ? "Решение принадлежит текущему игроку."
    : "Текущее окно доступно только по проекции сервера.";
});
const countdown = useInteractionCountdown(
  () => interaction.value?.deadline_at,
  () => interaction.value?.server_time,
);
const countdownText = computed(() => {
  if (!interaction.value) {
    return "";
  }
  return countdown.expired.value
    ? "Время вышло — ждём сервер"
    : `Осталось примерно ${countdown.remainingSeconds.value} сек.`;
});
const deadlineLabel = computed(() => interaction.value
  ? formatAbsoluteDeadline(interaction.value.deadline_at)
  : "");
const surfaceKey = computed(() => [
  interactionRevisionKey(interaction.value),
  deathLootClosureNotice.value,
  acceptedHelper.value
    ? `${acceptedHelper.value.helperPlayerID}:${acceptedHelper.value.rewardTreasures}`
    : "",
].join("::"));

function selectAction(action: InteractionActionView): void {
  if (!actionIsSelectable(action) || terminal.value || props.busy) {
    return;
  }
  selectedActionID.value = action.action_id;
}

function submitSelected(): void {
  const action = selectedAction.value;
  if (!action || terminal.value || props.busy || !interactionActionIntent(action)) {
    return;
  }
  emit("submit", action);
}

function isAdvancedCombatAction(
  action: InteractionActionView,
): action is AdvancedCombatAction {
  return advancedCombatActions([action]).length === 1;
}

function actionLabelFor(action: InteractionActionView, actionIndex: number): string {
  if (interaction.value?.public_kind === "private_choice" && action.choice_ids?.length) {
    const names = action.choice_ids.map((instanceID) =>
      ownCards.value.find((card) => card.instance_id === instanceID)?.name,
    ).filter((name): name is string => Boolean(name));
    if (names.length) return names.join(" · ");
  }
  if (action.theft_capability) {
    return "Выставить контрмеру";
  }
  if (targetInteraction.value || runAwayInteraction.value) {
    if (
      runAwayInteraction.value &&
      action.type === "pass" &&
      props.projection.turn.run_away?.current_player_id === props.projection.you.player_id
    ) {
      return "Бросить на смывку";
    }
    return targetRunAwayActionLabel(action, actionIndex, ownCards.value);
  }
  if (isAdvancedCombatAction(action)) {
    return advancedCombatActionLabel(action);
  }
  return interactionActionLabel(action);
}

function actionDetailsFor(action: InteractionActionView): string[] {
  if (interaction.value?.public_kind === "private_choice" && action.choice_ids?.length) {
    return ["Подтвердить этот серверно разрешённый вариант."];
  }
  if (action.theft_capability) {
    return [
      "Собственная контркарта из текущей проекции.",
      "Итог и скрытые варианты остаются на сервере.",
    ];
  }
  if ((targetInteraction.value || runAwayInteraction.value) && interaction.value) {
    if (
      runAwayInteraction.value &&
      action.type === "pass" &&
      props.projection.turn.run_away?.current_player_id === props.projection.you.player_id
    ) {
      return [
        "Закрыть окно ответов для себя.",
        "После ответов остальных участников сервер сам бросит D6.",
      ];
    }
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
  () => surfaceKey.value,
  (key) => {
    if (key === lastSurfaceKey.value) {
      return;
    }
    lastSurfaceKey.value = key;
    if (!activeSurface.value) {
      selectedActionID.value = null;
      surfaceOpen.value = false;
      return;
    }
    selectedActionID.value = selectableActions.value[0]?.action_id ?? null;
    surfaceOpen.value = Boolean(interaction.value);
  },
  {immediate: true},
);

watch(
  () => selectableActions.value.map((action) => action.action_id).join("|"),
  () => {
    if (!selectableActions.value.some((action) =>
      action.action_id === selectedActionID.value,
    )) {
      selectedActionID.value = selectableActions.value[0]?.action_id ?? null;
    }
  },
);

watch(
  [() => props.projection.version, () => interaction.value],
  ([version, nextInteraction], [previousVersion, previousInteraction]) => {
    if (nextInteraction) {
      deathLootClosureNotice.value = "";
      return;
    }
    if (
      previousVersion === undefined ||
      version <= previousVersion ||
      !previousInteraction ||
      previousInteraction.public_kind !== "death_loot_priority" ||
      previousInteraction.death_loot === undefined
    ) {
      return;
    }
    deathLootClosureNotice.value =
      "Окно приоритета добычи закрыто сервером. Подтверждённый итог находится в свежей projection; клиент не достраивает выбор.";
    void nextTick(() => deathLootClosureNoticeRef.value?.focus());
  },
  {flush: "post"},
);
</script>

<template>
  <section
    v-if="activeSurface"
    class="interaction-surface"
    data-testid="interaction-surface"
    :data-state="terminal ? 'terminal' : busy ? 'pending' : 'open'"
    :tabindex="showRunAwaySummary && !interaction ? 0 : undefined"
  >
    <AcceptedHelperSummary
      v-if="acceptedHelper"
      :projection="projection"
    />

    <TargetRunAwaySurface
      v-if="showRunAwaySummary && !interaction"
      :projection="projection"
    />

    <InteractionDialog
      v-if="interaction"
      v-model:open="surfaceOpen"
      :title="surfaceTitle"
      :context="surfaceContext"
      :dismissible="dismissible"
      :busy="busy"
      :connection-state="connectionState"
      :status-message="statusMessage"
      :error-message="errorMessage"
      :countdown-text="countdownText"
      :deadline-at="interaction?.deadline_at"
      :deadline-label="deadlineLabel"
      :eyebrow="dialogEyebrow"
      :desktop-inline="Boolean(deathLootInteraction)"
      :inbox-status="interaction?.response_required_for_you
        ? 'Требуется решение'
        : 'Окно открыто для текущей проекции'"
    >
      <AdvancedCombatSurface
        v-if="interaction?.public_kind === 'combat_response'"
        :projection="projection"
      />

      <TargetRunAwaySurface
        v-if="(interaction && (targetInteraction || runAwayInteraction)) || showRunAwaySummary"
        :projection="projection"
        :interaction="interaction"
      />

      <EconomyOfferSummary
        v-if="interaction"
        :projection="projection"
        :interaction="interaction"
      />

      <HelperOfferSurface
        v-if="interaction && (helperOfferMode || invitedHelperOffer)"
        :projection="projection"
        :interaction="interaction"
        :busy="busy"
        :terminal="terminal"
        @submit="emit('submit', $event)"
      />

      <DeathLootSurface
        v-if="deathLootInteraction"
        :interaction="deathLootInteraction"
        :busy="busy"
        @submit="emit('submit', $event)"
      />

      <p
        v-if="interaction && !deathLootInteraction && !interaction.actions.length && !charityForm"
        class="interaction-opaque"
        role="status"
      >
        Окно открыто. Сейчас нет действия для этого игрока.
      </p>

      <p
        v-else-if="interaction && !deathLootInteraction && !selectableActions.length
          && !helperOfferMode && !invitedHelperOffer && !charityForm"
        class="interaction-opaque"
        role="status"
      >
        Это действие будет доступно в специализированном окне.
      </p>

      <InteractionActionList
        v-if="interaction && !deathLootInteraction && selectableActions.length"
        :actions="selectableActions"
        :selected-action-id="selectedActionID"
        :busy="busy"
        :terminal="terminal"
        :label-for="actionLabelFor"
        :details-for="actionDetailsFor"
        @select="selectAction"
      />

      <template #footer>
        <button
          v-if="interaction && !deathLootInteraction && selectedAction"
          class="interaction-submit"
          type="button"
          :disabled="busy || terminal"
          @click="submitSelected"
        >
          {{ busy ? "Отправляем…" : actionLabelFor(selectedAction, selectedActionIndex) }}
        </button>
        <span
          v-else-if="interaction && !deathLootInteraction && !helperOfferMode && !charityForm"
          class="interaction-submit-placeholder"
        >
          Действие недоступно
        </span>
        <small>Окончательное решение принимает сервер.</small>
      </template>
    </InteractionDialog>

    <p
      v-if="deathLootClosureNotice"
      ref="deathLootClosureNoticeRef"
      class="interaction-closure-notice"
      data-testid="death-loot-closure-notice"
      role="status"
      aria-live="polite"
      tabindex="-1"
    >
      {{ deathLootClosureNotice }}
    </p>
  </section>
</template>

<style scoped>
.interaction-surface {
  min-width: 0;
}

.interaction-info-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .6rem;
}

.interaction-submit {
  min-width: min(100%, 16rem);
}

.interaction-submit-placeholder {
  color: var(--color-text-muted, #9eaa8e);
}

.interaction-opaque,
.interaction-closure-notice {
  margin: 0;
  border: 1px dashed var(--color-line, #566044);
  padding: 1rem;
  color: var(--color-text-muted, #9eaa8e);
  line-height: 1.45;
}

.interaction-closure-notice {
  border-color: var(--color-accent-strong);
  color: var(--color-accent-strong);
}

.interaction-closure-notice:focus-visible {
  outline: 2px solid var(--color-accent-strong);
  outline-offset: 3px;
}
</style>
