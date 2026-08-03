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
import GameCard from "../../GameCard.vue";
import DesktopEncounterStage from "./DesktopEncounterStage.vue";
import DesktopGameHeader from "./DesktopGameHeader.vue";
import type {GamePresentationModel} from "../gamePresentationModel";
import OpponentRoster from "../OpponentRoster.vue";
import OwnBoard from "../OwnBoard.vue";

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
  bindingsForCard: (cardID: string) => CardActionBinding[];
  stateForCard: (cardID: string) => CardActionState;
  confirmedCardIds: ReadonlySet<string>;
}>();

const availableHandCount = computed(() => props.projection.you.hand.filter((card) =>
  props.bindingsForCard(card.instance_id).length > 0 && props.stateForCard(card.instance_id) !== "disabled",
).length);
const showActionDock = computed(() =>
  props.actionPanelEntries.length > 0 || Boolean(props.contextCardName),
);
const viewerWon = computed(() => props.projection.winner_player_id === props.projection.you.player_id);

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
    class="desktop-game-table"
    :data-state-family="presentationModel.family"
    :data-figma-node="presentationModel.desktopNodeID"
    :data-phase="projection.turn.phase || 'waiting'"
    :data-state="projection.status"
    :aria-busy="isBusy"
    aria-label="Игровой стол для desktop и tablet"
  >
    <DesktopGameHeader
      :projection="projection"
      :presentation-model="presentationModel"
      :connection-state="connectionState"
      :finished="projection.status === 'finished'"
      :victory="viewerWon"
    />

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
      <div class="desktop-game-table__center">
        <DesktopEncounterStage
          :projection="projection"
          :presentation-model="presentationModel"
        />

        <section class="desktop-hand-tray" aria-labelledby="desktop-hand-title">
          <header class="desktop-hand-tray__header">
            <p id="desktop-hand-title" class="eyebrow">РУКА · {{ projection.you.hand.length }}</p>
            <span>{{ availableHandCount }} {{ availableHandCount === 1 ? "карта доступна" : "карты доступны" }} сейчас</span>
          </header>
          <div
            v-if="projection.you.hand.length"
            class="desktop-hand-tray__rail"
            role="list"
            tabindex="0"
            aria-label="Карты в руке"
          >
            <GameCard
              v-for="card in projection.you.hand"
              :key="`desktop-hand-${card.instance_id}`"
              :card="card"
              :content-set-id="projection.content_set_id"
              choice
              compact
              :action-bindings="bindingsForCard(card.instance_id)"
              :action-state="stateForCard(card.instance_id)"
              :motion-state="confirmedCardIds.has(card.instance_id) ? 'confirmed' : undefined"
              role="listitem"
              @activate="emit('activate', $event)"
            />
          </div>
          <p v-else class="desktop-hand-tray__empty" role="status">Рука пуста.</p>
        </section>
      </div>

      <aside class="desktop-game-table__side" aria-label="Сводка игрока и контекстные действия">
        <OwnBoard
          :projection="projection"
          :presentation-model="presentationModel"
          :bindings-for-card="bindingsForCard"
          :state-for-card="stateForCard"
          :confirmed-card-ids="confirmedCardIds"
          @activate="emit('activate', $event)"
          @open-strength="emit('open-strength')"
        />

        <section
          v-if="projection.status !== 'finished' && showActionDock"
          class="desktop-game-table__actions"
          aria-label="Контекстные действия текущей проекции"
        >
          <ActionPanel
            v-if="showActionDock"
            :entries="actionPanelEntries"
            :cards="visibleCards"
            :player-names="playerNames"
            :label-overrides="{open_door: 'Открыть дверь', end_turn: 'Продолжить'}"
            :busy="actionBusy"
            :context-card-name="contextCardName"
            @close="emit('close')"
            @execute="runAction"
          />
        </section>

        <p
          v-else-if="projection.status === 'active'"
          class="desktop-game-table__waiting"
          role="status"
        >
          Ожидаем подтверждённый ход другого игрока.
        </p>
      </aside>
    </div>
  </section>
</template>

<style scoped lang="scss">
.desktop-game-table {
  min-width: 0;
  display: grid;
  position: relative;
  align-content: stretch;
  gap: var(--space-4);
}

