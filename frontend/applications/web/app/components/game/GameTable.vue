<script setup lang="ts">
import type {
  ActionDescriptor,
  CommandPayload,
  Projection,
} from "@munchkin/contracts";
import type {GameConnectionState} from "../../composables/useGameSessionController";
import type {GameApiErrorKind} from "../../composables/useGameApi";
import {useCardSelection} from "../../composables/useCardSelection";
import {useGamePresentation} from "../../composables/useGamePresentation";
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
import DesktopGameTable from "./desktop/DesktopGameTable.vue";
import MobileGameTable from "./mobile/MobileGameTable.vue";
import {buildGamePresentationModel} from "./gamePresentationModel";
import SheetDialog from "../ui/SheetDialog.vue";
import {
  uniqueCards,
  visibleCardsForProjection,
} from "./gameTableViewModel";

const props = defineProps<{
  projection: Projection;
  connectionState: GameConnectionState;
  errorKind: GameApiErrorKind | null;
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
const compactPresenter = ref(false);
const strengthOpen = ref(false);
let confirmedMotionTimer: ReturnType<typeof setTimeout> | undefined;
let compactMediaQuery: MediaQueryList | undefined;

function syncPresenter(event?: MediaQueryListEvent): void {
  compactPresenter.value = event?.matches ?? compactMediaQuery?.matches ?? false;
}

onMounted(() => {
  compactMediaQuery = window.matchMedia("(width <= 599px)");
  syncPresenter();
  compactMediaQuery.addEventListener("change", syncPresenter);
});

const presentation = useGamePresentation(() => props.projection);
const presentationModel = computed(() => buildGamePresentationModel(props.projection));

watch(() => presentationModel.value.primary.kind, (kind) => {
  if (["door-choice", "run-away", "result", "required-decision"].includes(kind)) {
    strengthOpen.value = false;
  }
});

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
  compactMediaQuery?.removeEventListener("change", syncPresenter);
  if (confirmedMotionTimer) {
    clearTimeout(confirmedMotionTimer);
  }
});
</script>

<template>
  <section
    v-if="!projection.you.dead"
    class="game-table"
    tabindex="-1"
    :aria-busy="isBusy"
    :data-state="projection.status"
    :data-presenter="compactPresenter ? 'compact' : 'desktop'"
  >
    <div v-if="!compactPresenter" class="game-table__desktop">
      <DesktopGameTable
        :projection="projection"
        :presentation-model="presentationModel"
        :strength-open="strengthOpen"
        :connection-state="connectionState"
        :error-kind="errorKind"
        :error-message="errorMessage"
        :action-busy="actionBusy"
        :is-busy="isBusy"
        :action-panel-entries="actionPanelEntries"
        :economy-entries="economyActionEntries"
        :visible-cards="visibleCards"
        :player-names="playerNames"
        :context-card-name="selectedCard?.name"
        :bindings-for-card="cardBindings"
        :state-for-card="cardState"
        :confirmed-card-ids="confirmedCardIDs"
        @retry="emit('retry')"
        @execute="runAction"
        @execute-economy="emit('execute-economy', $event)"
        @activate="activateCard"
        @close="closeCardActions"
        @open-strength="strengthOpen = true"
      />
    </div>

    <MobileGameTable
      v-else
      :projection="projection"
      :presentation-model="presentationModel"
      :strength-open="strengthOpen"
      :connection-state="connectionState"
      :error-kind="errorKind"
      :error-message="errorMessage"
      :action-busy="actionBusy"
      :is-busy="isBusy"
      :action-panel-entries="actionPanelEntries"
      :economy-entries="economyActionEntries"
      :visible-cards="visibleCards"
      :player-names="playerNames"
      :context-card-name="selectedCard?.name"
      :has-hand="projection.you.hand.length > 0"
      :bindings-for-card="cardBindings"
      :state-for-card="cardState"
      :confirmed-card-ids="confirmedCardIDs"
      @retry="emit('retry')"
      @execute="runAction"
      @execute-economy="emit('execute-economy', $event)"
      @activate="activateCard"
      @close="closeCardActions"
      @open-strength="strengthOpen = true"
    />

    <SheetDialog
      :open="strengthOpen"
      title="Разбор подтверждённой силы"
      title-id="game-strength-title"
      data-figma-node="271:3010"
      description="Итоговые значения берутся только из actor-specific server projection."
      @close="strengthOpen = false"
    >
      <dl class="game-strength-sheet">
        <div>
          <dt>Игрок</dt>
          <dd>{{ projection.turn.combat?.player_strength ?? projection.you.combat_strength }}</dd>
        </div>
        <div>
          <dt>Встреча</dt>
          <dd>{{ projection.turn.combat?.monster_strength ?? "Нет открытого боя" }}</dd>
        </div>
      </dl>
    </SheetDialog>
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

.game-strength-sheet {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0;
}

.game-strength-sheet > div {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-control);
  padding: var(--space-3);
}

.game-strength-sheet dt {
  color: var(--color-text-muted);
  font-size: .7rem;
  text-transform: uppercase;
}

.game-strength-sheet dd {
  margin: var(--space-1) 0 0;
  font-weight: 800;
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
