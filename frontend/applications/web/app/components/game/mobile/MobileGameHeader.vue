<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";

import type {GamePresentationModel} from "../gamePresentationModel";

const props = defineProps<{
  projection: Projection;
  presentationModel: GamePresentationModel;
  strengthOpen: boolean;
}>();

const emit = defineEmits<{"open-strength": []}>();

const turnCopy = computed(() => props.presentationModel.turnHeadline);

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

const phaseCopy = computed(() => props.presentationModel.phaseLabel);

const pagerCopy = computed(() => {
  return `${props.presentationModel.encounterPage} / ${props.presentationModel.encounterPageCount}`;
});

const scoreCopy = computed(() => {
  const primary = props.presentationModel.primary;
  if (primary.kind === "run-away" || (primary.kind === "result" && primary.source === "run-away")) {
    const bonus = props.projection.you.escape_bonus;
    return `ПБ ${bonus >= 0 ? "+" : "−"}${Math.abs(bonus)}`;
  }
  if (primary.kind === "result" && primary.source === "reward") {
    return String(props.projection.you.strength_breakdown.total_strength);
  }
  const combat = props.projection.turn.combat;
  return combat
    ? `${combat.player_strength} : ${combat.monster_strength}`
    : String(props.projection.you.strength_breakdown.total_strength);
});
const strengthDisabled = computed(() => ["door-choice", "run-away", "result", "required-decision"].includes(
  props.presentationModel.primary.kind,
));

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
      aria-label="Открыть подтверждённую силу"
      :aria-expanded="strengthOpen"
      :disabled="strengthDisabled"
      @click="emit('open-strength')"
    >
      {{ scoreCopy }}
    </button>

    <div class="mobile-game-header__turn" role="status">
      {{ turnCopy }}
    </div>
  </header>

</template>

<style scoped lang="scss">
.mobile-game-header {
  min-width: 0;
  height: 32px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
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
  box-sizing: border-box;
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
  box-sizing: border-box;
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
  justify-self: center;
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
  justify-self: end;
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