.desktop-game-table__connection {
  min-width: 0;
  position: absolute;
  z-index: 4;
  top: 8px;
  right: 16px;
  width: min(23rem, calc(100% - 2rem));
}

.desktop-game-table__main {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  align-items: start;
  gap: 16px;
}

.desktop-game-table__center {
  min-width: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 278px;
  gap: 16px;
}

.desktop-game-table__side {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space-4);
}

.desktop-game-table__actions {
  min-width: 0;
  display: grid;
  gap: var(--space-3);
}

.desktop-hand-tray {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 14px;
  overflow: hidden;
  border-radius: var(--radius-panel);
  padding: 18px 20px 14px;
  color: #fff9ef;
  background: var(--color-surface-inverse);
}

.desktop-hand-tray__header {
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.desktop-hand-tray__header p,
.desktop-hand-tray__header span {
  margin: 0;
}

.desktop-hand-tray__header .eyebrow {
  color: #b9d8cc;
  font-size: .58rem;
}

.desktop-hand-tray__header > span {
  color: #cfc2b1;
  font-size: .62rem;
  text-align: end;
}

.desktop-hand-tray__rail {
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: stretch;
  justify-content: safe center;
  gap: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0;
  scrollbar-color: #756659 transparent;
}

.desktop-hand-tray__rail :deep(.card-frame--compact) {
  flex: 0 0 150px;
  width: 150px;
  min-height: 218px;
  height: 218px;
  grid-template-rows: auto 76px minmax(0, 1fr) auto;
  border-color: #cfc2b1;
  border-radius: 12px;
  padding: 8px;
  color: var(--color-text-primary);
  background: var(--color-surface);
  box-shadow: none;
}

.desktop-hand-tray__rail :deep(.card-frame__art) {
  border-color: var(--color-border-card);
}

.desktop-hand-tray__rail :deep(.game-card__name) {
  font-family: var(--font-card);
  font-size: .74rem;
}

.desktop-hand-tray__rail :deep(.game-card__rules) {
  max-height: 3.2em;
  overflow: hidden;
  font-size: .58rem;
}

.desktop-hand-tray__empty {
  margin: 0;
  align-self: center;
  color: #cfc2b1;
  font-size: .72rem;
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

@media (width >= 1024px) {
  .desktop-game-table {
    min-height: 868px;
    overflow: visible;
    grid-template-columns: clamp(200px, 18vw, 248px) minmax(0, 1fr) clamp(280px, 25vw, 360px);
    grid-template-rows: 56px minmax(796px, auto);
    column-gap: 16px;
    row-gap: 16px;
  }

  .desktop-game-table > .desktop-game-header {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .desktop-game-table > .opponent-roster {
    grid-column: 1;
    grid-row: 2;
  }

  .desktop-game-table > .desktop-game-table__main {
    min-height: 0;
    align-self: stretch;
    grid-column: 2 / -1;
    grid-row: 2;
  }

  .desktop-game-table__main > .desktop-game-table__center {
    min-height: 0;
    align-self: stretch;
    grid-column: 1;
    grid-row: 1;
  }

  .desktop-game-table__main > .desktop-game-table__side {
    min-height: 0;
    align-self: stretch;
    grid-column: 2;
    grid-row: 1;
  }

}

@media (width <= 1023px) {
  .desktop-game-table {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr);
  }

  .desktop-game-table__main {
    display: grid;
    grid-column: 1;
    grid-row: 3;
    grid-template-columns: minmax(0, 1fr) minmax(260px, .72fr);
    gap: var(--space-4);
  }

  .desktop-game-table__main > .desktop-game-table__center,
  .desktop-game-table__main > .desktop-game-table__side {
    grid-column: auto;
    grid-row: auto;
  }

  .desktop-game-table__main {
    min-width: 0;
    grid-template-columns: minmax(0, 1fr) minmax(260px, .72fr);
  }

  .desktop-game-table__center {
    grid-template-rows: auto auto;
  }

  .desktop-game-table__side {
    align-items: start;
  }

  .desktop-game-table__waiting,
  .desktop-game-table__result {
    grid-column: 1 / -1;
  }
}

@media (width <= 599px) {
  .desktop-game-table {
    display: none;
  }

  .desktop-game-table__main {
    grid-template-columns: 1fr;
  }

  .desktop-game-table__side {
    grid-template-columns: 1fr;
  }
}
</style>
