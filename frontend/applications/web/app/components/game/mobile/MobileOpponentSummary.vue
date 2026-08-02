<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";

import GameCard from "../../GameCard.vue";
import SheetDialog from "../../ui/SheetDialog.vue";
import {publicCardsForOpponent} from "../gameTableViewModel";
import {
  mobileOpponentStatus,
  mobileOpponentStatusLabel,
} from "./mobileGameModel";

defineProps<{
  projection: Projection;
}>();

const detailsOpen = ref(false);

function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

function closeDetails() {
  detailsOpen.value = false;
}
</script>

<template>
  <section
    v-if="projection.players.length"
    class="mobile-opponents"
    aria-labelledby="mobile-opponents-title"
  >
    <header class="mobile-opponents__header">
      <div>
        <p class="mobile-opponents__eyebrow">СТОЛ</p>
        <h2 id="mobile-opponents-title">
          Соперники <span>{{ projection.players.length }}</span>
        </h2>
      </div>
      <button
        class="mobile-opponents__details"
        type="button"
        aria-label="Открыть детали соперников"
        :disabled="!projection.players.length"
        :aria-expanded="detailsOpen"
        @click="detailsOpen = true"
      >
        <span class="mobile-opponents__details-full">Открыть детали</span>
        <span class="mobile-opponents__details-compact" aria-hidden="true">Детали</span>
      </button>
    </header>

    <div
      v-if="projection.players.length"
      class="mobile-opponents__rail"
      role="list"
      tabindex="0"
      aria-label="Список соперников, прокручиваемый"
    >
      <article
        v-for="player in projection.players"
        :key="player.player_id"
        class="mobile-opponent-chip"
        :class="{'mobile-opponent-chip--current': projection.turn.player_id === player.player_id}"
        role="listitem"
      >
        <span class="mobile-opponent-chip__avatar" aria-hidden="true">
          {{ initial(player.name) }}
        </span>
        <span class="mobile-opponent-chip__copy">
          <strong>{{ player.name }}</strong>
          <small>ур. {{ player.level }} · рука {{ player.hand_count }}</small>
        </span>
        <span class="mobile-opponent-chip__status">
          {{ mobileOpponentStatusLabel(mobileOpponentStatus(projection, player)) }}
        </span>
      </article>
    </div>
  </section>

  <SheetDialog
    :open="detailsOpen"
    :title="`Соперники · ${projection.players.length}`"
    title-id="mobile-opponents-details-title"
    description="Виден только публичный профиль и открытые зоны. Карты руки представлены числом."
    @close="closeDetails"
  >
    <div class="mobile-opponents__details-list" role="list">
      <article
        v-for="player in projection.players"
        :key="`details-${player.player_id}`"
        class="mobile-opponent-detail"
        role="listitem"
      >
        <div class="mobile-opponent-detail__summary">
          <span class="mobile-opponent-chip__avatar" aria-hidden="true">
            {{ initial(player.name) }}
          </span>
          <div>
            <strong>{{ player.name }}</strong>
            <p>
              Уровень {{ player.level }} · рука {{ player.hand_count }} ·
              {{ mobileOpponentStatusLabel(mobileOpponentStatus(projection, player)) }}
            </p>
          </div>
        </div>
        <p class="mobile-opponent-detail__privacy">
          Открытых карт: {{ publicCardsForOpponent(player).length }}
        </p>
        <div
          v-if="publicCardsForOpponent(player).length"
          class="mobile-opponent-detail__cards"
          role="list"
        >
          <GameCard
            v-for="card in publicCardsForOpponent(player)"
            :key="card.instance_id"
            :card="card"
            :content-set-id="projection.content_set_id"
            compact
            role="listitem"
          />
        </div>
      </article>
    </div>
  </SheetDialog>
</template>

<style scoped lang="scss">
.mobile-opponents {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}

.mobile-opponents__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.mobile-opponents__eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-family: var(--font-meta);
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.mobile-opponents h2 {
  margin: .2rem 0 0;
  font-size: .9rem;
}

.mobile-opponents h2 span {
  color: var(--color-text-muted);
  font-family: var(--font-meta);
  font-size: .75rem;
  font-weight: 500;
}

.mobile-opponents__details {
  min-height: 2.5rem;
  border: 1px solid var(--color-line);
  padding: .35rem .6rem;
  color: var(--color-text);
  background: transparent;
  font-size: .7rem;
}

.mobile-opponents__details-compact {
  display: none;
}

.mobile-opponents__rail {
  display: flex;
  gap: var(--space-2);
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  padding: .1rem .1rem .35rem;
  scroll-padding-inline: var(--space-2);
  scroll-snap-type: inline proximity;
}

.mobile-opponent-chip {
  flex: 0 0 min(13rem, calc(100vw - 3rem));
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-control);
  padding: var(--space-2);
  background: var(--color-paper);
  scroll-snap-align: start;
}

.mobile-opponent-chip--current {
  border-color: var(--color-accent-strong);
  box-shadow: inset 3px 0 var(--color-accent-strong);
}

.mobile-opponent-chip__avatar {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 50%;
  color: var(--color-paper);
  background: var(--color-accent-strong);
  font-weight: 900;
}

.mobile-opponent-chip__copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.mobile-opponent-chip__copy strong {
  overflow: hidden;
  color: var(--color-text);
  font-size: .75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-opponent-chip__copy small,
.mobile-opponent-chip__status {
  color: var(--color-text-muted);
  font-size: .62rem;
}

.mobile-opponent-chip__status {
  grid-column: 2;
  color: var(--color-accent-strong);
  font-weight: 800;
}

.mobile-opponents__empty {
  margin: 0;
  color: var(--color-text-muted);
  font-size: .75rem;
}

.mobile-opponents__details-list {
  display: grid;
  gap: var(--space-3);
}

.mobile-opponent-detail {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-line);
  padding-bottom: var(--space-3);
}

.mobile-opponent-detail__summary {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.mobile-opponent-detail__summary strong,
.mobile-opponent-detail__summary p {
  overflow-wrap: anywhere;
}

.mobile-opponent-detail__summary p,
.mobile-opponent-detail__privacy {
  margin: .2rem 0 0;
  color: var(--color-text-muted);
  font-size: .72rem;
  line-height: 1.35;
}

.mobile-opponent-detail__cards {
  display: flex;
  gap: var(--space-2);
  min-width: 0;
  overflow-x: auto;
  padding-bottom: var(--space-1);
}

@media (width <= 374px) {
  .mobile-opponents__details {
    padding-inline: .45rem;
  }

  .mobile-opponent-chip {
    flex-basis: min(12rem, calc(100vw - 2.5rem));
  }
}
</style>
