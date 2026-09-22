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
  desktopWidth?: string;
  compactWidth?: string;
  mobileWidth?: string;
  desktopHeight?: string;
  compactHeight?: string;
  desktopPadding?: string;
  desktopGap?: string;
  compactGap?: string;
  compactPadding?: string;
  hideCompactDescription?: boolean;
  hideHeader?: boolean;
  ariaLabel?: string;
}>(), {
  description: "",
  compactTitle: "",
  compactDescription: "",
  titleID: "",
  dismissible: true,
  closeLabel: "Закрыть",
  desktopWidth: "42rem",
  compactWidth: "560px",
  mobileWidth: "100%",
  desktopHeight: "",
  compactHeight: "470px",
  desktopPadding: "var(--space-4)",
  desktopGap: "var(--space-4)",
  compactGap: "var(--space-4)",
  compactPadding: "16px 16px calc(36px + env(safe-area-inset-bottom, 0px))",
  hideCompactDescription: false,
  hideHeader: false,
  ariaLabel: "",
});

const emit = defineEmits<{
  close: [];
  opened: [];
}>();

const dialog = ref<HTMLDialogElement | null>(null);
const generatedTitleID = `sheet-dialog-title-${useId()}`;
const resolvedTitleID = computed(() => props.titleID || generatedTitleID);
const layoutTokens = computed<Record<string, string>>(() => {
  const tokens: Record<string, string> = {
    "--sheet-dialog-width": `min(${props.desktopWidth}, calc(100% - 24px))`,
    "--sheet-dialog-compact-width": `min(${props.compactWidth}, calc(100% - 24px))`,
    "--sheet-dialog-mobile-width": props.mobileWidth,
    "--sheet-dialog-compact-height": props.compactHeight,
    "--sheet-dialog-desktop-padding": props.desktopPadding,
    "--sheet-dialog-desktop-gap": props.desktopGap,
    "--sheet-dialog-compact-gap": props.compactGap,
    "--sheet-dialog-compact-padding": props.compactPadding,
  };
  if (props.desktopHeight) {
    tokens["--sheet-dialog-desktop-height"] = props.desktopHeight;
  }
  return tokens;
});
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
    :style="layoutTokens"
    tabindex="0"
    :aria-labelledby="hideHeader ? undefined : resolvedTitleID"
    :aria-label="hideHeader ? ariaLabel || title : undefined"
    :aria-describedby="!hideHeader && (description || compactDescription) ? `${resolvedTitleID}-description` : undefined"
    aria-modal="true"
    @cancel="handleCancel"
    @close="handleNativeClose"
    @click="handleBackdropClick"
  >
    <form class="sheet-dialog__surface" method="dialog" @click.stop>
      <header v-if="!hideHeader" class="sheet-dialog__header">
        <div>
          <h2 :id="resolvedTitleID" tabindex="-1" data-dialog-autofocus>
            <span class="sheet-dialog__desktop-copy">{{ title }}</span>
            <span class="sheet-dialog__compact-copy">{{ compactTitle || title }}</span>
          </h2>
          <p v-if="description || compactDescription" :id="`${resolvedTitleID}-description`">
            <span class="sheet-dialog__desktop-copy">{{ description }}</span>
            <span v-if="!hideCompactDescription" class="sheet-dialog__compact-copy">{{ compactDescription || description }}</span>
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
  width: var(--sheet-dialog-width, min(var(--sheet-dialog-max-width, 42rem), calc(100% - 1rem)));
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
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--sheet-dialog-desktop-gap, var(--space-4));
  min-height: var(--sheet-dialog-desktop-height, auto);
  box-sizing: border-box;
  max-height: min(90dvh, 52rem);
  overflow: auto;
  padding: var(--sheet-dialog-desktop-padding, var(--space-4));
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
  border: 0;
  margin: 0;
  background: transparent;
}

.sheet-dialog__header h2 {
  font-size: 20px;
  line-height: 24px;
}

.sheet-dialog__compact-copy { display: none; }

.sheet-dialog__header [data-dialog-autofocus]:focus,
.sheet-dialog__header [data-dialog-autofocus]:focus-visible {
  outline: none !important;
  box-shadow: none;
}

.sheet-dialog__header p {
  max-width: 56ch;
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 16px;
}

.sheet-dialog__close {
  @include api.touch-target;
  flex: 0 0 auto;
  min-width: 110px;
  min-height: 52px;
  border: 1px solid var(--color-accent-strong);
  border-radius: 14px;
  padding: .5rem .7rem;
  color: var(--color-accent-strong);
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
    width: var(--sheet-dialog-compact-width, min(var(--sheet-dialog-compact-max-width, 560px), calc(100% - 24px)));
    max-height: min(var(--sheet-dialog-compact-height, 470px), calc(100dvh - 24px));
    margin: auto auto max(12px, env(safe-area-inset-bottom, 0px));
    border-radius: 24px;
  }

  .sheet-dialog__surface {
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--sheet-dialog-compact-gap, var(--space-4));
    min-height: min(var(--sheet-dialog-compact-height, 470px), calc(100dvh - 24px));
    max-height: min(var(--sheet-dialog-compact-height, 470px), calc(100dvh - 24px));
    box-sizing: border-box;
    padding: var(--sheet-dialog-compact-padding, 16px 16px calc(36px + env(safe-area-inset-bottom, 0px)));
  }

  .sheet-dialog__header { padding-top: 4px; }

  .sheet-dialog__close {
    min-width: 70px;
    min-height: 44px;
    margin-top: -10px;
    border-color: var(--color-status-warning);
    color: var(--color-status-warning);
    padding: 0;
  }

  .sheet-dialog__desktop-copy { display: none; }
  .sheet-dialog__compact-copy { display: inline; }

  .sheet-dialog__footer { margin-top: auto; }
}

@media (width <= 599px) {
  .sheet-dialog {
    width: var(--sheet-dialog-mobile-width, 100%);
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
