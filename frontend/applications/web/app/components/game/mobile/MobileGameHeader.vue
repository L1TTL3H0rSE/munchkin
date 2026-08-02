<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";

import {useGamePresentation} from "../../../composables/useGamePresentation";
import PhaseLabel from "../../ui/PhaseLabel.vue";
import SheetDialog from "../../ui/SheetDialog.vue";
import StrengthIndicator from "../../ui/StrengthIndicator.vue";

const props = defineProps<{
  projection: Projection;
}>();

const presentation = useGamePresentation(() => props.projection);
const detailsOpen = ref(false);

const turnCopy = computed(() => {
  const current = presentation.value;
  if (!current) {
    return "Состояние загружается";
  }
  return current.isActorTurn
    ? "Твой ход"
    : `Ход: ${current.currentPlayerName}`;
});

const statusCopy = computed(() => {
  switch (props.projection.status) {
    case "lobby":
      return "Лобби";
    case "active":
      return "Игра идёт";
    case "finished":
      return "Игра завершена";
    default: {
      const exhaustive: never = props.projection.status;
      return exhaustive;
    }
  }
});

function closeDetails() {
  detailsOpen.value = false;
}
</script>

<template>
  <header class="mobile-game-header">
    <div class="mobile-game-header__context">
      <p class="mobile-game-header__kicker">MUNCHKIN · ИГРОВОЙ СТОЛ</p>
      <div class="mobile-game-header__title-row">
        <h1>{{ turnCopy }}</h1>
        <PhaseLabel :phase="projection.turn.phase" />
      </div>
      <p class="mobile-game-header__status" role="status">
        {{ statusCopy }} · версия {{ projection.version }} подтверждена сервером
      </p>
    </div>

    <div class="mobile-game-header__stats">
      <StrengthIndicator
        :value="projection.you.combat_strength"
        label="Сила"
        compact
      />
      <button
        class="mobile-game-header__details"
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="detailsOpen"
        @click="detailsOpen = true"
      >
        Детали
      </button>
    </div>
  </header>

  <SheetDialog
    :open="detailsOpen"
    title="Детали комнаты"
    title-id="mobile-game-details-title"
    description="Технический контекст доступен по запросу и не занимает игровую область."
    @close="closeDetails"
  >
    <dl class="mobile-game-details">
      <div>
        <dt>Комната</dt>
        <dd><code>{{ projection.game_id }}</code></dd>
      </div>
      <div>
        <dt>Профиль правил</dt>
        <dd>{{ projection.rules_profile_id }} · v{{ projection.rules_profile_version }}</dd>
      </div>
      <div>
        <dt>Контент</dt>
        <dd>{{ projection.content_set_id }} · v{{ projection.content_version }}</dd>
      </div>
      <div>
        <dt>Колоды</dt>
        <dd>
          Двери {{ projection.door_deck_count }} · сокровища {{ projection.treasure_deck_count }}
        </dd>
      </div>
    </dl>
  </SheetDialog>
</template>

<style scoped lang="scss">
.mobile-game-header {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-inline: var(--space-1);
}

.mobile-game-header__context,
.mobile-game-header__stats,
.mobile-game-header__title-row {
  min-width: 0;
}

.mobile-game-header__context {
  display: grid;
  gap: var(--space-1);
}

.mobile-game-header__kicker,
.mobile-game-header__status {
  margin: 0;
  color: var(--color-text-muted);
  font-family: var(--font-meta);
  font-size: .58rem;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.mobile-game-header__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
}

.mobile-game-header h1 {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: clamp(1rem, 4vw, 1.35rem);
}

.mobile-game-header__status {
  max-width: 38ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: none;
}

.mobile-game-header__stats {
  display: grid;
  justify-items: end;
  gap: var(--space-2);
  flex: 0 0 auto;
}

.mobile-game-header__details {
  min-height: 2.5rem;
  border: 1px solid var(--color-line);
  padding: .35rem .6rem;
  color: var(--color-text);
  background: transparent;
  font-size: .72rem;
}

.mobile-game-details {
  display: grid;
  gap: var(--space-3);
  margin: 0;
}

.mobile-game-details > div {
  min-width: 0;
  border-bottom: 1px solid var(--color-line);
  padding-bottom: var(--space-2);
}

.mobile-game-details dt {
  color: var(--color-text-muted);
  font-size: .72rem;
  font-weight: 800;
  text-transform: uppercase;
}

.mobile-game-details dd {
  margin: var(--space-1) 0 0;
  overflow-wrap: anywhere;
  line-height: 1.35;
}

@media (width <= 374px) {
  .mobile-game-header {
    align-items: start;
  }

  .mobile-game-header__status {
    max-width: 24ch;
  }

  .mobile-game-header__details {
    min-height: 2.25rem;
    padding-inline: .45rem;
  }
}
</style>
