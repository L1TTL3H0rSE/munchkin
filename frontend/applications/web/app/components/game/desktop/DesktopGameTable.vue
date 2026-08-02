<script setup lang="ts">
import type {
  CardView,
  CommandPayload,
  Projection,
} from "@munchkin/contracts";
import type {GameConnectionState} from "../../../composables/useGameSessionController";
import type {GameApiErrorKind} from "../../../composables/useGameApi";
import type {
  ActionEntry,
  CardActionBinding,
  CardActionState,
} from "../../actionModel";
import type {
  EconomyAction,
  EconomySubmission,
} from "../../interaction/economyModel";
import ActionPanel from "../../ActionPanel.vue";
import GameConnectionStatus from "../../GameConnectionStatus.vue";
import EconomySurface from "../../interaction/EconomySurface.vue";
import DesktopEncounterStage from "./DesktopEncounterStage.vue";
import DesktopGameHeader from "./DesktopGameHeader.vue";
import {desktopStateFamily} from "./desktopGameModel";
import OpponentRoster from "../OpponentRoster.vue";
import OwnBoard from "../OwnBoard.vue";
import SystemStateSurface from "../status/SystemStateSurface.vue";

const props = defineProps<{
  projection: Projection;
  connectionState: GameConnectionState;
  errorKind: GameApiErrorKind | null;
  errorMessage: string;
  actionBusy: boolean;
  isBusy: boolean;
  actionPanelEntries: ActionEntry[];
  economyEntries: Array<{action: EconomyAction; index: number}>;
  visibleCards: CardView[];
  playerNames: Record<string, string>;
  contextCardName?: string;
  bindingsForCard: (cardID: string) => CardActionBinding[];
  stateForCard: (cardID: string) => CardActionState;
  confirmedCardIds: ReadonlySet<string>;
}>();

const stateFamily = computed(() => desktopStateFamily(props.projection));
const showActionDock = computed(() =>
  props.actionPanelEntries.length > 0 || Boolean(props.contextCardName),
);

const emit = defineEmits<{
  retry: [];
  execute: [entry: ActionEntry, payload: CommandPayload];
  "execute-economy": [request: EconomySubmission];
  activate: [binding: CardActionBinding];
  close: [];
}>();

function runAction(entry: ActionEntry, payload: CommandPayload) {
  emit("execute", entry, payload);
}
</script>

<template>
  <section
    class="desktop-game-table"
    :data-state-family="stateFamily"
    :data-phase="projection.turn.phase || 'waiting'"
    :data-state="projection.status"
    :aria-busy="isBusy"
    aria-label="Игровой стол для desktop и tablet"
  >
    <SystemStateSurface
      v-if="projection.status === 'finished'"
      kind="victory"
      :projection="projection"
    />
    <template v-else>
      <DesktopGameHeader :projection="projection" />

      <div v-if="connectionState !== 'connected'" class="desktop-game-table__connection">
        <GameConnectionStatus
          :state="connectionState"
          :error-kind="errorKind"
          :error-message="errorMessage"
          :has-projection="true"
          @retry="emit('retry')"
        />
      </div>

      <OpponentRoster :projection="projection" />

      <div class="desktop-game-table__main">
        <DesktopEncounterStage :projection="projection" />

        <aside class="desktop-game-table__side" aria-label="Сводка игрока и контекстные действия">
          <OwnBoard
            :projection="projection"
            :bindings-for-card="bindingsForCard"
            :state-for-card="stateForCard"
            :confirmed-card-ids="confirmedCardIds"
            @activate="emit('activate', $event)"
          />

          <section
            v-if="economyEntries.length || showActionDock"
            class="desktop-game-table__actions"
            aria-label="Контекстные действия текущей проекции"
          >
            <EconomySurface
              v-if="economyEntries.length"
              :projection="projection"
              :actions="economyEntries"
              :busy="actionBusy"
              @submit="emit('execute-economy', $event)"
            />

            <ActionPanel
              v-if="showActionDock"
              :entries="actionPanelEntries"
              :cards="visibleCards"
              :player-names="playerNames"
              :busy="actionBusy"
              :context-card-name="contextCardName"
              @close="emit('close')"
              @execute="runAction"
            />
          </section>

          <p
            v-if="projection.status === 'active' && !economyEntries.length && !showActionDock"
            class="desktop-game-table__waiting"
            role="status"
          >
            Ожидаем подтверждённый ход другого игрока.
          </p>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
.desktop-game-table {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space-3);
}

.desktop-game-table__connection {
  min-width: 0;
}

.desktop-game-table__main {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(250px, 310px);
  align-items: start;
  gap: var(--space-4);
}

.desktop-game-table__side {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space-3);
}

.desktop-game-table__actions {
  min-width: 0;
  display: grid;
  gap: var(--space-3);
  border-top: 2px solid var(--color-accent-strong);
  padding-top: var(--space-3);
}

.desktop-game-table__waiting,
.desktop-game-table__result {
  margin: 0;
  border: 1px dashed var(--color-line);
  padding: var(--space-3);
  color: var(--color-text-muted);
  line-height: 1.45;
}

.desktop-game-table__result {
  border-color: var(--color-accent-strong);
  color: var(--color-accent-strong);
}

@media (width <= 1023px) {
  .desktop-game-table__main {
    grid-template-columns: minmax(0, 1fr);
  }

  .desktop-game-table__side {
    grid-template-columns: minmax(0, 1fr) minmax(260px, .8fr);
    align-items: start;
  }

  .desktop-game-table__waiting,
  .desktop-game-table__result {
    grid-column: 1 / -1;
  }
}

@media (width <= 767px) {
  .desktop-game-table__side {
    grid-template-columns: 1fr;
  }
}
</style>
