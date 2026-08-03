<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";

import {useGamePresentation} from "../../../composables/useGamePresentation";
import SheetDialog from "../../ui/SheetDialog.vue";

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
    ? "ТВОЙ ХОД"
    : `ХОДИТ ${current.currentPlayerName}`;
});

const statusCopy = computed(() => {
  switch (props.projection.status) {
    case "lobby":
      return "ЛОББИ";
    case "active":
      return "ИГРА ИДЁТ";
    case "finished":
      return "ИГРА ЗАВЕРШЕНА";
    default: {
      const exhaustive: never = props.projection.status;
      return exhaustive;
    }
  }
});

const phaseCopy = computed(() => {
  switch (props.projection.turn.phase) {
    case "setup":
    case "preparation":
      return "Сборы";
    case "door_choice":
      return "Дверь";
    case "combat":
      return "Бой";
    case "run_away":
      return "Побег";
    case "resolve_effect":
      return "Эффект";
    case "charity":
      return "Награда";
    case "end_turn":
      return "Итог";
    case "":
      return "Ждём";
    default: {
      const exhaustive: never = props.projection.turn.phase;
      return exhaustive;
    }
  }
});

const pagerCopy = computed(() => {
  const count = props.projection.turn.combat?.monsters.length ??
    (props.projection.turn.encounter ? 1 : 1);
  return `1 / ${Math.max(1, count)}`;
});

const scoreCopy = computed(() => {
  const combat = props.projection.turn.combat;
  return combat
    ? `${combat.player_strength} : ${combat.monster_strength}`
    : String(props.projection.you.combat_strength);
});

function closeDetails() {
  detailsOpen.value = false;
}
</script>

<template>
  <header
    class="mobile-game-header"
    data-node-id="152:19"
    :aria-label="`${statusCopy}. ${turnCopy}`"
  >
    <div class="mobile-game-header__context">
      <span
        class="mobile-game-header__phase"
        :data-phase="projection.turn.phase"
      >
        {{ phaseCopy }}
      </span>
      <span class="mobile-game-header__pager" aria-label="Позиция встречи">
        {{ pagerCopy }}
      </span>
    </div>

    <button
      class="mobile-game-header__strength"
      type="button"
      aria-label="Открыть разбор подтверждённой силы"
      :aria-expanded="detailsOpen"
      @click="detailsOpen = true"
    >
      {{ scoreCopy }}
    </button>

    <div class="mobile-game-header__turn" role="status">
      {{ turnCopy }}
    </div>

    <button
      class="mobile-game-header__details"
      type="button"
      aria-label="Открыть технические детали комнаты"
      aria-haspopup="dialog"
      :aria-expanded="detailsOpen"
      @click="detailsOpen = true"
    >
      ···
    </button>
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
  height: 32px;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.mobile-game-header__context {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.mobile-game-header__phase {
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  width: 45px;
  height: 25px;
  justify-content: center;
  border-radius: 8px;
  padding: 6px 10px;
  color: #fff;
  background: var(--color-action-response);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .08em;
  line-height: 12px;
  text-transform: uppercase;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-game-header__pager,
.mobile-game-header__strength {
  height: 25px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--color-text-muted);
  background: var(--color-surface-control);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .08em;
  white-space: nowrap;
}

.mobile-game-header__pager {
  min-width: 42px;
  padding-inline: 8px;
}

.mobile-game-header__strength {
  min-width: 77px;
  border: 1px solid var(--color-line);
  padding-inline: 8px;
  color: var(--color-text-primary);
  font-size: 14px;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.mobile-game-header__turn {
  min-width: 0;
  overflow: hidden;
  color: var(--color-accent-strong);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .08em;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-game-header__details {
  width: 25px;
  height: 25px;
  border: 0;
  border-radius: 999px;
  padding: 0;
  color: var(--color-text-muted);
  background: transparent;
  font-size: 12px;
  letter-spacing: .05em;
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
</style>
