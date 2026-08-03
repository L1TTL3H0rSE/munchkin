<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import type {GameConnectionState} from "../../../composables/useGameSessionController";
import {useInteractionCountdown} from "../../../composables/useInteractionCountdown";
import type {GamePresentationModel} from "../gamePresentationModel";

const props = defineProps<{
  projection: Projection;
  presentationModel: GamePresentationModel;
  connectionState: GameConnectionState;
  finished?: boolean;
  victory?: boolean;
}>();

const isActorTurn = computed(() =>
  props.projection.turn.player_id === props.projection.you.player_id,
);
const currentPlayerName = computed(() => {
  if (props.projection.turn.player_id === props.projection.you.player_id) {
    return props.projection.you.name;
  }
  return props.projection.players.find((player) =>
    player.player_id === props.projection.turn.player_id,
  )?.name ?? "другой игрок";
});
const interactionCountdown = useInteractionCountdown(
  () => props.projection.interaction?.deadline_at,
  () => props.projection.interaction?.server_time,
);
const responseCopy = computed(() => {
  if (!props.projection.interaction?.response_required_for_you) {
    return "";
  }
  const remainingSeconds = interactionCountdown.remainingSeconds.value;
  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");
  return `ОТВЕТ · ${minutes}:${seconds}`;
});
const phaseBadge = computed(() => {
  const primary = props.presentationModel.primary;
  if (props.finished) {
    return props.victory ? "ПОБЕДА" : "ИТОГ";
  }
  if (primary.kind === "result") {
    return primary.source === "reward" ? "ИТОГ" : "ПОБЕГ";
  }
  if (primary.kind === "run-away") {
    return "ПОБЕГ";
  }
  switch (props.presentationModel.family) {
    case "setup":
    case "preparation": return "ПОДГОТ.";
    case "door-choice": return "ДВЕРЬ";
    case "combat":
    case "waiting": return "БОЙ";
    case "charity": return "МИЛОСТЫНЯ";
    case "end-turn": return "ИТОГ";
    default: return "ХОД";
  }
});
const headerTitle = computed(() => {
  const primary = props.presentationModel.primary;
  if (props.finished) {
    return props.victory ? "ИГРА ОКОНЧЕНА" : "ПАРТИЯ ОКОНЧЕНА";
  }
  if (props.connectionState === "offline") {
    return "ПЕРЕПОДКЛЮЧЕНИЕ";
  }
  if (props.connectionState === "failed") {
    return "СВЯЗЬ ПОТЕРЯНА";
  }
  if (props.connectionState === "connecting" || props.connectionState === "resyncing") {
    return "ПОДКЛЮЧЕНИЕ";
  }
  if (responseCopy.value) {
    return responseCopy.value;
  }
  if (primary.kind === "result") {
    return primary.source === "reward"
      ? "РЕЗУЛЬТАТ"
      : primary.escaped ? "УСПЕХ" : "НЕУДАЧА";
  }
  if (primary.kind === "run-away") {
    return "ТВОЁ РЕШЕНИЕ";
  }
  return isActorTurn.value ? "ТВОЙ ХОД" : `ХОД: ${currentPlayerName.value}`;
});
const connectionLabel = computed(() =>
  props.connectionState === "connected" ? "В СЕТИ" : "НЕТ СВЯЗИ",
);
</script>

<template>
  <header class="desktop-game-header" aria-label="Сводка игрового стола">
    <div class="desktop-game-header__phase" aria-label="Текущая фаза">
      <span class="desktop-game-header__finished-phase">{{ phaseBadge }}</span>
    </div>

    <div class="desktop-game-header__turn">
      <h1>{{ headerTitle }}</h1>
    </div>

    <div class="desktop-game-header__online" aria-label="Состояние соединения">
      <span
        class="desktop-game-header__online-dot"
        :class="{'desktop-game-header__online-dot--offline': connectionState !== 'connected'}"
        aria-hidden="true"
      />
      <span>{{ connectionLabel }}</span>
    </div>

  </header>
</template>

<style scoped lang="scss">
.desktop-game-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  min-height: 56px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  padding: 0 16px;
  background: var(--color-surface);
  box-shadow: 0 2px 0 rgb(46 43 41 / 3%);
}

.desktop-game-header__phase {
  min-width: 0;
  display: flex;
  align-items: center;
}

.desktop-game-header__finished-phase {
  display: inline-flex;
  align-items: center;
  min-height: 25px;
  border-radius: 8px;
  padding: 0 10px;
  color: #fff9ef;
  background: var(--color-action-response);
  font-size: .56rem;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.desktop-game-header h1,
.desktop-game-header p,
.desktop-game-header span {
  margin: 0;
}

  .desktop-game-header__phase :deep(.phase-label) {
    min-width: 45px;
    width: max-content;
    min-height: 25px;
    height: 25px;
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--color-action-response);
    border-radius: 8px;
    padding: 0 10px;
    color: #fff9ef;
    background: var(--color-action-response);
    font-size: .56rem;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.desktop-game-header__turn {
  min-width: 0;
  display: grid;
  justify-items: center;
  gap: 2px;
  text-align: center;
}

.desktop-game-header__turn h1 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-action-primary);
  font-size: .92rem;
  letter-spacing: .08em;
}

.desktop-game-header__turn span,
.desktop-game-header__online {
  color: var(--color-text-secondary);
  color: var(--color-text-muted);
  font-size: .62rem;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.desktop-game-header__turn span {
  display: none;
}

.desktop-game-header__online {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-self: end;
  margin-left: 0;
  white-space: nowrap;
}

.desktop-game-header__online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent), transparent 82%);
}

.desktop-game-header__online-dot--offline {
  background: var(--color-danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-danger), transparent 82%);
}

@media (width <= 1023px) {
  .desktop-game-header {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: var(--space-3);
  }

  .desktop-game-header__online {
    margin-left: 0;
  }

  .desktop-game-header__finished-phase {
    display: inline-flex;
    align-items: center;
    min-height: 25px;
    border: 1px solid var(--color-action-response);
    border-radius: 8px;
    padding: 0 10px;
    color: #fff9ef;
    background: var(--color-action-response);
    font-size: .56rem;
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .desktop-game-header__phase :deep(.phase-label__dot) {
    background: #fff9ef;
  }

}

@media (width <= 599px) {
  .desktop-game-header__online {
    display: none;
  }
}
</style>
