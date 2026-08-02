<script setup lang="ts">
import type {
  ActionDescriptor,
  CommandPayload,
  Projection,
} from "@munchkin/contracts";
import type {GameConnectionState} from "../../composables/useGameSessionController";
import {useCardSelection} from "../../composables/useCardSelection";
import {useGamePresentation} from "../../composables/useGamePresentation";
import ActionPanel from "../ActionPanel.vue";
import GameConnectionStatus from "../GameConnectionStatus.vue";
import EconomySurface from "../interaction/EconomySurface.vue";
import {
  economyActions,
  isEconomyAction,
  type EconomySubmission,
} from "../interaction/economyModel";
import {
  buildCommandPayload,
  cardActionState,
  mapCardActions,
  type ActionEntry,
  type CardActionBinding,
  type CardActionState,
} from "../actionModel";
import GameContextPanel from "./GameContextPanel.vue";
import MobileGameTable from "./mobile/MobileGameTable.vue";
import {
  currentPlayerName,
  uniqueCards,
  visibleCardsForProjection,
} from "./gameTableViewModel";
import OpponentRoster from "./OpponentRoster.vue";
import OwnBoard from "./OwnBoard.vue";

const props = defineProps<{
  projection: Projection;
  connectionState: GameConnectionState;
  errorMessage: string;
  actionBusy: boolean;
  isBusy: boolean;
}>();

const emit = defineEmits<{
  retry: [];
  execute: [entry: ActionEntry, payload: CommandPayload];
  "execute-economy": [request: EconomySubmission];
}>();

const pendingCardIDs = ref<Set<string>>(new Set());
const confirmedCardIDs = ref<Set<string>>(new Set());
let confirmedMotionTimer: ReturnType<typeof setTimeout> | undefined;

const presentation = useGamePresentation(() => props.projection);

const ownCards = computed(() => uniqueCards([
  ...props.projection.you.hand,
  ...props.projection.you.carried,
  ...props.projection.you.equipped,
  ...props.projection.you.traits,
  ...props.projection.you.attachments,
  ...props.projection.you.persistent_curses,
]));

const visibleCards = computed(() => uniqueCards([
  ...visibleCardsForProjection(props.projection),
]));

const actionEntries = computed<ActionEntry[]>(() =>
  presentation.value?.turnActions.map(({action, index}) => ({action, index})) ?? [],
);

const economyActionEntries = computed(() => economyActions(
  props.projection.turn.available_actions,
));

const genericActionEntries = computed<ActionEntry[]>(() =>
  actionEntries.value.filter((entry) => !isEconomyAction(entry.action)),
);

const cardActionMap = computed(() =>
  mapCardActions(ownCards.value, genericActionEntries.value),
);

const hasActionableHand = computed(() => cardActionMap.value.byCard.size > 0);

const {
  selectedCardID,
  selectCard,
  clearSelection,
} = useCardSelection({
  projectionVersion: () => props.projection.version,
  availableCardIDs: () => [...cardActionMap.value.byCard.keys()],
});

const globalActionEntries = computed(() =>
  genericActionEntries.value.filter((entry) =>
    !cardActionMap.value.cardBoundActionIndexes.has(entry.index),
  ),
);

const selectedCard = computed(() => ownCards.value.find((card) =>
  card.instance_id === selectedCardID.value,
));

const selectedCardEntries = computed<ActionEntry[]>(() => {
  if (!selectedCardID.value) {
    return [];
  }
  return cardActionMap.value.byCard.get(selectedCardID.value) ?? [];
});

const actionPanelEntries = computed(() => selectedCard.value
  ? selectedCardEntries.value
  : globalActionEntries.value);

const playerNames = computed<Record<string, string>>(() => Object.fromEntries([
  [props.projection.you.player_id, props.projection.you.name],
  ...props.projection.players.map((player) => [player.player_id, player.name]),
]));

function cardBindings(cardID: string): CardActionBinding[] {
  return cardActionMap.value.byCard.get(cardID) ?? [];
}

function cardState(cardID: string): CardActionState {
  return cardActionState(cardBindings(cardID), {
    busy: props.actionBusy,
    selected: selectedCardID.value === cardID,
    pending: pendingCardIDs.value.has(cardID),
    confirmed: confirmedCardIDs.value.has(cardID),
  });
}

function markPendingCard(action: ActionDescriptor, payload: CommandPayload) {
  const ids = new Set<string>();
  if (action.source_instance_id) {
    ids.add(action.source_instance_id);
  }
  if (payload.instance_id) {
    ids.add(payload.instance_id);
  }
  for (const instanceID of payload.instance_ids ?? []) {
    ids.add(instanceID);
  }
  if (ids.size > 0) {
    pendingCardIDs.value = new Set(ids);
  }
}

function runAction(entry: ActionEntry, payload: CommandPayload): void {
  markPendingCard(entry.action, payload);
  emit("execute", entry, payload);
}

function activateCard(binding: CardActionBinding) {
  if (binding.mode === "direct") {
    runAction(binding, buildCommandPayload(binding.action));
    return;
  }
  selectCard(binding.cardInstanceID);
}

function closeCardActions() {
  clearSelection();
}

