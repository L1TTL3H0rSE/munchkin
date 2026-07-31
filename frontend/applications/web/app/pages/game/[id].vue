<script setup lang="ts">
import type {CommandPayload} from "@munchkin/contracts";
import type {ActionEntry} from "../../components/actionModel";

const route = useRoute();
const router = useRouter();
const api = useGameApi();
const session = useGameSession();
const gameID = computed(() => String(route.params.id));
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
  connectionState,
  isBusy,
} = controller;

function executeAction(entry: ActionEntry, payload: CommandPayload): void {
  void controller.submitAction(entry.action, payload);
}
</script>

<template>
  <section v-if="loading" class="center-state" aria-busy="true">
    <p role="status">Загружаем состояние игры…</p>
    <GameConnectionStatus
      :state="connectionState"
      :error-message="errorMessage"
      @retry="controller.retry"
    />
  </section>
  <GameTable
    v-else-if="projection"
    :projection="projection"
    :connection-state="connectionState"
    :error-message="errorMessage"
    :action-busy="actionBusy"
    :is-busy="isBusy"
    @retry="controller.retry"
    @execute="executeAction"
  />
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
</style>
