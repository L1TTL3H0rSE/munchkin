<script setup lang="ts">
import {
  computed,
  nextTick,
  ref,
  watch,
} from "vue";
import type {
  CardView,
  Projection,
} from "@munchkin/contracts";

import type {GameConnectionState} from "../../composables/useGameSessionController";
import {useInteractionCountdown} from "../../composables/useInteractionCountdown";
import {
  actionIsSelectable,
  interactionActionDescription,
  interactionActionIntent,
  interactionActionKey,
  interactionActionLabel,
  interactionCanDismiss,
  interactionIsTerminal,
  interactionResponseMessage,
  interactionRevisionKey,
  interactionTitle,
  type InteractionActionView,
} from "./interactionModel";

const props = defineProps<{
  projection: Projection;
  connectionState: GameConnectionState;
  busy: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  submit: [action: InteractionActionView];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const selectedActionID = ref<string | null>(null);
const surfaceOpen = ref(false);
const lastRevisionKey = ref("");
const dialogID = "game-interaction-dialog";

const interaction = computed(() => props.projection.interaction);
const ownCards = computed<CardView[]>(() => [
  ...props.projection.you.hand,
  ...props.projection.you.carried,
  ...props.projection.you.equipped,
  ...props.projection.you.traits,
  ...props.projection.you.attachments,
  ...props.projection.you.persistent_curses,
]);
const selectableActions = computed(() =>
  (interaction.value?.actions ?? []).filter(actionIsSelectable),
);
const selectedAction = computed(() => selectableActions.value.find((action) =>
  action.action_id === selectedActionID.value,
));
const dismissible = computed(() => interaction.value
  ? interactionCanDismiss(interaction.value)
  : true);
const terminal = computed(() => interaction.value
  ? interactionIsTerminal(interaction.value)
  : false);
const responseStateMessage = computed(() => interactionResponseMessage(
  interaction.value?.my_response_state,
));
const countdown = useInteractionCountdown(
  () => interaction.value?.deadline_at,
  () => interaction.value?.server_time,
);
const countdownText = computed(() => countdown.expired.value
  ? "Срок по часам истёк; ждём актуальную проекцию сервера."
  : `Осталось примерно ${countdown.remainingSeconds.value} сек.`);
const connectionText = computed(() => {
  switch (props.connectionState) {
    case "offline":
      return "Связь потеряна. Последняя проекция окна сохранена.";
    case "resyncing":
      return "Сверяем окно с сервером…";
    case "failed":
      return "Ожидается ручное обновление проекции.";
    default:
      return "";
  }
});

function focusableElements(): HTMLElement[] {
  return Array.from(dialogRef.value?.querySelectorAll<HTMLElement>(
    "button:not([disabled]), input:not([disabled]), select:not([disabled]), "
      + "textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
  ) ?? []);
}

function focusDialog(): void {
  void nextTick(() => {
    const first = focusableElements()[0];
    first?.focus();
  });
}

function openSurface(): void {
  surfaceOpen.value = true;
  focusDialog();
}

function closeSurface(): void {
  if (!dismissible.value) {
    return;
  }
  surfaceOpen.value = false;
  void nextTick(() => triggerRef.value?.focus());
}

function handleBackdropClick(): void {
  closeSurface();
}

function handleDialogKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    if (dismissible.value) {
      event.preventDefault();
      closeSurface();
    }
    return;
  }
  if (event.key !== "Tab") {
    return;
  }
  const focusable = focusableElements();
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function selectAction(action: InteractionActionView): void {
  if (!actionIsSelectable(action) || terminal.value || props.busy) {
    return;
  }
  selectedActionID.value = action.action_id;
}

function submitSelected(): void {
  const action = selectedAction.value;
  if (!action || terminal.value || props.busy) {
    return;
  }
  if (!interactionActionIntent(action)) {
    return;
  }
  emit("submit", action);
}

watch(
  () => interactionRevisionKey(interaction.value),
  (revisionKey) => {
    if (revisionKey === lastRevisionKey.value) {
      return;
    }
    lastRevisionKey.value = revisionKey;
    if (!revisionKey) {
      selectedActionID.value = null;
      surfaceOpen.value = false;
      return;
    }
    selectedActionID.value = selectableActions.value[0]?.action_id ?? null;
    surfaceOpen.value = true;
    focusDialog();
  },
  {immediate: true},
);

