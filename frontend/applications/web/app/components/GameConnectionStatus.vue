<script setup lang="ts">
import type {GameConnectionState} from
  "../composables/useGameSessionController";

const props = defineProps<{
  state: GameConnectionState;
  errorMessage: string;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const statusCopy = computed(() => {
  switch (props.state) {
    case "connecting":
      return "Подключаемся к игре…";
    case "connected":
      return "Связь с игрой установлена.";
    case "resyncing":
      return "Обновляем состояние игры…";
    case "offline":
      return "Связь потеряна. Пробуем переподключиться.";
    case "failed":
      return "Автоматическое восстановление остановлено.";
    default:
      return "Состояние связи обновляется.";
  }
});

const canRetry = computed(() =>
  props.state === "offline" || props.state === "failed"
);
</script>

<template>
  <aside
    class="game-connection-status"
    :data-state="state"
    :aria-busy="state === 'connecting' || state === 'resyncing'"
  >
    <p class="game-connection-status__state" role="status" aria-live="polite">
      {{ statusCopy }}
    </p>
    <p
      v-if="errorMessage"
      class="game-connection-status__error"
      role="alert"
    >
      {{ errorMessage }}
    </p>
    <button
      v-if="canRetry"
      class="game-connection-status__retry"
      type="button"
      @click="emit('retry')"
    >
      Повторить подключение
    </button>
  </aside>
</template>

<style scoped>
.game-connection-status {
  display: grid;
  gap: 0.5rem;
  align-items: start;
  min-width: 0;
  padding: 0.75rem 1rem;
  border: 1px solid currentColor;
  border-radius: 0.5rem;
}

.game-connection-status__state,
.game-connection-status__error {
  margin: 0;
}

.game-connection-status__error {
  max-width: 60ch;
}

.game-connection-status__retry {
  justify-self: start;
  min-height: 2.75rem;
}
</style>
