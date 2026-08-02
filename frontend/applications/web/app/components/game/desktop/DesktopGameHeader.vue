<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import PhaseLabel from "../../ui/PhaseLabel.vue";
import {desktopStateFamily} from "./desktopGameModel";

const props = defineProps<{
  projection: Projection;
}>();

const stateFamily = computed(() => desktopStateFamily(props.projection));
const currentPlayerName = computed(() => {
  if (props.projection.turn.player_id === props.projection.you.player_id) {
    return props.projection.you.name;
  }
  return props.projection.players.find((player) =>
    player.player_id === props.projection.turn.player_id,
  )?.name ?? "другой игрок";
});
</script>

<template>
  <header class="desktop-game-header">
    <div class="desktop-game-header__identity">
      <p class="eyebrow">ИГРОВОЙ СТОЛ</p>
      <h1>Комната {{ projection.game_id }}</h1>
      <p class="desktop-game-header__context">
        {{ projection.status === "finished" ? "Финал подтверждён сервером" : "Твой ход и открытые зоны" }}
      </p>
    </div>

    <div class="desktop-game-header__phase" aria-label="Текущая фаза и участник хода">
      <PhaseLabel :phase="projection.turn.phase" />
      <strong>{{ currentPlayerName }}</strong>
      <span>{{ stateFamily === "waiting" ? "Ожидаем подтверждённое состояние" : "Текущая проекция" }}</span>
    </div>

    <div class="desktop-game-header__summary" aria-label="Сводка персонажа">
      <span>Уровень {{ projection.you.level }}</span>
      <strong>Сила {{ projection.you.combat_strength }}</strong>
      <span>Рука {{ projection.you.hand.length }}</span>
    </div>
  </header>
</template>

<style scoped lang="scss">
.desktop-game-header {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(12rem, .8fr) auto;
  align-items: end;
  gap: var(--space-6);
  min-width: 0;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-line);
}

.desktop-game-header__identity,
.desktop-game-header__phase {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.desktop-game-header .eyebrow,
.desktop-game-header h1,
.desktop-game-header p {
  margin: 0;
}

.desktop-game-header h1 {
  overflow-wrap: anywhere;
  font-size: clamp(1.55rem, 2.4vw, 2.25rem);
}

.desktop-game-header__context,
.desktop-game-header__phase span,
.desktop-game-header__summary span {
  color: var(--color-text-muted);
  font-size: .76rem;
}

.desktop-game-header__phase {
  justify-items: start;
  align-content: end;
  border-left: 2px solid var(--color-accent-strong);
  padding-left: var(--space-3);
}

.desktop-game-header__phase strong {
  overflow-wrap: anywhere;
  font-size: 1.05rem;
}

.desktop-game-header__summary {
  display: grid;
  grid-template-columns: repeat(3, auto);
  align-items: end;
  gap: var(--space-2);
  color: var(--color-text-muted);
  font-size: .72rem;
  white-space: nowrap;
}

.desktop-game-header__summary strong {
  color: var(--color-accent-strong);
  font-size: 1rem;
}

@media (width <= 1023px) {
  .desktop-game-header {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-3);
  }

  .desktop-game-header__phase {
    grid-column: 1 / -1;
    grid-row: 2;
    border-left: 0;
    border-top: 1px solid var(--color-line);
    padding-top: var(--space-2);
    padding-left: 0;
  }
}

@media (width <= 599px) {
  .desktop-game-header__summary {
    grid-template-columns: 1fr;
    justify-items: end;
    gap: 0;
  }
}
</style>
