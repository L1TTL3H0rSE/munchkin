<script setup lang="ts">
import {nextTick, onMounted, ref, watch} from "vue";

import type {GameConnectionState} from "../../../composables/useGameSessionController";

const props = withDefaults(defineProps<{
  open: boolean;
  title: string;
  context: string;
  dismissible: boolean;
  busy: boolean;
  connectionState: GameConnectionState;
  statusMessage: string;
  errorMessage: string;
  countdownText?: string;
  deadlineAt?: string;
  deadlineLabel?: string;
  inboxLabel?: string;
  inboxStatus?: string;
  eyebrow?: string;
  dialogId?: string;
}>(), {
  countdownText: "",
  deadlineAt: "",
  deadlineLabel: "",
  inboxLabel: "ВХОДЯЩЕЕ ВЗАИМОДЕЙСТВИЕ",
  inboxStatus: "",
  eyebrow: "СЕРВЕРНОЕ ОКНО",
  dialogId: "interaction-dialog",
});

const emit = defineEmits<{
  "update:open": [value: boolean];
  close: [];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);

function focusableElements(): HTMLElement[] {
  return Array.from(dialogRef.value?.querySelectorAll<HTMLElement>(
    "button:not([disabled]), input:not([disabled]), select:not([disabled]), "
      + "textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
  ) ?? []);
}

function focusDialog(): void {
  void nextTick(() => {
    const first = focusableElements()[0];
    (first ?? dialogRef.value)?.focus();
  });
}

function returnFocus(): void {
  void nextTick(() => triggerRef.value?.focus());
}

function requestClose(): void {
  if (!props.dismissible) {
    return;
  }
  emit("update:open", false);
  emit("close");
  returnFocus();
}

function handleDialogKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    if (props.dismissible) {
      event.preventDefault();
      requestClose();
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

watch(
  () => props.open,
  (open) => {
    if (open) {
      focusDialog();
    } else {
      returnFocus();
    }
  },
  {flush: "post"},
);

onMounted(() => {
  if (props.open) {
    focusDialog();
  }
});
</script>

<template>
  <section
    class="interaction-kernel"
    :data-state="busy ? 'pending' : open ? 'open' : 'closed'"
    :data-connection-state="connectionState"
  >
    <aside class="interaction-inbox" data-testid="interaction-inbox">
      <div>
        <p class="interaction-inbox__eyebrow">{{ inboxLabel }}</p>
        <strong>{{ title }}</strong>
        <span v-if="inboxStatus">{{ inboxStatus }}</span>
      </div>
      <button
        ref="triggerRef"
        type="button"
        :aria-controls="dialogId"
        :aria-expanded="open"
        @click="emit('update:open', true)"
      >
        {{ open ? "Окно открыто" : "Открыть окно" }}
      </button>
    </aside>

    <div
      v-if="open"
      class="interaction-backdrop"
      data-testid="interaction-backdrop"
      @click.self="requestClose"
    >
      <section
        :id="dialogId"
        ref="dialogRef"
        class="interaction-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${dialogId}-title`"
        :aria-describedby="`${dialogId}-status`"
        tabindex="-1"
        @keydown="handleDialogKeydown"
      >
        <header class="interaction-dialog__header">
          <div>
            <p class="interaction-dialog__eyebrow">{{ eyebrow }}</p>
            <h2 :id="`${dialogId}-title`">{{ title }}</h2>
            <p class="interaction-dialog__context">{{ context }}</p>
          </div>
          <button
            v-if="dismissible"
            class="interaction-dialog__close"
            type="button"
            aria-label="Свернуть окно взаимодействия"
            @click="requestClose"
          >
            Свернуть
          </button>
        </header>

        <div :id="`${dialogId}-status`" class="interaction-dialog__status" aria-live="polite">
          <p v-if="statusMessage" role="status">{{ statusMessage }}</p>
          <p v-if="errorMessage" class="interaction-dialog__error" role="alert">
            {{ errorMessage }}
          </p>
        </div>

        <p v-if="countdownText" class="interaction-countdown" role="timer" aria-live="off">
          {{ countdownText }}
          <time v-if="deadlineAt" :datetime="deadlineAt">
            {{ deadlineLabel }}
          </time>
        </p>

        <div class="interaction-dialog__content">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="interaction-dialog__footer">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.interaction-kernel {
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
  border: 1px solid var(--color-accent-strong);
  padding: .75rem 1rem;
  color: var(--color-text);
  background: var(--color-surface);
  box-shadow: 0 8px 24px rgb(0 0 0 / 20%);
}

.interaction-inbox > div {
  display: grid;
  gap: .25rem;
  min-width: 0;
}

.interaction-inbox__eyebrow,
.interaction-dialog__eyebrow {
  margin: 0;
  color: var(--color-accent-strong);
  font-size: .75rem;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.interaction-inbox strong,
.interaction-inbox span {
  overflow-wrap: anywhere;
}

.interaction-inbox span {
  color: var(--color-text-muted, #9eaa8e);
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
  width: min(100%, 46rem);
  max-height: min(90dvh, 56rem);
  display: grid;
  gap: 1rem;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  border: 1px solid var(--color-accent-strong);
  padding: 1.25rem;
  color: var(--color-text);
  background: var(--color-surface);
  box-shadow: 0 22px 80px rgb(0 0 0 / 45%);
}

.interaction-dialog__header,
.interaction-dialog__footer {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
}

.interaction-dialog__header > div,
.interaction-dialog__footer > * {
  min-width: 0;
  max-width: 100%;
}

.interaction-dialog__header h2 {
  margin: .35rem 0 0;
  overflow-wrap: anywhere;
}

.interaction-dialog__context,
.interaction-dialog__status p,
.interaction-dialog__footer small {
  margin: .35rem 0 0;
  color: var(--color-text-muted, #9eaa8e);
  line-height: 1.45;
}

.interaction-dialog__status {
  min-height: 1.5rem;
}

.interaction-dialog__error {
  border: 1px solid #ef8d74;
  padding: .75rem;
  color: var(--color-danger) !important;
}

.interaction-countdown {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin: 0;
  color: var(--color-accent-strong);
  font-variant-numeric: tabular-nums;
}

.interaction-countdown time {
  color: var(--color-text-muted, #9eaa8e);
}

.interaction-dialog__content {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.interaction-dialog__footer {
  align-items: center;
  flex-wrap: wrap;
}

@media (prefers-reduced-motion: reduce) {
  .interaction-backdrop,
  .interaction-dialog {
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
    max-height: min(88dvh, 50rem);
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
  .interaction-dialog__error {
    border-color: CanvasText;
    forced-color-adjust: none;
  }
}
</style>
