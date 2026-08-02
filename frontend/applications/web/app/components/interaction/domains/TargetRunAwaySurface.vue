<script setup lang="ts">
import {computed} from "vue";
import type {
  InteractionView,
  Projection,
} from "@munchkin/contracts";

import {
  isRunAwayInteraction,
  isTargetInteraction,
  runAwayAttemptMonsterName,
  runAwayAttemptPlayerName,
  runAwayAttemptResult,
  runAwayAttemptRoll,
  runAwayCurrentPlayerName,
  runAwayEffectLabel,
  runAwayMonsterName,
  runAwayState,
  targetPlayerName,
} from "../targetRunAwayModel";

const props = defineProps<{
  projection: Projection;
  interaction?: InteractionView;
}>();

const target = computed(() => isTargetInteraction(props.interaction)
  ? props.interaction
  : undefined);
const runAway = computed(() => {
  const state = runAwayState(props.projection);
  return isRunAwayInteraction(props.interaction) || state?.attempts.length || state?.completed
    ? state
    : undefined;
});
const effects = computed(() => runAway.value?.effects ?? []);
</script>

<template>
  <section
    v-if="target || runAway"
    class="target-run-away-surface interaction-domain-summary run-away-summary"
    aria-label="Цель и состояние побега"
  >
    <template v-if="target">
      <p class="target-run-away-surface__eyebrow">ЦЕЛЕВОЙ ЭФФЕКТ</p>
      <p v-if="target.target_player_id">
        Цель:
        <strong>{{ targetPlayerName(projection, target.target_player_id) }}</strong>
      </p>
      <p v-if="target.public_kind === 'private_choice'">
        Варианты выбора доступны только текущему игроку.
      </p>
      <p v-else>
        Окно ответа остаётся закрытым; варианты других игроков не раскрываются.
      </p>
    </template>

    <template v-if="runAway">
      <p class="target-run-away-surface__eyebrow">ТЕКУЩИЙ ШАГ ПОБЕГА</p>
      <p>
        Участник:
        <strong>{{ runAwayCurrentPlayerName(projection) }}</strong>
      </p>
      <p>
        Монстр:
        <strong>{{ runAwayMonsterName(projection, runAway.current_monster_instance_id) }}</strong>
      </p>
      <ul v-if="effects.length" class="target-run-away-surface__effects">
        <li v-for="effect in effects" :key="effect.effect_id">
          {{ runAwayEffectLabel(effect) }}
        </li>
      </ul>
      <p v-else>Модификаторы текущего шага отсутствуют в projection.</p>
      <ol v-if="runAway.attempts.length" class="run-away-attempts">
        <li
          v-for="(attempt, attemptIndex) in runAway.attempts"
          :key="`${attempt.player_id}:${attempt.monster_instance_id}:${attemptIndex}`"
        >
          <span>{{ runAwayAttemptPlayerName(projection, attempt) }}</span>
          <span>{{ runAwayAttemptMonsterName(projection, attempt) }}</span>
          <span>{{ runAwayAttemptRoll(attempt) }}</span>
          <strong>{{ runAwayAttemptResult(attempt) }}</strong>
        </li>
      </ol>
    </template>
  </section>
</template>

<style scoped>
.target-run-away-surface {
  display: grid;
  gap: .35rem;
  min-width: 0;
  border: 1px solid var(--color-line, #566044);
  padding: .8rem;
  overflow-wrap: anywhere;
  line-height: 1.45;
}

.target-run-away-surface p {
  margin: 0;
}

.target-run-away-surface__eyebrow {
  color: var(--color-accent-strong);
  font-size: .75rem;
  letter-spacing: .08em;
}

.target-run-away-surface__effects {
  display: grid;
  gap: .25rem;
  margin: 0;
  padding-left: 1.25rem;
  color: var(--color-text);
}

.run-away-attempts {
  display: grid;
  gap: .5rem;
  margin: .2rem 0 0;
  padding-left: 1.25rem;
}

.run-away-attempts li {
  display: grid;
  gap: .15rem;
  min-width: 0;
}

.run-away-attempts li > * {
  overflow-wrap: anywhere;
}

.run-away-attempts strong {
  color: var(--color-accent-strong, #c4f23a);
}
</style>
