<script setup lang="ts">
import type {GameConnectionState} from "../../../composables/useGameSessionController";
import SheetDialog from "../../ui/SheetDialog.vue";

withDefaults(defineProps<{
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
  desktopInline?: boolean;
}>(), {
  countdownText: "",
  deadlineAt: "",
  deadlineLabel: "",
  inboxLabel: "ВЗАИМОДЕЙСТВИЕ",
  inboxStatus: "",
  eyebrow: "РЕШЕНИЕ",
  dialogId: "interaction-dialog",
  desktopInline: false,
});

const emit = defineEmits<{
  "update:open": [value: boolean];
  close: [];
}>();

function close() {
  emit("update:open", false);
  emit("close");
}
</script>

<template>
  <section
    class="interaction-kernel"
    data-figma-owner="interaction-sheet"
    :data-state="busy ? 'pending' : open ? 'open' : 'closed'"
    :data-connection-state="connectionState"
  >
    <button
      v-if="!open"
      class="interaction-inbox"
      type="button"
      :aria-controls="dialogId"
      @click="emit('update:open', true)"
    >
      <span>{{ inboxLabel }}</span>
      <strong>{{ title }}</strong>
      <small v-if="inboxStatus">{{ inboxStatus }}</small>
    </button>

    <SheetDialog
      :open="open"
      :class="{'interaction-flow-dialog--desktop-inline': desktopInline}"
      data-figma-owner="interaction-sheet"
      :title="title"
      :description="context"
      :dismissible="dismissible"
      :close-label="dismissible ? 'Свернуть' : ''"
      v-bind="{titleID: `${dialogId}-title`}"
      @close="close"
    >
      <p class="interaction-sheet__eyebrow">{{ eyebrow }}</p>
      <div :id="`${dialogId}-status`" class="interaction-sheet__status" aria-live="polite">
        <p v-if="statusMessage" role="status">{{ statusMessage }}</p>
        <p v-if="errorMessage" class="interaction-sheet__error" role="alert">{{ errorMessage }}</p>
      </div>
      <p v-if="countdownText" class="interaction-countdown" role="timer" aria-live="off">
        {{ countdownText }}
        <time v-if="deadlineAt" :datetime="deadlineAt">{{ deadlineLabel }}</time>
      </p>
      <div class="interaction-sheet__content"><slot /></div>
      <template v-if="$slots.footer" #footer><slot name="footer" /></template>
    </SheetDialog>
  </section>
</template>

<style scoped>
.interaction-kernel { min-width: 0; }
.interaction-inbox {
  width: 100%;
  min-height: 52px;
  display: grid;
  gap: 2px;
  border: 1px solid var(--color-accent-strong);
  border-radius: var(--radius-control);
  padding: 8px 12px;
  color: var(--color-text);
  background: var(--color-surface);
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.interaction-inbox span,
.interaction-sheet__eyebrow { color: var(--color-accent-strong); font-size: .62rem; font-weight: 800; letter-spacing: .08em; }
.interaction-inbox small,
.interaction-sheet__status,
.interaction-countdown { color: var(--color-text-muted); font-size: .72rem; }
.interaction-sheet__eyebrow,
.interaction-sheet__status p,
.interaction-countdown { margin: 0 0 10px; }
.interaction-sheet__error { color: var(--color-danger); }
.interaction-sheet__content { min-width: 0; display: grid; gap: 12px; }

@media (width >= 1024px) {
  :deep(.sheet-dialog.interaction-flow-dialog--desktop-inline) {
    position: fixed;
    top: 88px;
    left: max(16px, calc(50% - 440px));
    width: min(768px, calc(100% - 392px));
    height: 502px;
    max-height: 502px;
    margin: 0;
    border-radius: 20px;
    box-shadow: 0 7px 9px rgb(59 46 40 / 14%);
    outline: none;
  }
  :deep(.sheet-dialog.interaction-flow-dialog--desktop-inline)::backdrop { background: transparent; }
  :deep(.interaction-flow-dialog--desktop-inline .sheet-dialog__surface) {
    height: 502px;
    max-height: 502px;
    gap: 0;
    box-sizing: border-box;
    overflow: hidden;
    padding: 20px 24px;
  }
  :deep(.interaction-flow-dialog--desktop-inline .sheet-dialog__header),
  :deep(.interaction-flow-dialog--desktop-inline .sheet-dialog__footer),
  :deep(.interaction-flow-dialog--desktop-inline .interaction-sheet__eyebrow),
  :deep(.interaction-flow-dialog--desktop-inline .interaction-sheet__status),
  :deep(.interaction-flow-dialog--desktop-inline .interaction-countdown) { display: none; }
}
</style>
