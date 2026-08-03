<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import GameCard from "../GameCard.vue";
import SheetDialog from "../ui/SheetDialog.vue";
import {publicCardsForOpponent} from "./gameTableViewModel";
import {opponentStatus, opponentStatusLabel} from "./gamePresentationModel";

const props = defineProps<{projection: Projection}>();
const selectedPlayerID = ref("");
const roomIDVisible = ref(false);
const selectedPlayer = computed(() => props.projection.players.find((player) =>
  player.player_id === selectedPlayerID.value,
));

function closeDetails() {
  selectedPlayerID.value = "";
}
</script>

<template>
  <section
    class="opponent-roster"
    data-figma-region="desktop-opponents"
    aria-labelledby="opponent-roster-title"
  >
    <h2 id="opponent-roster-title">СОПЕРНИКИ · {{ projection.players.length }}</h2>

    <div v-if="projection.players.length" class="opponents" role="list">
      <button
        v-for="player in projection.players"
        :key="player.player_id"
        class="opponent-card"
        :class="{'opponent-card--active': projection.turn.player_id === player.player_id}"
        :data-player-id="player.player_id"
        type="button"
        role="listitem"
        aria-haspopup="dialog"
        :aria-label="`Информация об игроке ${player.name}`"
        @click="selectedPlayerID = player.player_id"
      >
        <span class="opponent-card__identity">
          <strong>{{ player.name }}</strong>
          <small>{{ player.level }} уровень</small>
        </span>
        <span class="opponent-card__metric">
          <small>СИЛА</small>
          <strong aria-label="Сила соперника не передана сервером">—</strong>
        </span>
      </button>
    </div>
    <p v-else class="opponent-roster__empty" role="status">Других игроков нет.</p>

    <section class="opponent-room" aria-labelledby="opponent-room-title">
      <p id="opponent-room-title">КОМНАТА</p>
      <strong>{{ projection.players.length + 1 }} игрока</strong>
      <span>Стол готов</span>
      <button type="button" :aria-pressed="roomIDVisible" @click="roomIDVisible = !roomIDVisible">
        {{ roomIDVisible ? projection.game_id : "Показать ID комнаты" }}
      </button>
    </section>

    <SheetDialog
      v-if="selectedPlayer"
      :open="Boolean(selectedPlayer)"
      :title="selectedPlayer.name"
      :description="`Уровень ${selectedPlayer.level} · ${selectedPlayer.hand_count} карт в руке`"
      v-bind="{titleID: 'opponent-info-title'}"
      data-figma-node="271:3216"
      @close="closeDetails"
    >
      <div class="opponent-info__summary">
        <span>{{ opponentStatusLabel(opponentStatus(projection, selectedPlayer)) }}</span>
      </div>
      <div
        v-if="publicCardsForOpponent(selectedPlayer).length"
        class="opponent-info__cards"
        role="list"
        aria-label="Открытые карты игрока"
      >
        <GameCard
          v-for="card in publicCardsForOpponent(selectedPlayer)"
          :key="card.instance_id"
          :card="card"
          :content-set-id="projection.content_set_id"
          compact
          role="listitem"
        />
      </div>
      <p v-else class="opponent-info__empty" role="status">Нет открытых карт.</p>
    </SheetDialog>
  </section>
</template>

<style scoped lang="scss">
.opponent-roster {
  min-width: 0;
  height: 100%;
  box-sizing: border-box;
  display: grid;
  align-content: start;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 20px;
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  padding: 16px;
  background: var(--color-surface);
}

.opponent-roster h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: .78rem;
  letter-spacing: .08em;
}

.opponents {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 8px;
  overflow-y: auto;
}

.opponent-card {
  width: 100%;
  min-height: 82px;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  padding: 13px;
  color: var(--color-text-primary);
  background: var(--color-surface);
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.opponent-card--active {
  border-color: var(--color-accent);
  box-shadow: inset 3px 0 var(--color-accent);
}

.opponent-card__identity {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.opponent-card__identity strong,
.opponent-card__identity small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.opponent-card__identity strong { font-size: .78rem; }
.opponent-card__identity small,
.opponent-card__metric small { color: var(--color-text-secondary); font-size: .62rem; }
.opponent-card__metric { display: grid; justify-items: end; gap: 3px; }
.opponent-card__metric strong { font-size: 1rem; }

.opponent-card:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.opponent-roster__empty,
.opponent-info__empty {
  margin: 0;
  color: var(--color-text-muted);
  font-size: .72rem;
}

.opponent-info__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.opponent-info__summary span {
  border: 1px solid var(--color-line);
  border-radius: 999px;
  padding: 5px 9px;
  font-size: .72rem;
}

.opponent-info__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.opponent-room {
  min-height: 141px;
  box-sizing: border-box;
  display: grid;
  align-content: start;
  gap: 7px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  padding: 12px;
  background: var(--color-surface-control);
}
.opponent-room p,
.opponent-room strong,
.opponent-room span { margin: 0; }
.opponent-room p { color: var(--color-text-muted); font-size: .58rem; font-weight: 800; letter-spacing: .1em; }
.opponent-room strong { font-size: .82rem; }
.opponent-room span { color: var(--color-text-secondary); font-size: .64rem; }
.opponent-room button { justify-self: start; min-height: 28px; border: 0; padding: 0; color: var(--color-accent-strong); background: transparent; font: inherit; font-size: .62rem; font-weight: 800; text-align: start; cursor: pointer; }

@media (width <= 1023px) {
  .opponent-roster {
    height: auto;
  }

  .opponents {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
