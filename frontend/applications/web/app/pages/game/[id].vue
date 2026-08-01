<script setup lang="ts">
import {onMounted, ref} from "vue";
import type {
  CommandPayload,
} from "@munchkin/contracts";
import type {ActionEntry} from "../../components/actionModel";
import type {InteractionActionView} from "../../components/interaction/interactionModel";
import type {EconomySubmission} from "../../components/interaction/economyModel";

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
  interactionError,
  connectionState,
  isBusy,
} = controller;

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
  <section v-if="!hydrated || loading" class="center-state" aria-busy="true">
    <p role="status">Загружаем состояние игры…</p>
    <GameConnectionStatus
      :state="connectionState"
      :error-message="errorMessage"
      @retry="controller.retry"
    />
  </section>
  <div v-else-if="projection" class="game-route">
    <GameTable
      :projection="projection"
      :connection-state="connectionState"
      :error-message="errorMessage"
      :action-busy="actionBusy"
      :is-busy="isBusy"
      @retry="controller.retry"
      @execute="executeAction"
      @execute-economy="executeEconomy"
    />
    <InteractionSurface
      :projection="projection"
      :connection-state="connectionState"
      :busy="isBusy"
      :error-message="interactionError || errorMessage"
      @submit="executeInteraction"
      @submit-economy="executeEconomy"
    />
  </div>
  <section v-else class="center-state" :aria-busy="isBusy">
    <GameConnectionStatus
      :state="connectionState"
      :error-message="errorMessage"
      @retry="controller.retry"
    />
    <p v-if="!errorMessage">Состояние игры недоступно.</p>
    <NuxtLink to="/">Вернуться в лобби</NuxtLink>
  </section>
</template>

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