watch(
  () => props.projection.version,
  (version, previousVersion) => {
    if (
      previousVersion === undefined ||
      version <= previousVersion ||
      pendingCardIDs.value.size === 0
    ) {
      return;
    }
    confirmedCardIDs.value = new Set(pendingCardIDs.value);
    pendingCardIDs.value = new Set();
    if (confirmedMotionTimer) {
      clearTimeout(confirmedMotionTimer);
    }
    confirmedMotionTimer = setTimeout(() => {
      confirmedCardIDs.value = new Set();
      confirmedMotionTimer = undefined;
    }, 260);
  },
);

watch(() => props.actionBusy, (busy) => {
  if (!busy) {
    pendingCardIDs.value = new Set();
  }
});

onBeforeUnmount(() => {
  if (confirmedMotionTimer) {
    clearTimeout(confirmedMotionTimer);
  }
});
</script>

<template>
  <section
    class="game-table"
    :aria-busy="isBusy"
    :data-state="projection.status"
  >
    <div class="game-table__desktop">
      <header class="game-table__header">
        <div>
          <p class="eyebrow">КОМНАТА</p>
          <code>{{ projection.game_id }}</code>
        </div>
        <div class="meta-badges" aria-label="Версия и профиль правил">
          <span>v{{ projection.version }}</span>
          <span>{{ projection.status }}</span>
          <span>{{ projection.rules_profile_id }}</span>
        </div>
      </header>

      <GameConnectionStatus
        :state="connectionState"
        :error-message="errorMessage"
        @retry="emit('retry')"
      />

      <OpponentRoster :projection="projection" />
      <GameContextPanel :projection="projection" />

      <OwnBoard
        :projection="projection"
        :bindings-for-card="cardBindings"
        :state-for-card="cardState"
        :confirmed-card-ids="confirmedCardIDs"
        @activate="activateCard"
      />

      <EconomySurface
        :projection="projection"
        :actions="economyActionEntries"
        :busy="actionBusy"
        @submit="emit('execute-economy', $event)"
      />

      <section class="action-bar" aria-label="Действия текущей проекции">
        <ActionPanel
          :entries="actionPanelEntries"
          :cards="visibleCards"
          :player-names="playerNames"
          :busy="actionBusy"
          :context-card-name="selectedCard?.name"
          @close="closeCardActions"
          @execute="runAction"
        />
        <p
          v-if="projection.status === 'active' && !genericActionEntries.length && !economyActionEntries.length"
          class="action-bar__waiting"
          role="status"
        >
          Ждём {{ currentPlayerName(projection) }}. Последнее подтверждённое состояние остаётся доступным.
        </p>
        <strong v-if="projection.status === 'finished'" class="action-bar__result">
          Победитель: {{ playerNames[projection.winner_player_id ?? ""] ?? "игра завершена" }}
        </strong>
      </section>
    </div>

    <MobileGameTable
      :projection="projection"
      :connection-state="connectionState"
      :error-message="errorMessage"
      :action-busy="actionBusy"
      :is-busy="isBusy"
      :action-panel-entries="actionPanelEntries"
      :economy-entries="economyActionEntries"
      :visible-cards="visibleCards"
      :player-names="playerNames"
      :context-card-name="selectedCard?.name"
      :has-actionable-hand="hasActionableHand"
      :bindings-for-card="cardBindings"
      :state-for-card="cardState"
      :confirmed-card-ids="confirmedCardIDs"
      @retry="emit('retry')"
      @execute="runAction"
      @execute-economy="emit('execute-economy', $event)"
      @activate="activateCard"
      @close="closeCardActions"
    />
  </section>
</template>

<style scoped>
.game-table {
  width: min(1440px, calc(100% - 2rem));
  min-width: 0;
  margin: 0 auto;
  padding: 1.5rem 0 4rem;
}

.game-table__desktop {
  min-width: 0;
}

.game-table__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
}

.meta-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: .5rem;
}

.meta-badges span {
  border: 1px solid var(--line);
  padding: .35rem .6rem;
  color: var(--muted);
  font-size: .7rem;
  text-transform: uppercase;
}

.game-table__desktop > .game-connection-status {
  margin-top: .75rem;
}

.action-bar {
  position: sticky;
  z-index: 20;
  top: .75rem;
  min-width: 0;
  margin-top: 1.5rem;
  border: 1px solid var(--line);
  padding: .5rem;
  background: color-mix(in srgb, var(--color-board), transparent 5%);
  box-shadow: 0 -12px 28px rgb(0 0 0 / 22%);
}

.action-bar__waiting {
  margin: .75rem 0 0;
  color: var(--muted);
  line-height: 1.45;
}

.action-bar__result {
  display: block;
  padding: .8rem;
  color: var(--acid);
}

@media (width <= 767px) {
  .game-table {
    width: min(100% - 1rem, 1440px);
    padding-top: 1rem;
  }

  .game-table__header {
    align-items: start;
    flex-direction: column;
  }

  .meta-badges {
    justify-content: start;
  }
}

@media (width <= 599px) {
  .action-bar {
    margin-right: calc(-.5rem - env(safe-area-inset-right, 0px));
    margin-left: calc(-.5rem - env(safe-area-inset-left, 0px));
    padding-right: calc(.5rem + env(safe-area-inset-right, 0px));
    padding-bottom: calc(.5rem + env(safe-area-inset-bottom, 0px));
    padding-left: calc(.5rem + env(safe-area-inset-left, 0px));
  }
}
</style>
