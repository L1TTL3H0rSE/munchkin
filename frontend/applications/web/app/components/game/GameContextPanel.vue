<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import {
  acceptedCombatHelper,
  projectedPlayerName,
} from "../interaction/helperOfferModel";
import {
  combatEffectTarget,
  combatEffects,
  combatMonsters,
} from "../interaction/advancedCombatModel";
import {
  runAwayAttemptMonsterName,
  runAwayAttemptPlayerName,
  runAwayAttemptResult,
  runAwayAttemptRoll,
  runAwayCurrentPlayerName,
  runAwayEffectLabel,
  runAwayMonsterName,
  runAwayState,
} from "../interaction/targetRunAwayModel";

const props = defineProps<{
  projection: Projection;
}>();

const acceptedHelper = computed(() => acceptedCombatHelper(props.projection));
const acceptedHelperName = computed(() => acceptedHelper.value
  ? projectedPlayerName(props.projection, acceptedHelper.value.helperPlayerID)
  : "");
const visibleCombatMonsters = computed(() => combatMonsters(props.projection));
const primaryCombatMonster = computed(() => visibleCombatMonsters.value[0]);
const visibleCombatEffects = computed(() => combatEffects(props.projection));
const runAway = computed(() => runAwayState(props.projection));
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
        <div
          v-if="visibleCombatMonsters.length > 1"
          class="combat-monsters"
          aria-label="Монстры текущего боя"
        >
          <article
            v-for="(monster, index) in visibleCombatMonsters"
            :key="monster.instance_id"
            class="combat-monster"
          >
            <p class="eyebrow">
              {{ index === 0 ? "МОНСТР ВСТРЕЧИ" : "ДОПОЛНИТЕЛЬНЫЙ МОНСТР" }}
            </p>
            <GameCard
              :card="monster"
              :content-set-id="projection.content_set_id"
            />
          </article>
        </div>
        <GameCard
          v-else-if="primaryCombatMonster"
          :card="primaryCombatMonster"
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
        <div
          v-if="visibleCombatEffects.length"
          class="combat-effects"
          aria-label="Эффекты текущего боя"
        >
          <article
            v-for="effect in visibleCombatEffects"
            :key="effect.effect_id"
            class="combat-effect"
            :data-state="effect.active ? 'active' : 'inactive'"
          >
            <strong>
              {{ effect.kind === "enhance_monster"
                ? "Усиление монстра"
                : "Эффект боя" }}
            </strong>
            <span>{{ combatEffectTarget(projection, effect) }}</span>
            <span v-if="effect.amount">+{{ effect.amount }} силы</span>
            <small>{{ effect.active ? "Подтверждено проекцией" : "Снято сервером" }}</small>
          </article>
        </div>
        <section
          v-if="runAway"
          class="run-away-summary"
          aria-label="Состояние побега"
        >
          <div class="run-away-summary__header">
            <div>
              <p class="eyebrow">ПОБЕГ</p>
              <strong>{{ runAway.completed ? "Шаги завершены сервером" : "Текущий шаг" }}</strong>
            </div>
            <div class="run-away-summary__participants">
              <span>Участник: {{ runAwayCurrentPlayerName(projection) }}</span>
              <span>
                Монстр:
                {{ runAwayMonsterName(projection, runAway.current_monster_instance_id) }}
              </span>
            </div>
          </div>
          <ol v-if="runAway.attempts.length" class="run-away-attempts">
            <li
              v-for="(attempt, index) in runAway.attempts"
              :key="`${attempt.player_id}:${attempt.monster_instance_id}:${index}`"
            >
              <strong>Шаг {{ index + 1 }}</strong>
              <span>
                {{ runAwayAttemptPlayerName(projection, attempt) }} ·
                {{ runAwayAttemptMonsterName(projection, attempt) }}
              </span>
              <span>{{ runAwayAttemptRoll(attempt) }}</span>
              <small>{{ runAwayAttemptResult(attempt) }}</small>
            </li>
          </ol>
          <p v-else class="run-away-summary__empty" role="status">
            Ожидаем текущий server-owned attempt.
          </p>
          <div v-if="runAway.effects.length" class="run-away-effects">
            <span
              v-for="effect in runAway.effects"
              :key="effect.effect_id"
              :data-state="effect.active ? 'active' : 'inactive'"
            >
              {{ runAwayEffectLabel(effect) }} ·
              {{ effect.active ? "Подтверждено" : "Снято сервером" }}
            </span>
          </div>
        </section>
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
  min-width: 0;
  overflow: hidden;
  overflow-wrap: anywhere;
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

.encounter-area > .eyebrow,
.phase-display {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
}

.combat-monsters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: .75rem;
  width: 100%;
  min-width: 0;
}

.combat-monster {
  display: grid;
  gap: .4rem;
  min-width: 0;
}

.combat-monster > .eyebrow {
  margin: 0;
  color: var(--muted);
  text-align: center;
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
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
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

.combat-effects {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: .5rem;
  width: 100%;
  min-width: 0;
}

.combat-effect {
  display: grid;
  gap: .2rem;
  min-width: 0;
  border: 1px solid var(--line);
  padding: .65rem .75rem;
  overflow-wrap: anywhere;
}

.combat-effect[data-state="inactive"] {
  opacity: .65;
}

.combat-effect strong {
  color: var(--acid);
}

.combat-effect small {
  color: var(--muted);
}

.run-away-summary {
  display: grid;
  gap: .75rem;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--acid);
  padding: .8rem;
  overflow-wrap: anywhere;
}

.run-away-summary__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
}

.run-away-summary__header p {
  margin: 0 0 .25rem;
}

.run-away-summary__participants {
  display: grid;
  gap: .25rem;
  color: var(--muted);
  text-align: end;
}

.run-away-attempts {
  display: grid;
  gap: .5rem;
  margin: 0;
  padding-left: 1.5rem;
}

.run-away-attempts li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: .35rem .75rem;
  min-width: 0;
  border-top: 1px solid var(--line);
  padding-top: .5rem;
}

.run-away-attempts li:first-child {
  border-top: 0;
  padding-top: 0;
}

.run-away-attempts small {
  grid-column: 2 / -1;
  color: var(--muted);
}

.run-away-summary__empty {
  margin: 0;
  color: var(--muted);
}

.run-away-effects {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  min-width: 0;
}

.run-away-effects span {
  border: 1px solid var(--line);
  padding: .4rem .55rem;
  color: var(--muted);
}

.run-away-effects span[data-state="active"] {
  border-color: var(--acid);
  color: var(--acid);
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

  .combat-monsters,
  .combat-effects,
  .run-away-attempts {
    grid-template-columns: 1fr;
  }

  .run-away-summary__header {
    flex-direction: column;
  }

  .run-away-summary__participants {
    text-align: start;
  }

  .run-away-attempts li {
    grid-template-columns: 1fr;
  }

  .run-away-attempts small {
    grid-column: auto;
  }
}

@media (width <= 420px) {
  .table-center {
    grid-template-columns: 56px minmax(0, 1fr) 56px;
  }
}
</style>
