<script setup lang="ts">
import {nextTick, onMounted, ref, watch} from "vue";

const props = withDefaults(defineProps<{
  open: boolean;
  title: string;
  description?: string;
  titleID?: string;
  dismissible?: boolean;
  closeLabel?: string;
}>(), {
  description: "",
  titleID: "sheet-dialog-title",
  dismissible: true,
  closeLabel: "Закрыть",
});

const emit = defineEmits<{
  close: [];
  opened: [];
}>();

const dialog = ref<HTMLDialogElement | null>(null);

function syncDialog(open: boolean) {
  if (!dialog.value) {
    return;
  }
  if (open && !dialog.value.open) {
    dialog.value.showModal();
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
  if (props.open) {
    emit("close");
  }
}

watch(() => props.open, syncDialog);

onMounted(() => syncDialog(props.open));
</script>

<template>
  <dialog
    ref="dialog"
    class="sheet-dialog"
    :aria-labelledby="titleID"
    :aria-describedby="description ? `${titleID}-description` : undefined"
    aria-modal="true"
    @cancel="handleCancel"
    @close="handleNativeClose"
    @click="handleBackdropClick"
  >
    <form class="sheet-dialog__surface" method="dialog" @click.stop>
      <header class="sheet-dialog__header">
        <div>
          <h2 :id="titleID">{{ title }}</h2>
          <p v-if="description" :id="`${titleID}-description`">
            {{ description }}
          </p>
        </div>
        <button
          v-if="dismissible"
          class="sheet-dialog__close"
          type="button"
          :aria-label="closeLabel"
          data-dialog-autofocus
          @click="requestClose"
        >
          {{ closeLabel }}
        </button>
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
</style>
