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
import GameCard from "../../GameCard.vue";
import DesktopEncounterStage from "./DesktopEncounterStage.vue";
import DesktopGameHeader from "./DesktopGameHeader.vue";
import {desktopStateFamily} from "./desktopGameModel";
import OpponentRoster from "../OpponentRoster.vue";
import OwnBoard from "../OwnBoard.vue";

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
const availableHandCount = computed(() => props.projection.you.hand.filter((card) =>
  props.bindingsForCard(card.instance_id).length > 0 && props.stateForCard(card.instance_id) !== "disabled",
).length);
const showActionDock = computed(() =>
  props.actionPanelEntries.length > 0 || Boolean(props.contextCardName),
);
const winner = computed(() => {
  const participants = [props.projection.you, ...props.projection.players];
  return participants.find((player) => player.player_id === props.projection.winner_player_id)
    ?? props.projection.you;
});
const viewerWon = computed(() => props.projection.winner_player_id === props.projection.you.player_id);

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
    <DesktopGameHeader
      :projection="projection"
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
        <DesktopEncounterStage :projection="projection" />

        <section class="desktop-hand-tray" aria-labelledby="desktop-hand-title">
          <header class="desktop-hand-tray__header">
            <div>
              <p class="eyebrow">ТВОЯ РУКА</p>
              <h2 id="desktop-hand-title">Карты игрока · {{ projection.you.hand.length }}</h2>
            </div>
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
        <section
          v-if="projection.status === 'finished'"
          class="desktop-victory-summary"
          aria-labelledby="desktop-victory-summary-title"
        >
          <p id="desktop-victory-summary-title" class="eyebrow">
            {{ viewerWon ? "ИТОГ ПАРТИИ" : "АРХИВ ПАРТИИ" }}
          </p>
          <div class="desktop-victory-summary__card">
            <p class="eyebrow">{{ viewerWon ? "ИТОГ ПАРТИИ" : "АРХИВ ПАРТИИ" }}</p>
            <h2>{{ viewerWon ? `1 место · ${winner.name}` : "Итоги сохранены" }}</h2>
            <p>Победитель: {{ winner.name }}</p>
            <p>Уровень {{ winner.level }}</p>
          </div>
        </section>

        <OwnBoard
          :projection="projection"
          :bindings-for-card="bindingsForCard"
          :state-for-card="stateForCard"
          :confirmed-card-ids="confirmedCardIds"
          @activate="emit('activate', $event)"
        />

        <section
          v-if="projection.status === 'finished'"
          class="desktop-victory-actions"
          aria-labelledby="desktop-victory-actions-title"
        >
          <p class="eyebrow">ИТОГИ</p>
          <h2 id="desktop-victory-actions-title">
            {{ viewerWon ? "Посмотреть результаты" : "Посмотреть таблицу" }}
          </h2>
          <p>История партии сохранена сервером и доступна только для чтения.</p>
          <NuxtLink to="/">Вернуться в лобби</NuxtLink>
        </section>

        <section
          v-else-if="economyEntries.length || showActionDock"
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
  grid-template-columns: minmax(0, 768px) minmax(0, 360px);
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
  gap: 10px;
  overflow: hidden;
  border-radius: var(--radius-panel);
  padding: 14px 16px 12px;
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
.desktop-hand-tray__header h2,
.desktop-hand-tray__header span {
  margin: 0;
}

.desktop-hand-tray__header .eyebrow {
  color: #b9d8cc;
  font-size: .58rem;
}

.desktop-hand-tray__header h2 {
  margin-top: 3px;
  font-size: .8rem;
  letter-spacing: .03em;
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
  gap: 10px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px 2px 4px;
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

.desktop-victory-summary {
  min-width: 0;
  display: grid;
  gap: var(--space-3);
}

.desktop-victory-summary > .eyebrow,
.desktop-victory-summary__card p,
.desktop-victory-summary__card h2 {
  margin: 0;
}

.desktop-victory-summary__card {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 8px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  padding: 16px;
  color: var(--color-text-primary);
  background: var(--color-surface-control);
}

.desktop-victory-summary__card h2 {
  margin-top: 8px;
  overflow-wrap: anywhere;
  font-size: 1.1rem;
}

.desktop-victory-summary__card p:not(.eyebrow) {
  color: var(--color-text-secondary);
  font-size: .72rem;
}

.desktop-victory-actions {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 8px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  padding: 16px;
  color: var(--color-text-primary);
  background: var(--color-surface-control);
}

.desktop-victory-actions .eyebrow,
.desktop-victory-actions h2,
.desktop-victory-actions p {
  margin: 0;
}

.desktop-victory-actions h2 {
  margin-top: 10px;
  font-size: .92rem;
}

.desktop-victory-actions p {
  color: var(--color-text-secondary);
  font-size: .68rem;
  line-height: 1.4;
}

.desktop-victory-actions a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  margin-top: auto;
  border-radius: var(--radius-control);
  padding: .65rem 1rem;
  color: #fff9ef;
  background: var(--color-action-primary);
  font-weight: 800;
  text-decoration: none;
}

@media (width >= 1024px) {
  .desktop-game-table {
    height: 100%;
    min-height: 0;
    overflow: hidden;
    grid-template-columns: 248px minmax(0, 768px) 360px;
    grid-template-rows: 56px minmax(0, 1fr);
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
    height: 100%;
    grid-column: 2 / -1;
    grid-row: 2;
  }

  .desktop-game-table__main > .desktop-game-table__center {
    min-height: 0;
    height: 100%;
    grid-column: 1;
    grid-row: 1;
  }

  .desktop-game-table__main > .desktop-game-table__side {
    min-height: 0;
    height: 100%;
    grid-column: 2;
    grid-row: 1;
  }

  .desktop-game-table[data-state="finished"] .desktop-game-table__side {
    gap: 16px;
  }

  .desktop-game-table[data-state="finished"] .desktop-victory-summary {
    min-height: 332px;
    grid-template-rows: auto 236px;
    gap: 64px;
  }

  .desktop-game-table[data-state="finished"] .desktop-victory-summary__card {
    height: 236px;
    box-sizing: border-box;
  }

  .desktop-game-table[data-state="finished"] .desktop-victory-actions {
    min-height: 204px;
    margin-top: 8px;
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
