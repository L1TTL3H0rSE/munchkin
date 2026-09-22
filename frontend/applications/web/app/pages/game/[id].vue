<script setup lang="ts">
import {
  buildCommandPayload,
  type ActionEntry,
  type InteractionActionView,
  type EconomySubmission,
  buildRouteSystemState,
} from "@munchkin/components";
import {GameScreen} from "@munchkin/components/screens";
import type {
  CommandPayload,
} from "@munchkin/contracts";
import {useGameSessionController} from "../../composables/useGameSessionController";

const route = useRoute();
const api = useGameApi();
const session = useGameSession();
const gameID = computed(() => String(route.params.id));
const hydrated = ref(false);
const advancingDeadTurnVersion = ref<number>();
const controller = useGameSessionController({
  gameID,
  api,
  credentials: session,
});
const {
  projection,
  loading,
  actionBusy,
  errorMessage,
  errorKind,
  interactionError,
  connectionState,
  isBusy,
} = controller;

const routeState = computed(() => buildRouteSystemState({
  hydrated: hydrated.value,
  loading: loading.value,
  projection: projection.value,
  errorKind: errorKind.value,
}));

async function executeAction(entry: ActionEntry, payload: CommandPayload): Promise<void> {
  const state = routeState.value;
  if (entry.action.type === "choose_effect" && state.kind === "game" &&
    state.projection.interaction?.public_kind === "private_choice") {
    const choiceIDs = payload.choice_ids ?? [];
    const interactionAction = state.projection.interaction.actions.find((action) =>
      action.type === "respond" &&
      action.choice_ids?.length === choiceIDs.length &&
      action.choice_ids.every((instanceID, index) => instanceID === choiceIDs[index]),
    );
    if (interactionAction) {
      await controller.submitInteraction(interactionAction);
      return;
    }
  }
  await controller.submitAction(entry.action, payload);
}

async function executeInteraction(action: InteractionActionView): Promise<void> {
  await controller.submitInteraction(action);
}

async function executeEconomy(request: EconomySubmission): Promise<void> {
  await controller.submitEconomy(request);
}

watch(
  () => projection.value,
  async (current) => {
    if (!current || actionBusy.value || current.interaction ||
      !current.you.dead ||
      current.turn.phase !== "end_turn" ||
      current.turn.player_id !== current.you.player_id ||
      advancingDeadTurnVersion.value === current.version) {
      return;
    }
    const index = current.turn.available_actions.findIndex((candidate) =>
      candidate.type === "end_turn",
    );
    const action = current.turn.available_actions[index];
    if (!action) {
      return;
    }
    advancingDeadTurnVersion.value = current.version;
    await executeAction({action, index}, buildCommandPayload(action));
  },
  {immediate: true},
);

onMounted(() => {
  hydrated.value = true;
});
</script>

<template>
  <GameScreen
    :route-state="routeState"
    :connection-state="connectionState"
    :error-kind="errorKind"
    :error-message="errorMessage"
    :interaction-error="interactionError"
    :action-busy="actionBusy"
    :is-busy="isBusy"
    @retry="controller.retry"
    @execute="executeAction"
    @submit-interaction="executeInteraction"
    @submit-economy="executeEconomy"
  />
</template>
