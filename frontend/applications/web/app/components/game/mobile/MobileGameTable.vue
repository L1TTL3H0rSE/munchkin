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
import GameCard from "../../GameCard.vue";
import GameConnectionStatus from "../../GameConnectionStatus.vue";
import SheetDialog from "../../ui/SheetDialog.vue";
import DeckBack from "../primitives/DeckBack.vue";
import MobileEncounterStage from "./MobileEncounterStage.vue";
import MobileGameHeader from "./MobileGameHeader.vue";
import MobileOpponentSummary from "./MobileOpponentSummary.vue";
import MobileOwnState from "./MobileOwnState.vue";
import {hasActionableDeadline, type GamePresentationModel} from "../gamePresentationModel";
import SystemStateSurface from "../status/SystemStateSurface.vue";

const props = defineProps<{
  projection: Projection;
  presentationModel: GamePresentationModel;
  strengthOpen: boolean;
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
  hasHand: boolean;
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
const result = computed(() => props.presentationModel.primary.kind === "result"
  ? props.presentationModel.primary
  : undefined,
);
const rewardCards = computed(() => props.projection.you.hand.slice(0, 2));
const runAwayCards = computed(() => props.presentationModel.encounterCards);
const runAwaySelectedIndex = computed(() => props.presentationModel.activeEncounterIndex);

const emit = defineEmits<{
  retry: [];
  execute: [entry: ActionEntry, payload: CommandPayload];
  "execute-economy": [request: EconomySubmission];
  activate: [binding: CardActionBinding];
  close: [];
  "open-strength": [];
}>();

function runAction(entry: ActionEntry, payload: CommandPayload) {
  emit("execute", entry, payload);
}
</script>

<template>
  <section
    class="mobile-game-table"
    :data-state="projection.status"
    :data-figma-node="presentationModel.mobileNodeID"
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
      <MobileGameHeader
        :projection="projection"
        :presentation-model="presentationModel"
        :strength-open="strengthOpen"
        @open-strength="emit('open-strength')"
      />

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
        <MobileEncounterStage
          :projection="projection"
          :presentation-model="presentationModel"
        />
      </div>

      <section
        class="mobile-game-table__dock"
        :class="{'mobile-game-table__dock--compact': compactActionDock}"
        aria-label="Действия текущей проекции"
      >
        <MobileOwnState
          :projection="projection"
          :show-hand="hasHand"
          :has-interaction="Boolean(projection.interaction?.response_required_for_you)"
          :has-actionable-deadline="hasActionableDeadline(projection)"
          :bindings-for-card="bindingsForCard"
          :state-for-card="stateForCard"
          :confirmed-card-ids="confirmedCardIds"
          @activate="emit('activate', $event)"
        />

        <ActionPanel
          v-if="presentationModel.primary.kind !== 'door-choice' && (actionPanelEntries.length || contextCardName)"
          :entries="actionPanelEntries"
          :cards="visibleCards"
          :player-names="playerNames"
          :busy="actionBusy"
          :context-card-name="contextCardName"
          @close="emit('close')"
          @execute="runAction"
        />

      </section>
    </template>
  </section>

  <SheetDialog
    :open="presentationModel.primary.kind === 'door-choice' && !projection.interaction"
    class="mobile-door-decision"
    title="Дверь"
    title-id="mobile-door-decision-title"
    description="Открой верхнюю карту двери, чтобы продолжить ход."
    :dismissible="false"
    data-figma-node="181:1634"
  >
    <div class="mobile-door-decision__deck" aria-label="Закрытая колода дверей">
      <DeckBack deck="door" label="Верхняя карта колоды дверей" />
      <strong>{{ projection.door_deck_count }}</strong>
    </div>
    <template #footer>
      <ActionPanel
        :entries="actionPanelEntries"
        :cards="visibleCards"
        :player-names="playerNames"
        :busy="actionBusy"
        :context-card-name="contextCardName"
        @close="emit('close')"
        @execute="runAction"
      />
    </template>
  </SheetDialog>

  <SheetDialog
    :open="presentationModel.primary.kind === 'run-away' && !projection.interaction"
    class="mobile-run-away-decision"
    title="Смыться"
    title-id="mobile-run-away-decision-title"
    description="Выбери монстра · затем сервер бросит кубик."
    :dismissible="false"
    data-figma-node="183:1671"
  >
    <div class="mobile-run-away-decision__cards" role="list" aria-label="Монстры для побега">
      <GameCard
        v-for="(card, index) in runAwayCards"
        :key="`mobile-run-away-${card.instance_id}`"
        :card="card"
        :content-set-id="projection.content_set_id"
        choice
        :class="{'mobile-run-away-decision__card--selected': index === runAwaySelectedIndex}"
        role="listitem"
      />
    </div>
    <p class="mobile-run-away-decision__summary">
      Выбран {{ runAwaySelectedIndex + 1 }} / {{ runAwayCards.length }} · побег
      {{ projection.you.escape_bonus >= 0 ? "+" : "−" }}{{ Math.abs(projection.you.escape_bonus) }} · нужно 5+
    </p>
    <template #footer>
      <ActionPanel
        :entries="actionPanelEntries"
        :cards="visibleCards"
        :player-names="playerNames"
        :busy="actionBusy"
        :context-card-name="contextCardName"
        @close="emit('close')"
        @execute="runAction"
      />
    </template>
  </SheetDialog>

  <SheetDialog
    :open="Boolean(result) && !projection.interaction"
    class="mobile-result-decision"
    :title="result?.source === 'reward'
      ? 'Награда'
      : result?.escaped ? 'Ты смылся' : 'Сбежать не удалось'"
    title-id="mobile-result-decision-title"
    :dismissible="false"
    :data-figma-node="result?.source === 'reward' ? '184:1687' : '183:1671'"
  >
    <template v-if="result?.source === 'reward'">
      <div class="mobile-result-decision__cards" role="list" aria-label="Полученные сокровища">
        <GameCard
          v-for="card in rewardCards"
          :key="`mobile-reward-${card.instance_id}`"
          :card="card"
          :content-set-id="projection.content_set_id"
          choice
          role="listitem"
        />
      </div>
      <p class="mobile-result-decision__summary">+{{ result.levels }} уровень · {{ result.treasures }} сокровища</p>
    </template>
    <div v-else-if="result?.source === 'run-away'" class="mobile-result-decision__run-away">
      <strong>{{ result.escaped ? "УСПЕХ" : "НЕУДАЧА" }}</strong>
      <p>Бросок {{ result.roll }} {{ result.modifier >= 0 ? "+" : "−" }} {{ Math.abs(result.modifier) }} · итог {{ result.total }}</p>
      <span>{{ result.monsterName }}</span>
    </div>
    <template #footer>
      <ActionPanel
        :entries="actionPanelEntries"
        :cards="visibleCards"
        :player-names="playerNames"
        :label-overrides="result?.source === 'reward' ? {end_turn: 'Забрать и завершить ход'} : {end_turn: 'Продолжить'}"
        :busy="actionBusy"
        :context-card-name="contextCardName"
        @close="emit('close')"
        @execute="runAction"
      />
    </template>
  </SheetDialog>
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

.mobile-door-decision__deck {
  position: relative;
  width: 162px;
  height: 218px;
  margin: 8px auto 12px;
}

.mobile-result-decision__cards {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin: 34px 0 16px;
}
.mobile-run-away-decision__cards {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin: 14px 0 16px;
}
.mobile-run-away-decision__cards :deep(.choice-card-presentation) { flex-basis: 150px; }
.mobile-run-away-decision__cards :deep(.mobile-run-away-decision__card--selected) { border-color: var(--color-action-primary); }
.mobile-run-away-decision__summary {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 11px;
}
.mobile-result-decision__summary {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 11px;
}
.mobile-result-decision__run-away {
  min-height: 250px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  text-align: center;
}
.mobile-result-decision__run-away strong {
  min-width: 132px;
  border-radius: 999px;
  padding: 7px 12px;
  color: #fff;
  background: var(--color-action-primary);
  font-size: 11px;
}
.mobile-result-decision__run-away p { margin: 0; font-size: 20px; font-weight: 700; }
.mobile-result-decision__run-away span { color: var(--color-text-secondary); font-size: 13px; }

.mobile-door-decision__deck :deep(.deck-back) {
  width: 150px;
  height: 218px;
  border-radius: 14px;
  box-shadow:
    6px 0 0 rgb(255 253 248 / 72%),
    12px 0 0 rgb(255 253 248 / 42%),
    0 7px 18px rgb(59 46 40 / 14%);
}

.mobile-door-decision__deck strong {
  position: absolute;
  right: 18px;
  bottom: 8px;
  min-width: 44px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  color: var(--color-text-primary);
  background: var(--color-surface);
  box-shadow: 0 4px 12px rgb(23 62 67 / 14%);
}

.mobile-door-decision :deep(.action-dock) {
  width: 100%;
  border: 0;
  padding: 0;
}

.mobile-result-decision :deep(.action-dock) {
  width: 100%;
  border: 0;
  padding: 0;
}

.mobile-run-away-decision :deep(.action-dock) {
  width: 100%;
  border: 0;
  padding: 0;
}

.mobile-door-decision :deep(.action-dock__header),
.mobile-door-decision :deep(.action-choice > strong),
.mobile-door-decision :deep(.action-choice__source),
.mobile-door-decision :deep(.action-choice__hint),
.mobile-result-decision :deep(.action-dock__header),
.mobile-result-decision :deep(.action-choice > strong),
.mobile-result-decision :deep(.action-choice__source),
.mobile-result-decision :deep(.action-choice__hint) {
  display: none;
}
.mobile-run-away-decision :deep(.action-dock__header),
.mobile-run-away-decision :deep(.action-choice > strong),
.mobile-run-away-decision :deep(.action-choice__source),
.mobile-run-away-decision :deep(.action-choice__hint) { display: none; }

.mobile-door-decision :deep(.action-list),
.mobile-result-decision :deep(.action-list) {
  display: block;
}
.mobile-run-away-decision :deep(.action-list) { display: block; }

.mobile-door-decision :deep(.action-choice),
.mobile-result-decision :deep(.action-choice) {
  border: 0;
  padding: 0;
  background: transparent;
}
.mobile-run-away-decision :deep(.action-choice) { border: 0; padding: 0; background: transparent; }

.mobile-door-decision :deep(.action-choice__submit),
.mobile-result-decision :deep(.action-choice__submit) {
  width: 100%;
  min-height: 52px;
}
.mobile-run-away-decision :deep(.action-choice__submit) { width: 100%; min-height: 52px; }

.sheet-dialog.mobile-door-decision :deep(.sheet-dialog__surface) {
  gap: 20px;
  padding-top: 20px;
}

.sheet-dialog.mobile-door-decision :deep(.sheet-dialog__header) {
  padding-bottom: 0;
}

.sheet-dialog.mobile-door-decision :deep(.sheet-dialog__header h2) {
  font-size: 18px;
  line-height: 24px;
}

.sheet-dialog.mobile-door-decision :deep(.sheet-dialog__header p) {
  margin-top: 14px;
  font-size: 11px;
  line-height: 14px;
}

</style>