watch(
  () => selectableActions.value.map((action) => actionActionKey(action)).join("|"),
  () => {
    if (!selectableActions.value.some((action) =>
      action.action_id === selectedActionID.value,
    )) {
      selectedActionID.value = selectableActions.value[0]?.action_id ?? null;
    }
  },
);

function actionActionKey(action: InteractionActionView): string {
  return interactionActionKey(action);
}
</script>

<template>
  <section
    v-if="interaction"
    class="interaction-surface"
    data-testid="interaction-surface"
    :data-state="terminal ? 'terminal' : busy ? 'pending' : 'open'"
  >
    <aside class="interaction-inbox" data-testid="interaction-inbox">
      <div>
        <p class="eyebrow">ВХОДЯЩЕЕ ВЗАИМОДЕЙСТВИЕ</p>
        <strong>{{ interactionTitle(interaction) }}</strong>
        <span v-if="interaction.response_required_for_you">Требуется решение</span>
        <span v-else>Окно открыто для текущей проекции</span>
      </div>
      <button
        ref="triggerRef"
        type="button"
        :aria-controls="dialogID"
        :aria-expanded="surfaceOpen"
        @click="openSurface"
      >
        {{ surfaceOpen ? "Окно открыто" : "Открыть окно" }}
      </button>
    </aside>

    <div
      v-if="surfaceOpen"
      class="interaction-backdrop"
      data-testid="interaction-backdrop"
      @click.self="handleBackdropClick"
    >
      <section
        :id="dialogID"
        ref="dialogRef"
        class="interaction-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interaction-dialog-title"
        tabindex="-1"
        @keydown="handleDialogKeydown"
      >
        <header class="interaction-dialog__header">
          <div>
            <p class="eyebrow">СЕРВЕРНОЕ ОКНО</p>
            <h2 id="interaction-dialog-title">{{ interactionTitle(interaction) }}</h2>
            <p class="interaction-dialog__context">
              {{ interaction.response_required_for_you
                ? "Выберите только действие, которое передала текущая проекция."
                : "Окно остаётся видимым, даже если сейчас нет действия для этого игрока." }}
            </p>
          </div>
          <button
            v-if="dismissible"
            class="interaction-dialog__close"
            type="button"
            aria-label="Свернуть окно взаимодействия"
            @click="closeSurface"
          >
            Свернуть
          </button>
        </header>

        <div class="interaction-dialog__status" aria-live="polite">
          <p v-if="responseStateMessage" role="status">{{ responseStateMessage }}</p>
          <p v-else-if="connectionText" role="status">{{ connectionText }}</p>
          <p v-else-if="interaction.response_required_for_you" role="status">
            Решение принадлежит текущему игроку.
          </p>
          <p v-else role="status">Текущее окно доступно только по проекции сервера.</p>
        </div>

        <p class="interaction-countdown" role="timer" aria-live="off">
          {{ countdownText }}
        </p>

        <div v-if="errorMessage" class="interaction-dialog__error" role="alert">
          {{ errorMessage }}
        </div>

        <p v-if="!interaction.actions.length" class="interaction-dialog__opaque" role="status">
          Окно открыто. Сейчас нет действия для этого игрока.
        </p>

        <fieldset v-else class="interaction-actions" :disabled="busy || terminal">
          <legend>Доступные действия текущего окна</legend>
          <label
            v-for="action in interaction.actions"
            :key="interactionActionKey(action)"
            class="interaction-action"
            :class="{
              'interaction-action--selected': action.action_id === selectedActionID,
              'interaction-action--unsupported': !actionIsSelectable(action),
            }"
            :data-state="action.action_id === selectedActionID ? 'selected' : 'available'"
          >
            <input
              type="radio"
              name="interaction-action"
              :value="action.action_id"
              :checked="action.action_id === selectedActionID"
              :disabled="!actionIsSelectable(action) || busy || terminal"
              @change="selectAction(action)"
            >
            <span>
              <strong>{{ interactionActionLabel(action) }}</strong>
              <small>{{ interactionActionDescription(action, ownCards) }}</small>
              <small v-if="!actionIsSelectable(action)">
                Это действие будет доступно в специализированном окне.
              </small>
            </span>
          </label>
        </fieldset>

        <footer class="interaction-dialog__footer">
          <button
            class="interaction-dialog__submit"
            type="button"
            :disabled="busy || terminal || !selectedAction"
            @click="submitSelected"
          >
            {{ busy ? "Отправляем…" : selectedAction
              ? interactionActionLabel(selectedAction)
              : "Действие недоступно" }}
          </button>
          <small>Окончательное решение принимает сервер.</small>
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.interaction-surface {
  position: relative;
  z-index: 40;
  min-width: 0;
}

