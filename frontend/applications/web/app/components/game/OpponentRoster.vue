<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import {opponentDensity, publicCardsForOpponent} from "./gameTableViewModel";

const props = defineProps<{
  projection: Projection;
}>();

const density = computed(() => opponentDensity(props.projection.players.length));
</script>

<template>
  <section
    class="opponent-roster"
    :class="`opponent-roster--${density}`"
    aria-labelledby="opponent-roster-title"
  >
    <div class="opponent-roster__heading">
      <div>
        <p class="eyebrow">ОТКРЫТЫЕ ИГРОКИ</p>
        <h2 id="opponent-roster-title">{{ projection.players.length }} соперников</h2>
      </div>
      <p>Рука соперников скрыта; открытые зоны видны по запросу.</p>
    </div>

    <div class="opponents">
      <article
        v-for="player in projection.players"
        :key="player.player_id"
        class="player-strip"
        :class="{active: projection.turn.player_id === player.player_id}"
        :data-player-id="player.player_id"
      >
        <div class="player-strip__headline">
          <strong>{{ player.name }}</strong>
          <span v-if="projection.turn.player_id === player.player_id" class="player-strip__turn">
            ХОД
          </span>
        </div>
        <div class="player-strip__stats">
          <span>УРОВЕНЬ {{ player.level }}</span>
          <span>{{ player.hand_count }} карт в руке</span>
        </div>
        <span v-if="player.dead">Мёртв — ждёт следующего хода</span>
        <span v-else-if="!player.setup_done && projection.status === 'active'">
          Готовит стартовую руку
        </span>
        <details v-if="publicCardsForOpponent(player).length" class="player-strip__zones">
          <summary>Показать открытые зоны ({{ publicCardsForOpponent(player).length }})</summary>
          <div class="public-cards">
            <GameCard
              v-for="card in publicCardsForOpponent(player)"
              :key="card.instance_id"
              :card="card"
              :content-set-id="projection.content_set_id"
              compact
            />
          </div>
        </details>
      </article>
    </div>
  </section>
</template>

<style scoped>
.opponent-roster {
  display: grid;
  gap: .8rem;
  margin: 1.5rem 0;
}

.opponent-roster__heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.opponent-roster__heading h2 {
  margin: .35rem 0 0;
  font-size: clamp(1.2rem, 3vw, 1.8rem);
}

.opponent-roster__heading > p {
  max-width: 44ch;
  margin: 0;
  color: var(--muted);
  font-size: .82rem;
  line-height: 1.4;
  text-align: end;
}

.opponents {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: .6rem;
}

.player-strip {
  min-width: 0;
  border: 1px solid var(--line);
  padding: .8rem;
  display: grid;
  gap: .45rem;
  color: var(--muted);
}

.player-strip.active {
  border-color: var(--acid);
  box-shadow: inset 4px 0 var(--acid);
}

.player-strip strong { color: var(--ink); }

.player-strip__headline,
.player-strip__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: .5rem;
}

.player-strip__stats {
  justify-content: start;
  color: var(--muted);
  font-size: .72rem;
  text-transform: uppercase;
}

.player-strip__turn {
  color: var(--acid);
  font-size: .62rem;
  font-weight: 900;
  letter-spacing: .12em;
}

.player-strip__zones {
  min-width: 0;
  margin-top: .25rem;
  border-top: 1px solid var(--line);
  padding-top: .45rem;
}

.player-strip__zones summary {
  cursor: pointer;
  color: var(--acid);
  font-size: .72rem;
  font-weight: 800;
}

.public-cards {
  display: flex;
  gap: .35rem;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  padding-top: .65rem;
}

@media (width <= 599px) {
  .opponent-roster__heading {
    align-items: start;
    flex-direction: column;
  }

  .opponent-roster__heading > p {
    text-align: start;
  }
}
</style>
