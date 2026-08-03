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
import MobileEncounterStage from "./MobileEncounterStage.vue";
import MobileGameHeader from "./MobileGameHeader.vue";
import MobileOpponentSummary from "./MobileOpponentSummary.vue";
import MobileOwnState from "./MobileOwnState.vue";
import {hasActionableDeadline} from "./mobileGameModel";
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
  hasActionableHand: boolean;
  bindingsForCard: (cardID: string) => CardActionBinding[];
  stateForCard: (cardID: string) => CardActionState;
  confirmedCardIds: ReadonlySet<string>;
}>();

const compactActionDock = computed(() => {
  if (props.economyEntries.length > 0) {
    return false;
  }
  const [entry] = props.actionPanelEntries;
  if (!entry) {
    return props.projection.status === "active" || props.projection.status === "finished";
  }
  const action = entry.action;
  return props.actionPanelEntries.length === 1 &&
    !action.instance_ids?.length &&
    !action.target_instance_ids?.length &&
    !action.target_player_ids?.length &&
    !action.minimum &&
    !action.maximum &&
    !action.minimum_total &&
    !action.instance_values;
});

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
    class="mobile-game-table"
    :data-state="projection.status"
    :data-phase="projection.turn.phase || 'waiting'"
    :aria-busy="isBusy"
    aria-label="Игровой стол для телефона"
  >
    <SystemStateSurface
      v-if="projection.status === 'finished'"
      kind="victory"
      :projection="projection"
    />
    <template v-else>
      <MobileGameHeader :projection="projection" />

      <div v-if="connectionState !== 'connected'" class="mobile-game-table__status">
        <GameConnectionStatus
          :state="connectionState"
          :error-kind="errorKind"
          :error-message="errorMessage"
          :has-projection="true"
          @retry="emit('retry')"
        />
      </div>

      <MobileOpponentSummary :projection="projection" />

      <div class="mobile-game-table__stage">
        <MobileEncounterStage :projection="projection" />
      </div>

      <section
        class="mobile-game-table__dock"
        :class="{'mobile-game-table__dock--compact': compactActionDock}"
        aria-label="Действия текущей проекции"
      >
        <MobileOwnState
          :projection="projection"
          :show-hand="hasActionableHand"
          :has-interaction="Boolean(projection.interaction?.response_required_for_you)"
          :has-actionable-deadline="hasActionableDeadline(projection)"
          :bindings-for-card="bindingsForCard"
          :state-for-card="stateForCard"
          :confirmed-card-ids="confirmedCardIds"
          @activate="emit('activate', $event)"
        />

        <EconomySurface
          v-if="economyEntries.length"
          :projection="projection"
          :actions="economyEntries"
          :busy="actionBusy"
          @submit="emit('execute-economy', $event)"
        />

        <ActionPanel
          v-if="actionPanelEntries.length || contextCardName"
          :entries="actionPanelEntries"
          :cards="visibleCards"
          :player-names="playerNames"
          :busy="actionBusy"
          :context-card-name="contextCardName"
          @close="emit('close')"
          @execute="runAction"
        />

        <p
          v-if="projection.status === 'active' && !actionPanelEntries.length && !economyEntries.length"
          class="mobile-game-table__waiting"
          role="status"
        >
          Ожидаем подтверждённый ход другого игрока.
        </p>
      </section>
    </template>
  </section>
</template>

<style scoped lang="scss">
.mobile-game-table {
  display: none;
}

.mobile-game-table__status,
.mobile-game-table__stage,
.mobile-game-table__dock {
  min-width: 0;
}

.mobile-game-table__status :deep(.game-connection-status) {
  min-height: 1.3rem;
}

.mobile-game-table__stage {
  min-height: 0;
}

.mobile-game-table__dock {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.mobile-game-table__waiting,
.mobile-game-table__result {
  margin: 0;
  padding: var(--space-2);
  color: var(--color-text-muted);
  font-size: .72rem;
  line-height: 1.35;
}

.mobile-game-table__result {
  color: var(--color-accent-strong);
}
</style>
