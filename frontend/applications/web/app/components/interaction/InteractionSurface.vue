<script setup lang="ts">
import {computed, ref, watch} from "vue";
import type {
  CardView,
  InteractionView,
  Projection,
} from "@munchkin/contracts";

import type {GameConnectionState} from "../../composables/useGameSessionController";
import {useInteractionCountdown} from "../../composables/useInteractionCountdown";
import AdvancedCombatSurface from "./domains/AdvancedCombatSurface.vue";
import EconomyOfferSummary from "./domains/EconomyOfferSummary.vue";
import HelperOfferSurface from "./domains/HelperOfferSurface.vue";
import TargetInteractionSurface from "./domains/TargetInteractionSurface.vue";
import InteractionActionList from "./core/InteractionActionList.vue";
import InteractionDialog from "./core/InteractionDialog.vue";
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
  formatAbsoluteDeadline,
  isCombatantHelperOffer,
  isInvitedHelperOffer,
} from "./helperOfferModel";
import {
  isTargetInteraction,
  targetRunAwayActionDetails,
  targetRunAwayActionLabel,
} from "./targetRunAwayModel";

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

const interaction = computed<InteractionView | undefined>(() =>
  props.projection.interaction,
);
const activeSurface = computed(() => Boolean(interaction.value));
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
const helperOfferMode = computed(() => isCombatantHelperOffer(interaction.value));
const invitedHelperOffer = computed(() => isInvitedHelperOffer(interaction.value));
const charityForm = computed(() => interactionHasCharityForm(interaction.value));
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
const figmaNode = computed(() => {
  if (helperOfferMode.value) return "293:1780";
  if (invitedHelperOffer.value) return "293:1866";
  if (interaction.value?.public_kind === "economy_offer") return "295:2592";
  if (interaction.value?.public_kind === "theft_response") return "295:2764";
  if (interaction.value?.public_kind === "private_choice") return "296:2748";
  if (interaction.value?.my_response_state === "timed_out") return "296:2911";
  return "254:221";
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
  if (targetInteraction.value) {
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
  if (targetInteraction.value && interaction.value) {
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

</script>

<template>
  <section
    v-if="activeSurface"
    class="interaction-surface"
    data-testid="interaction-surface"
    :data-state="terminal ? 'terminal' : busy ? 'pending' : 'open'"
  >
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
      :inbox-status="interaction?.response_required_for_you
        ? 'Требуется решение'
        : 'Окно открыто для текущей проекции'"
      :figma-node="figmaNode"
    >
      <AdvancedCombatSurface
        v-if="interaction?.public_kind === 'combat_response'"
        :projection="projection"
      />

      <TargetInteractionSurface
        v-if="interaction && targetInteraction"
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

      <p
        v-if="interaction && !interaction.actions.length && !charityForm"
        class="interaction-opaque"
        role="status"
      >
        Окно открыто. Сейчас нет действия для этого игрока.
      </p>

      <p
        v-else-if="interaction && !selectableActions.length
          && !helperOfferMode && !invitedHelperOffer && !charityForm"
        class="interaction-opaque"
        role="status"
      >
        Это действие будет доступно в специализированном окне.
      </p>

      <InteractionActionList
        v-if="interaction && selectableActions.length"
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
          v-if="interaction && selectedAction"
          class="interaction-submit"
          type="button"
          :disabled="busy || terminal"
          @click="submitSelected"
        >
          {{ busy ? "Отправляем…" : actionLabelFor(selectedAction, selectedActionIndex) }}
        </button>
        <span
          v-else-if="interaction && !helperOfferMode && !charityForm"
          class="interaction-submit-placeholder"
        >
          Действие недоступно
        </span>
        <small>Окончательное решение принимает сервер.</small>
      </template>
    </InteractionDialog>

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

.interaction-opaque {
  margin: 0;
  border: 1px dashed var(--color-line, #566044);
  padding: 1rem;
  color: var(--color-text-muted, #9eaa8e);
  line-height: 1.45;
}

</style>
