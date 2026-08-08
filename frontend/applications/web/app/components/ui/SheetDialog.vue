<script lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch} from "vue";

let activeSheetDialog: HTMLDialogElement | null = null;
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean;
  title: string;
  description?: string;
  compactTitle?: string;
  compactDescription?: string;
  titleID?: string;
  dismissible?: boolean;
  closeLabel?: string;
}>(), {
  description: "",
  compactTitle: "",
  compactDescription: "",
  titleID: "",
  dismissible: true,
  closeLabel: "Закрыть",
});

const emit = defineEmits<{
  close: [];
  opened: [];
}>();

const dialog = ref<HTMLDialogElement | null>(null);
const generatedTitleID = `sheet-dialog-title-${useId()}`;
const resolvedTitleID = computed(() => props.titleID || generatedTitleID);
let opener: HTMLElement | null = null;
let fallbackFocusTarget: HTMLElement | null = null;

function syncDialog(open: boolean) {
  if (!dialog.value) {
    return;
  }
  if (open && !dialog.value.open) {
    if (activeSheetDialog && activeSheetDialog !== dialog.value) {
      activeSheetDialog.close();
    }
    opener = document.activeElement instanceof HTMLElement
      && document.activeElement !== document.body
      ? document.activeElement
      : null;
    fallbackFocusTarget = dialog.value.closest<HTMLElement>(".game-table");
    dialog.value.showModal();
    activeSheetDialog = dialog.value;
    emit("opened");
    void nextTick(() => {
      dialog.value?.querySelector<HTMLElement>("[data-dialog-autofocus]")?.focus();
    });
  } else if (!open && dialog.value.open) {
    dialog.value.close();
  }
}

function requestClose() {
  if (!props.dismissible) {
    return;
  }
  if (dialog.value?.open) {
    dialog.value.close();
  }
}

function handleCancel(event: Event) {
  if (!props.dismissible) {
    event.preventDefault();
  }
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) {
    requestClose();
  }
}

function handleNativeClose() {
  const returnTarget = opener;
  const fallbackTarget = fallbackFocusTarget;
  opener = null;
  fallbackFocusTarget = null;
  if (activeSheetDialog === dialog.value) {
    activeSheetDialog = null;
  }
  void nextTick(() => {
    if (returnTarget?.isConnected) {
      returnTarget.focus();
    } else if (fallbackTarget?.isConnected) {
      fallbackTarget.focus();
    }
  });
  if (props.open) {
    emit("close");
  }
}

watch(() => props.open, syncDialog);

onMounted(() => syncDialog(props.open));

onBeforeUnmount(() => {
  const returnTarget = opener;
  opener = null;
  if (activeSheetDialog === dialog.value) {
    activeSheetDialog = null;
  }
  void nextTick(() => returnTarget?.isConnected && returnTarget.focus());
});
</script>

<template>
  <dialog
    ref="dialog"
    class="sheet-dialog"
    tabindex="0"
    :aria-labelledby="resolvedTitleID"
    :aria-describedby="description || compactDescription ? `${resolvedTitleID}-description` : undefined"
    aria-modal="true"
    @cancel="handleCancel"
    @close="handleNativeClose"
    @click="handleBackdropClick"
  >
    <form class="sheet-dialog__surface" method="dialog" @click.stop>
      <header class="sheet-dialog__header">
        <div>
          <h2 :id="resolvedTitleID" tabindex="-1" data-dialog-autofocus>
            <span class="sheet-dialog__desktop-copy">{{ title }}</span>
            <span class="sheet-dialog__compact-copy">{{ compactTitle || title }}</span>
          </h2>
          <p v-if="description || compactDescription" :id="`${resolvedTitleID}-description`">
            <span class="sheet-dialog__desktop-copy">{{ description }}</span>
            <span class="sheet-dialog__compact-copy">{{ compactDescription || description }}</span>
          </p>
        </div>
        <slot name="header-action">
          <button
            v-if="dismissible"
            class="sheet-dialog__close"
            type="button"
            :aria-label="closeLabel"
            @click="requestClose"
          >
            {{ closeLabel }}
          </button>
        </slot>
      </header>
      <div class="sheet-dialog__content">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="sheet-dialog__footer">
        <slot name="footer" />
      </footer>
    </form>
  </dialog>
</template>

<style scoped lang="scss">
@use "../../assets/scss/api" as api;

.sheet-dialog {
  width: min(42rem, calc(100% - 1rem));
  max-width: none;
  max-height: min(90dvh, 52rem);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sheet);
  padding: 0;
  color: var(--color-text);
  background: var(--color-paper);
}

.sheet-dialog::backdrop {
  background: var(--color-scrim);
}

.sheet-dialog__surface {
  display: grid;
  gap: var(--space-4);
  max-height: min(90dvh, 52rem);
  overflow: auto;
  padding: var(--space-4);
}

.sheet-dialog__header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-3);
  background: var(--color-paper);
}

.sheet-dialog__header h2,
.sheet-dialog__header p {
  margin: 0;
}

.sheet-dialog__compact-copy { display: none; }

.sheet-dialog__header [data-dialog-autofocus]:focus {
  outline: none;
}

.sheet-dialog__header p {
  max-width: 56ch;
  margin-top: var(--space-2);
  color: var(--color-text-muted);
}

.sheet-dialog__close {
  @include api.touch-target;
  flex: 0 0 auto;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-control);
  padding: .5rem .7rem;
  color: var(--color-text);
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.sheet-dialog__close:focus-visible {
  @include api.focus-ring;
}

.sheet-dialog__content {
  min-width: 0;
}

.sheet-dialog__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: var(--space-2);
}

@media (width <= 1023px) {
  .sheet-dialog {
    width: min(560px, calc(100% - 24px));
    max-height: min(470px, calc(100dvh - 24px));
    margin: auto auto max(12px, env(safe-area-inset-bottom, 0px));
    border-radius: 24px;
  }

  .sheet-dialog__surface {
    min-height: min(470px, calc(100dvh - 24px));
    max-height: min(470px, calc(100dvh - 24px));
    box-sizing: border-box;
    padding: 16px 16px calc(20px + env(safe-area-inset-bottom, 0px));
  }

  .sheet-dialog__desktop-copy { display: none; }
  .sheet-dialog__compact-copy { display: inline; }

  .sheet-dialog__footer { margin-top: auto; }
}

@media (width <= 599px) {
  .sheet-dialog {
    width: 100%;
    margin: auto 0 0;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: 24px 24px 0 0;
  }

  .sheet-dialog.mobile-door-decision .sheet-dialog__surface {
    padding-bottom: calc(36px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
