<script setup lang="ts">
import {onMounted, ref} from "vue";
import type {
  CommandPayload,
} from "@munchkin/contracts";
import type {ActionEntry} from "../../components/actionModel";
import type {InteractionActionView} from "../../components/interaction/interactionModel";
import type {EconomySubmission} from "../../components/interaction/economyModel";
import {
  buildRouteSystemState,
} from "../../components/game/status/systemStateModel";
import SystemStateSurface from "../../components/game/status/SystemStateSurface.vue";
import {useGameSessionController} from "../../composables/useGameSessionController";

const route = useRoute();
const router = useRouter();
const api = useGameApi();
const session = useGameSession();
const gameID = computed(() => String(route.params.id));
const hydrated = ref(false);
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

onMounted(() => {
  hydrated.value = true;
});
</script>

<template>
  <section v-if="routeState.kind === 'loading'" class="center-state" aria-busy="true">
    <SystemStateSurface kind="loading" />
  </section>
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
    <GameTable
      :projection="routeState.projection"
      :connection-state="connectionState"
      :error-kind="errorKind"
      :error-message="errorMessage"
      :action-busy="actionBusy"
      :is-busy="isBusy"
      @retry="controller.retry"
      @execute="executeAction"
      @execute-economy="executeEconomy"
    />
    <InteractionSurface
      v-if="routeState.kind === 'game'"
      :projection="routeState.projection"
      :connection-state="connectionState"
      :busy="isBusy"
      :error-message="interactionError || errorMessage"
      @submit="executeInteraction"
      @submit-economy="executeEconomy"
    />
  </div>
</template>

<style lang="scss">
@use "../../assets/scss/pages/game-mobile";
@use "../../assets/scss/pages/game-desktop";
</style>

<style scoped>
.center-state {
  display: grid;
  place-items: center;
  gap: 1rem;
  min-width: 0;
  min-height: calc(100vh - 64px);
  min-height: calc(100dvh - 64px);
  padding: 1rem;
  color: var(--muted);
  text-align: center;
}

.center-state > * {
  max-width: min(100%, 42rem);
}

.game-route {
  display: grid;
  gap: 1rem;
  min-width: 0;
}
</style>
