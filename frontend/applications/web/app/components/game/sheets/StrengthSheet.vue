<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";

import SheetDialog from "./SheetDialog.vue";

defineProps<{
  projection: Projection;
}>();
</script>

<template>
  <SheetDialog
    v-if="projection.turn.combat"
    title="Сила боя"
    trigger-label="Открыть силу боя"
    dialog-id="game-strength-sheet"
  >
    <dl class="strength-sheet__totals">
      <div>
        <dt>Ваша сила</dt>
        <dd>{{ projection.turn.combat.player_strength }}</dd>
      </div>
      <div>
        <dt>Сила монстров</dt>
        <dd>{{ projection.turn.combat.monster_strength }}</dd>
      </div>
    </dl>
    <p class="strength-sheet__note">
      Значения подтверждены сервером. Разбор ниже не принимает решение за игру.
    </p>
    <dl class="strength-sheet__breakdown">
      <div>
        <dt>Помощник</dt>
        <dd>
          {{ projection.turn.combat.helper_player_id
            ? "Подтверждён текущей projection"
            : "Нет подтверждённого помощника" }}
        </dd>
      </div>
      <div>
        <dt>Видимые модификаторы</dt>
        <dd>{{ projection.turn.combat.effects.length || "Нет" }}</dd>
      </div>
      <div>
        <dt>Прочие эффекты</dt>
        <dd>{{ projection.turn.combat.effects.length ? "См. список боя" : "Нет" }}</dd>
      </div>
    </dl>
  </SheetDialog>
</template>

<style scoped>
.strength-sheet__totals,
.strength-sheet__breakdown {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: .6rem;
  margin: 0;
}

.strength-sheet__totals > div,
.strength-sheet__breakdown > div {
  border: 1px solid var(--color-line, #566044);
  padding: .6rem;
}

.strength-sheet__totals dt,
.strength-sheet__breakdown dt {
  color: var(--color-text-muted, #9eaa8e);
  font-size: .75rem;
  text-transform: uppercase;
}

.strength-sheet__totals dd {
  margin: .2rem 0 0;
  color: var(--color-accent-strong);
  font-size: 1.4rem;
}

.strength-sheet__breakdown dd {
  margin: .2rem 0 0;
  overflow-wrap: anywhere;
}

.strength-sheet__note {
  margin: 0;
  color: var(--color-text-muted, #9eaa8e);
  line-height: 1.45;
}
</style>
