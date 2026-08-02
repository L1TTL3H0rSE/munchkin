<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import GameCard from "../GameCard.vue";
import SheetDialog from "../ui/SheetDialog.vue";
import {
  opponentDensity,
  publicCardsForOpponent,
} from "./gameTableViewModel";
import {
  desktopOpponentStatus,
  desktopOpponentStatusLabel,
} from "./desktop/desktopGameModel";

const props = defineProps<{
  projection: Projection;
}>();

const density = computed(() => opponentDensity(props.projection.players.length));
const selectedPlayerID = ref("");
const selectedPlayer = computed(() => props.projection.players.find((player) =>
  player.player_id === selectedPlayerID.value,
));

function openDetails(playerID: string) {
  selectedPlayerID.value = playerID;
}

function closeDetails() {
  selectedPlayerID.value = "";
}
</script>

<template>
  <section
    class="opponent-roster"
    :class="`opponent-roster--${density}`"
    aria-labelledby="opponent-roster-title"
  >
    <header class="opponent-roster__heading">
      <div>
        <p class="eyebrow">ПУБЛИЧНЫЙ СТОЛ</p>
        <h2 id="opponent-roster-title">{{ projection.players.length }} соперников</h2>
      </div>
      <p>Статус, уровень и открытые зоны видны по запросу. Руки соперников скрыты.</p>
    </header>

    <div v-if="projection.players.length" class="opponents" role="list">
      <article
        v-for="player in projection.players"
        :key="player.player_id"
        class="player-strip"
        :class="{active: projection.turn.player_id === player.player_id}"
        :data-player-id="player.player_id"
        role="listitem"
      >
        <div class="player-strip__avatar" aria-hidden="true">
          {{ player.name.slice(0, 1).toUpperCase() }}
        </div>
        <div class="player-strip__body">
          <div class="player-strip__headline">
            <strong>{{ player.name }}</strong>
            <span v-if="projection.turn.player_id === player.player_id" class="player-strip__turn">
              ХОД
            </span>
          </div>
          <div class="player-strip__stats">
            <span>Уровень {{ player.level }}</span>
            <span>Рука {{ player.hand_count }}</span>
          </div>
          <span
            class="player-strip__status"
            :data-status="desktopOpponentStatus(projection, player)"
          >
            {{ desktopOpponentStatusLabel(desktopOpponentStatus(projection, player)) }}
          </span>
        </div>
        <button
          class="player-strip__details"
          type="button"
          aria-haspopup="dialog"
          :aria-label="`Открыть публичные зоны игрока ${player.name}`"
          @click="openDetails(player.player_id)"
        >
          Зоны
        </button>
      </article>
    </div>
    <p v-else class="opponent-roster__empty" role="status">
      В комнате пока нет других игроков.
    </p>

    <SheetDialog
      v-if="selectedPlayer"
      :open="Boolean(selectedPlayer)"
      :title="`Публичные зоны: ${selectedPlayer.name}`"
      description="Показываем только открытые карты и server-projected hand count."
      v-bind="{titleID: 'opponent-zones-title'}"
      @close="closeDetails"
    >
      <div class="opponent-detail__summary">
        <strong>{{ selectedPlayer.name }}</strong>
        <span>Уровень {{ selectedPlayer.level }} · Рука {{ selectedPlayer.hand_count }}</span>
        <span>{{ desktopOpponentStatusLabel(desktopOpponentStatus(projection, selectedPlayer)) }}</span>
      </div>
      <div
        v-if="publicCardsForOpponent(selectedPlayer).length"
        class="opponent-detail__cards"
        role="list"
        aria-label="Открытые карты соперника"
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
      <p v-else class="opponent-detail__empty" role="status">
        Открытых карт нет. Содержимое руки не раскрывается.
      </p>
    </SheetDialog>
  </section>
</template>

<style scoped lang="scss">
.opponent-roster {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}

.opponent-roster__heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-3);
}

.opponent-roster__heading h2,
.opponent-roster__heading p {
  margin: 0;
}

.opponent-roster__heading h2 {
  margin-top: var(--space-1);
  font-size: clamp(1.05rem, 1.8vw, 1.35rem);
}

.opponent-roster__heading > p {
  max-width: 52ch;
  color: var(--color-text-muted);
  font-size: .74rem;
  line-height: 1.4;
  text-align: end;
}

.opponents {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--space-2);
  min-width: 0;
}

.player-strip {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  padding: var(--space-2);
  background: var(--color-paper);
}

.player-strip.active {
  border-color: var(--color-accent-strong);
  box-shadow: inset 4px 0 var(--color-accent-strong);
}

.player-strip__avatar {
  width: 2.35rem;
  height: 2.35rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--color-paper);
  background: var(--color-accent-strong);
  font-weight: 900;
}

.player-strip[data-player-id] .player-strip__avatar {
  flex: 0 0 auto;
}

.player-strip__body {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.player-strip__headline,
.player-strip__stats {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-1);
}

.player-strip__headline strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-strip__stats,
.player-strip__status {
  color: var(--color-text-muted);
  font-size: .65rem;
}

.player-strip__turn {
  color: var(--color-accent-strong);
  font-family: var(--font-meta);
  font-size: .58rem;
  font-weight: 900;
}

.player-strip__status {
  font-weight: 800;
}

.player-strip__status[data-status="active"] { color: var(--color-accent-strong); }
.player-strip__status[data-status="dead"] { color: var(--color-danger); }
.player-strip__status[data-status="waiting"] { color: var(--color-info); }

.player-strip__details {
  grid-column: 1 / -1;
  min-height: 2.75rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: transparent;
  font: inherit;
  font-size: .72rem;
  cursor: pointer;
}

.player-strip__details:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.opponent-roster__empty,
.opponent-detail__empty {
  margin: 0;
  border: 1px dashed var(--color-line);
  padding: var(--space-3);
  color: var(--color-text-muted);
}

.opponent-detail__summary {
  display: grid;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}

.opponent-detail__summary span {
  color: var(--color-text-muted);
  font-size: .8rem;
}

.opponent-detail__cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-3);
}

@media (width <= 1023px) {
  .opponents {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (width <= 767px) {
  .opponent-roster__heading {
    align-items: start;
    flex-direction: column;
  }

  .opponent-roster__heading > p {
    text-align: start;
  }

  .opponents {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 420px) {
  .opponents {
    grid-template-columns: 1fr;
  }
}

@media (forced-colors: active) {
  .player-strip,
  .player-strip__details,
  .opponent-roster__empty,
  .opponent-detail__empty {
    border-color: CanvasText;
  }
}
</style>