.interaction-inbox {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
  border: 1px solid var(--acid);
  padding: .75rem 1rem;
  background: #191d0e;
  box-shadow: 0 8px 24px rgb(0 0 0 / 20%);
}

.interaction-inbox > div {
  display: grid;
  gap: .25rem;
  min-width: 0;
}

.interaction-inbox .eyebrow {
  margin: 0;
}

.interaction-inbox strong,
.interaction-inbox span {
  overflow-wrap: anywhere;
}

.interaction-inbox span {
  color: var(--muted);
  font-size: .82rem;
}

.interaction-inbox button,
.interaction-dialog button {
  min-height: 2.75rem;
}

.interaction-backdrop {
  position: fixed;
  z-index: 50;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  overflow-y: auto;
  background: rgb(0 0 0 / 68%);
}

.interaction-dialog {
  width: min(100%, 42rem);
  max-height: min(90dvh, 52rem);
  display: grid;
  gap: 1rem;
  overflow-y: auto;
  border: 1px solid var(--acid);
  padding: 1.25rem;
  background: var(--color-board);
  box-shadow: 0 22px 80px rgb(0 0 0 / 45%);
}

.interaction-dialog__header,
.interaction-dialog__footer {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.interaction-dialog__header h2 {
  margin: .35rem 0 0;
  overflow-wrap: anywhere;
}

.interaction-dialog__context,
.interaction-dialog__status p,
.interaction-dialog__footer small {
  margin: .35rem 0 0;
  color: var(--muted);
  line-height: 1.45;
}

.interaction-dialog__status {
  min-height: 1.5rem;
}

.interaction-countdown {
  margin: 0;
  color: var(--acid);
  font-variant-numeric: tabular-nums;
}

.interaction-dialog__error {
  border: 1px solid #ef8d74;
  padding: .75rem;
  color: #ffd2c6;
  line-height: 1.45;
}

.interaction-dialog__opaque {
  margin: 0;
  border: 1px dashed var(--line);
  padding: 1rem;
  color: var(--muted);
  line-height: 1.45;
}

.interaction-actions {
  display: grid;
  gap: .65rem;
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

.interaction-actions legend {
  margin-bottom: .25rem;
  color: var(--muted);
  font-size: .8rem;
  text-transform: uppercase;
}

.interaction-action {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: .75rem;
  border: 1px solid var(--line);
  padding: .8rem;
  cursor: pointer;
}

.interaction-action--selected {
  border-color: var(--acid);
  background: #20270d;
}

.interaction-action--unsupported {
  cursor: not-allowed;
  opacity: .68;
}

.interaction-action input {
  margin-top: .25rem;
}

.interaction-action span {
  display: grid;
  gap: .25rem;
  min-width: 0;
}

.interaction-action small {
  color: var(--muted);
  line-height: 1.4;
}

.interaction-dialog__footer {
  align-items: center;
  flex-wrap: wrap;
}

.interaction-dialog__submit {
  min-width: min(100%, 16rem);
}

.interaction-dialog__footer small {
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .interaction-backdrop,
  .interaction-dialog,
  .interaction-action {
    scroll-behavior: auto;
    transition: none;
  }
}

@media (width <= 767px) {
  .interaction-backdrop {
    align-items: end;
    padding: 0;
  }

  .interaction-dialog {
    width: 100%;
    max-height: min(88dvh, 48rem);
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    padding: 1rem calc(1rem + env(safe-area-inset-right, 0px))
      calc(1rem + env(safe-area-inset-bottom, 0px))
      calc(1rem + env(safe-area-inset-left, 0px));
  }
}

@media (width <= 420px) {
  .interaction-inbox {
    align-items: start;
    flex-direction: column;
  }

  .interaction-inbox button {
    width: 100%;
  }

  .interaction-dialog__header {
    flex-direction: column;
  }

  .interaction-dialog__close {
    align-self: start;
  }
}

@media (forced-colors: active) {
  .interaction-inbox,
  .interaction-dialog,
  .interaction-action,
  .interaction-dialog__error {
    border-color: CanvasText;
    forced-color-adjust: none;
  }
}
</style>
