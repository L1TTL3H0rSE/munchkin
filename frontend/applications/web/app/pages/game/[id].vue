<script setup lang="ts">
import {onMounted, ref} from "vue";
import type {
  CommandPayload,
} from "@munchkin/contracts";
import {
  buildCommandPayload,
  type ActionEntry,
} from "../../components/actionModel";
import type {InteractionActionView} from "../../components/interaction/interactionModel";
import type {EconomySubmission} from "../../components/interaction/economyModel";
import type {GameSheetRequest} from "../../components/game/gameSheetModel";
import GameModalCoordinator from "../../components/game/modals/GameModalCoordinator.vue";
import {
  buildRouteSystemState,
} from "../../components/game/status/systemStateModel";
import LoadingGameTable from "../../components/game/status/LoadingGameTable.vue";
import SystemStateSurface from "../../components/game/status/SystemStateSurface.vue";
import {useGameSessionController} from "../../composables/useGameSessionController";

const route = useRoute();
const api = useGameApi();
const session = useGameSession();
const gameID = computed(() => String(route.params.id));
const hydrated = ref(false);
const requestedSheet = ref<GameSheetRequest>();
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

const showDeathState = computed(() => Boolean(
  routeState.value.kind === "game" &&
  routeState.value.projection.you.dead &&
  !routeState.value.projection.interaction?.response_required_for_you,
));
const showDeathRecovery = computed(() => Boolean(
  routeState.value.kind === "game" &&
  routeState.value.projection.interaction?.public_kind === "death_loot_priority" &&
  !routeState.value.projection.interaction.response_required_for_you &&
  routeState.value.projection.interaction.death_loot?.remaining_count === 0,
));

function executeAction(entry: ActionEntry, payload: CommandPayload): void {
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
      void controller.submitInteraction(interactionAction);
      return;
    }
  }
  void controller.submitAction(entry.action, payload);
}

function executeInteraction(action: InteractionActionView): void {
  void controller.submitInteraction(action);
}

function executeEconomy(request: EconomySubmission): void {
  void controller.submitEconomy(request);
}

function openSheet(request: GameSheetRequest): void {
  requestedSheet.value = request;
}

watch(
  () => projection.value?.version,
  (version, previousVersion) => {
    if (version !== undefined && previousVersion !== undefined && version > previousVersion) {
      requestedSheet.value = undefined;
    }
  },
);

watch(
  () => projection.value,
  (current) => {
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
    if (!action) return;
    advancingDeadTurnVersion.value = current.version;
    executeAction({action, index}, buildCommandPayload(action));
  },
  {immediate: true},
);

onMounted(() => {
  hydrated.value = true;
});
</script>

<template>
  <LoadingGameTable v-if="routeState.kind === 'loading'" />
  <section
    v-else-if="routeState.kind !== 'game' && routeState.kind !== 'victory' && routeState.kind !== 'finished'"
    class="game-route"
  >
    <SystemStateSurface
      :kind="routeState.kind"
      @retry="controller.retry"
    />
  </section>
  <div v-else class="game-route">
    <SystemStateSurface
      v-if="showDeathState"
      kind="death"
      :projection="routeState.projection"
    />
    <SystemStateSurface
      v-else-if="showDeathRecovery"
      kind="death-recovery"
      :projection="routeState.projection"
    />
    <template v-else>
      <GameTable
        :projection="routeState.projection"
        :connection-state="connectionState"
        :error-kind="errorKind"
        :error-message="errorMessage"
        :action-busy="actionBusy"
        :is-busy="isBusy"
        @retry="controller.retry"
        @execute="executeAction"
        @submit-interaction="executeInteraction"
        @open-sheet="openSheet"
      />
      <GameModalCoordinator
        v-if="routeState.kind === 'game'"
        :projection="routeState.projection"
        :request="requestedSheet"
        :connection-state="connectionState"
        :busy="isBusy"
        :error-message="interactionError || errorMessage"
        @close="requestedSheet = undefined"
        @open-sheet="openSheet"
        @execute="executeAction"
        @submit-interaction="executeInteraction"
        @submit-economy="executeEconomy"
      />
    </template>
  </div>
</template>

<style scoped>
.game-route {
  min-width: 0;
}
</style>
