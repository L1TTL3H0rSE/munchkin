<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import {
  acceptedCombatHelper,
  projectedPlayerName,
} from "../interaction/helperOfferModel";

const props = defineProps<{
  projection: Projection;
}>();

const acceptedHelper = computed(() => acceptedCombatHelper(props.projection));
const acceptedHelperName = computed(() => acceptedHelper.value
  ? projectedPlayerName(props.projection, acceptedHelper.value.helperPlayerID)
  : "");
</script>

<template>
  <section class="table-context" aria-labelledby="game-context-title">
    <div class="table-context__header">
      <div>
        <p class="eyebrow">ТЕКУЩИЙ КОНТЕКСТ</p>
        <h2 id="game-context-title">
          {{ projection.turn.phase || "Игра завершена" }}
        </h2>
      </div>
      <dl class="table-context__totals">
        <div>
          <dt>Сила игрока</dt>
          <dd>{{ projection.turn.combat?.player_strength ?? projection.you.combat_strength }}</dd>
        </div>
        <div v-if="projection.turn.combat">
          <dt>Сила монстров</dt>
          <dd>{{ projection.turn.combat.monster_strength }}</dd>
        </div>
      </dl>
    </div>

    <div class="table-center">
      <div class="deck deck--door" aria-label="Колода дверей">
        <span>ДВЕРИ</span>
        <strong>{{ projection.door_deck_count }}</strong>
        <small>сброс {{ projection.door_discard_count }}</small>
      </div>

      <div class="encounter-area">
        <p class="eyebrow">ОБЯЗАТЕЛЬНОЕ РЕШЕНИЕ</p>
        <GameCard
          v-if="projection.turn.encounter"
          :card="projection.turn.encounter"
          :content-set-id="projection.content_set_id"
        />
        <div v-else class="phase-display">
          <small>ТЕКУЩАЯ ФАЗА</small>
          <h3>{{ projection.turn.phase || "игра завершена" }}</h3>
        </div>
        <div v-if="projection.turn.combat" class="combat-score" aria-label="Счёт боя">
          <strong>{{ projection.turn.combat.player_strength }}</strong>
          <span>против</span>
          <strong>{{ projection.turn.combat.monster_strength }}</strong>
          <span>
            {{ projection.turn.combat.player_winning ? "побеждаешь" : "проигрываешь" }}
          </span>
        </div>
        <div
          v-if="acceptedHelper"
          class="combat-helper-summary"
          role="status"
          aria-label="Принятая помощь в бою"
        >
          <p class="eyebrow">ПОМОЩЬ ПРИНЯТА СЕРВЕРОМ</p>
          <strong>{{ acceptedHelperName }}</strong>
          <span>Награда помощника: {{ acceptedHelper.rewardTreasures }} сокр.</span>
        </div>
        <div v-if="projection.turn.resolving.length" class="resolving-cards" aria-label="Разрешаемые карты">
          <GameCard
            v-for="card in projection.turn.resolving"
            :key="card.instance_id"
            :card="card"
            :content-set-id="projection.content_set_id"
            compact
          />
        </div>
      </div>

      <div class="deck deck--treasure" aria-label="Колода сокровищ">
        <span>СОКРОВИЩА</span>
        <strong>{{ projection.treasure_deck_count }}</strong>
        <small>сброс {{ projection.treasure_discard_count }}</small>
      </div>
    </div>
  </section>
</template>

<style scoped>
.table-context {
  display: grid;
  gap: 1rem;
}

.table-context__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
}

.table-context__header h2 {
  max-width: 30ch;
  margin: .4rem 0 0;
  overflow-wrap: anywhere;
  text-transform: uppercase;
}

.table-context__totals {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: .5rem;
  margin: 0;
}

.table-context__totals div {
  min-width: 7rem;
  border: 1px solid var(--line);
  padding: .5rem .65rem;
}

.table-context__totals dt {
  color: var(--muted);
  font-size: .62rem;
  text-transform: uppercase;
}

.table-context__totals dd {
  margin: .2rem 0 0;
  color: var(--acid);
  font-size: 1.35rem;
  font-weight: 900;
}

.table-center {
  min-width: 0;
  min-height: 360px;
  border: 1px solid var(--line);
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr) 130px;
  align-items: center;
  gap: 2rem;
  padding: 2rem;
  background: repeating-linear-gradient(45deg, #1b1d14, #1b1d14 10px, #191a12 10px, #191a12 20px);
}

.deck {
  aspect-ratio: 2.5 / 3.5;
  border: 2px solid;
  display: grid;
  place-items: center;
  align-content: center;
  gap: .5rem;
  padding: .5rem;
  text-align: center;
  transform: rotate(-2deg);
}

.deck strong {
  font-size: 2rem;
}

.deck--door { border-color: var(--acid); }
.deck--treasure { border-color: var(--orange); transform: rotate(2deg); }

.encounter-area {
  display: grid;
  justify-items: center;
  gap: 1rem;
  min-width: 0;
}

.encounter-area > .eyebrow {
  margin: 0;
  text-align: center;
}

.phase-display {
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: center;
}

.phase-display h3 {
  margin: .5rem;
  font-size: clamp(2rem, 5vw, 4rem);
  text-transform: uppercase;
}

.combat-score {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: .65rem;
}

.combat-score strong {
  color: var(--acid);
  font-size: 2rem;
}

.combat-helper-summary {
  display: grid;
  gap: .25rem;
  max-width: 34rem;
  border: 1px solid var(--acid);
  padding: .7rem 1rem;
  text-align: center;
}

.combat-helper-summary .eyebrow,
.combat-helper-summary strong,
.combat-helper-summary span {
  overflow-wrap: anywhere;
}

.combat-helper-summary .eyebrow {
  margin: 0;
}

.combat-helper-summary span {
  color: var(--muted);
}

.resolving-cards {
  display: flex;
  gap: .5rem;
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

@media (width <= 767px) {
  .table-context__header {
    flex-direction: column;
  }

  .table-context__totals {
    justify-content: start;
  }

  .table-center {
    grid-template-columns: 70px minmax(0, 1fr) 70px;
    gap: .5rem;
    min-height: 300px;
    padding: .75rem;
  }

  .deck {
    font-size: .7rem;
  }

  .deck strong {
    font-size: 1.2rem;
  }
}
</style>
