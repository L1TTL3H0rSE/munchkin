<script setup lang="ts">
import {ref} from "vue";

defineProps<{
  title: string;
  triggerLabel: string;
  dialogId: string;
}>();

const open = ref(false);

function close(): void {
  open.value = false;
}
</script>

<template>
  <button
    class="sheet-trigger"
    type="button"
    :aria-controls="dialogId"
    :aria-expanded="open"
    @click="open = true"
  >
    {{ triggerLabel }}
  </button>
  <dialog
    :id="dialogId"
    class="sheet-dialog"
    :open="open"
    :aria-labelledby="`${dialogId}-title`"
    @click.self="close"
  >
    <header class="sheet-dialog__header">
      <h2 :id="`${dialogId}-title`">{{ title }}</h2>
      <button type="button" aria-label="Закрыть информационный лист" @click="close">
        Закрыть
      </button>
    </header>
    <div class="sheet-dialog__content">
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
.sheet-trigger {
  min-height: 2.75rem;
  border: 1px solid var(--color-line, #566044);
  color: inherit;
  background: transparent;
}

.sheet-dialog {
  width: min(42rem, calc(100vw - 2rem));
  max-height: min(86dvh, 48rem);
  margin: auto;
  border: 1px solid var(--color-accent-strong);
  padding: 1rem;
  color: inherit;
  background: var(--color-board, #11140c);
}

.sheet-dialog::backdrop {
  background: rgb(0 0 0 / 68%);
}

.sheet-dialog__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.sheet-dialog__header h2 {
  margin: 0;
  overflow-wrap: anywhere;
}

.sheet-dialog__content {
  display: grid;
  gap: .8rem;
  min-width: 0;
  margin-top: 1rem;
}

@media (width <= 767px) {
  .sheet-dialog {
    width: 100%;
    margin: auto 0 0;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  }
}
</style>
