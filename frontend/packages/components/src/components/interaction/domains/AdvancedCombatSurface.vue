<script setup lang="ts">
import {computed} from "vue";
import type {Projection} from "@munchkin/contracts";

import {
  combatEffectLabel,
  combatEffectTarget,
  combatEffects,
  combatMonsters,
} from "../advancedCombatModel";

const props = defineProps<{
  projection: Projection;
}>();

const combat = computed(() => props.projection.turn.combat);
const monsters = computed(() => combatMonsters(props.projection));
const effects = computed(() => combatEffects(props.projection));
</script>

<template>
  <section
    v-if="combat"
    class="advanced-combat-surface"
    aria-label="Подтверждённые итоги боя"
  >
    <p class="advanced-combat-surface__eyebrow">СИЛА БОЯ</p>
    <dl class="advanced-combat-surface__totals">
      <div>
        <dt>Игрок</dt>
        <dd>{{ combat.player_strength }}</dd>
      </div>
      <div>
        <dt>Монстры</dt>
        <dd>{{ combat.monster_strength }}</dd>
      </div>
    </dl>
    <p class="advanced-combat-surface__note">
      Итог и доступные модификаторы принадлежат серверу; эта сводка только отображает projection.
    </p>
    <ul v-if="monsters.length" class="advanced-combat-surface__list">
      <li v-for="monster in monsters" :key="monster.instance_id">
        {{ monster.name }} · сила {{ monster.combat_strength ?? 0 }}
      </li>
    </ul>
    <ul v-if="effects.length" class="advanced-combat-surface__list combat-effects">
      <li
        v-for="effect in effects"
        :key="effect.effect_id"
        class="combat-effect"
      >
        {{ combatEffectLabel(projection, effect.effect_id) }} ·
        {{ combatEffectTarget(projection, effect) }}
      </li>
    </ul>
    <p v-else class="advanced-combat-surface__note">Прочие эффекты отсутствуют в текущей projection.</p>
  </section>
</template>

<style scoped>
.advanced-combat-surface {
  display: grid;
  gap: .6rem;
  min-width: 0;
  border: 1px solid var(--color-line, #566044);
  padding: .8rem;
}

.advanced-combat-surface__eyebrow {
  margin: 0;
  color: var(--color-accent-strong);
  font-size: .75rem;
  letter-spacing: .08em;
}

.advanced-combat-surface__totals {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .6rem;
  margin: 0;
}

.advanced-combat-surface__totals > div {
  border: 1px solid var(--color-line, #566044);
  padding: .6rem;
}

.advanced-combat-surface__totals dt {
  color: var(--color-text-muted, #9eaa8e);
  font-size: .75rem;
  text-transform: uppercase;
}

.advanced-combat-surface__totals dd {
  margin: .2rem 0 0;
  color: var(--color-accent-strong);
  font-size: 1.35rem;
  font-variant-numeric: tabular-nums;
}

.advanced-combat-surface__note,
.advanced-combat-surface__list {
  margin: 0;
  color: var(--color-text-muted, #9eaa8e);
  line-height: 1.45;
}

.advanced-combat-surface__list {
  display: grid;
  gap: .25rem;
  padding-left: 1.25rem;
}
</style>
