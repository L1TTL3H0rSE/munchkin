<script setup lang="ts">
import {computed, nextTick, ref, watch} from "vue";
import type {CommandPayload} from "@munchkin/contracts";
import type {GameApiErrorKind, GameConnectionState} from "@munchkin/shared";
import type {ActionEntry} from "../../components/actionModel";
import type {EconomySubmission} from "../../components/interaction/economyModel";
import type {InteractionActionView} from "../../components/interaction/interactionModel";
import type {GameSheetRequest} from "../../components/game/gameSheetModel";
import type {RouteSystemState} from "../../components/game/status/systemStateModel";
import GameTable from "../../components/game/GameTable.vue";
import GameModalCoordinator from "../../components/game/modals/GameModalCoordinator.vue";
import LoadingGameTable from "../../components/game/status/LoadingGameTable.vue";
import SystemStateSurface from "../../components/game/status/SystemStateSurface.vue";

const props = defineProps<{
  routeState: RouteSystemState;
  connectionState: GameConnectionState;
  errorKind: GameApiErrorKind | null;
  errorMessage: string;
  interactionError: string;
  actionBusy: boolean;
  isBusy: boolean;
}>();
const emit = defineEmits<{
  retry: [];
  execute: [entry: ActionEntry, payload: CommandPayload];
  "submit-interaction": [action: InteractionActionView];
  "submit-economy": [request: EconomySubmission];
}>();
const requestedSheet = ref<GameSheetRequest>();
let sheetOpener: HTMLElement | null = null;
const showDeathState = computed(() => Boolean(
  props.routeState.kind === "game" &&
  props.routeState.projection.you.dead &&
  !props.routeState.projection.interaction?.response_required_for_you,
));
const showDeathRecovery = computed(() => Boolean(
  props.routeState.kind === "game" &&
  props.routeState.projection.interaction?.public_kind === "death_loot_priority" &&
  !props.routeState.projection.interaction.response_required_for_you &&
  props.routeState.projection.interaction.death_loot?.remaining_count === 0,
));
function openSheet(request: GameSheetRequest): void {
  if (!requestedSheet.value) {
    sheetOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  requestedSheet.value = request;
}
async function closeSheet(): Promise<void> {
  requestedSheet.value = undefined;
  const opener = sheetOpener;
  sheetOpener = null;
  await nextTick();
  if (opener?.isConnected) {
    opener.focus();
  }
}
watch(
  () => "projection" in props.routeState ? props.routeState.projection.version : undefined,
  async (version, previousVersion) => {
    if (version !== undefined && previousVersion !== undefined && version > previousVersion) {
      await closeSheet();
    }
  },
);
</script>
<template>
  <LoadingGameTable v-if="routeState.kind === 'loading'" />
  <section
    v-else-if="routeState.kind !== 'game' && routeState.kind !== 'victory' && routeState.kind !== 'finished'"
    class="game-route"
  >
    <SystemStateSurface
      :kind="routeState.kind"
      @retry="emit('retry')"
    />
  </section>
  <div v-else class="game-route">
    <SystemStateSurface
      v-if="showDeathState"
      kind="death"
      :projection="routeState.projection"
      @retry="emit('retry')"
    />
    <SystemStateSurface
      v-else-if="showDeathRecovery"
      kind="death-recovery"
      :projection="routeState.projection"
      @retry="emit('retry')"
    />
    <template v-else>
      <GameTable
        :projection="routeState.projection"
        :connection-state="connectionState"
        :error-kind="errorKind"
        :error-message="errorMessage"
        :action-busy="actionBusy"
        :is-busy="isBusy"
        @retry="emit('retry')"
        @execute="(entry, payload) => emit('execute', entry, payload)"
        @submit-interaction="emit('submit-interaction', $event)"
        @open-sheet="openSheet"
      />
      <GameModalCoordinator
        v-if="routeState.kind === 'game'"
        :projection="routeState.projection"
        :request="requestedSheet"
        :connection-state="connectionState"
        :busy="isBusy"
        :error-message="interactionError || errorMessage"
        @close="closeSheet"
        @open-sheet="openSheet"
        @execute="(entry, payload) => emit('execute', entry, payload)"
        @submit-interaction="emit('submit-interaction', $event)"
        @submit-economy="emit('submit-economy', $event)"
      />
    </template>
  </div>
</template>

<style scoped>
.game-route {
  min-width: 0;
}
</style>
