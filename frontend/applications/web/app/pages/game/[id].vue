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
import {
  isEconomyAction,
  type EconomySubmission,
} from "../../components/interaction/economyModel";
import type {GameSheetRequest} from "../../components/game/gameSheetModel";
import GameModalCoordinator from "../../components/game/modals/GameModalCoordinator.vue";
import {
  buildRouteSystemState,
} from "../../components/game/status/systemStateModel";
import LoadingGameTable from "../../components/game/status/LoadingGameTable.vue";
import SystemStateSurface from "../../components/game/status/SystemStateSurface.vue";
import {useGameSessionController} from "../../composables/useGameSessionController";

const route = useRoute();
const router = useRouter();
const api = useGameApi();
const session = useGameSession();
const gameID = computed(() => String(route.params.id));
const hydrated = ref(false);
const requestedSheet = ref<GameSheetRequest>();
const openingCharityVersion = ref<number>();
const advancingDeadTurnVersion = ref<number>();
const controller = useGameSessionController({
  gameID,
  api,
  credentials: session,
  navigateToLobby: async () => {
    await router.replace("/");
  },
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

function executeAction(entry: ActionEntry, payload: CommandPayload): void {
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
      current.turn.phase !== "charity" ||
      current.turn.player_id !== current.you.player_id ||
      openingCharityVersion.value === current.version) {
      return;
    }
    const action = current.turn.available_actions.find((candidate) =>
      candidate.type === "resolve_charity",
    );
    if (!action || !isEconomyAction(action)) {
      return;
    }
    openingCharityVersion.value = current.version;
    executeEconomy({kind: "charity", action, allocations: []});
  },
  {immediate: true},
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
    v-else-if="routeState.kind !== 'game' && routeState.kind !== 'victory'"
    class="center-state"
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
.center-state {
  display: grid;
  place-items: center;
  gap: 1rem;
  min-width: 0;
  min-height: 100vh;
  min-height: 100dvh;
  padding: 1rem;
  color: var(--muted);
  text-align: center;
}

.center-state > * {
  max-width: min(100%, 42rem);
}

.game-route {
  min-width: 0;
}
</style>
