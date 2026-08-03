<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";
import GameCard from "../../GameCard.vue";

const props = withDefaults(defineProps<{
  cards: CardView[];
  contentSetId?: string;
}>(), {
  contentSetId: "",
});

const dialog = ref<HTMLDialogElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);

function openHand() {
  dialog.value?.showModal();
  void nextTick(() => dialog.value?.querySelector<HTMLButtonElement>("[data-close-hand]")?.focus());
}

function closeHand() {
  if (dialog.value?.open) {
    dialog.value.close();
  }
}

function restoreFocus() {
  trigger.value?.focus();
}
</script>

<template>
  <section class="hand-sheet-control" aria-labelledby="hand-sheet-trigger-title">
    <button
      id="hand-sheet-trigger-title"
      ref="trigger"
      class="hand-sheet__trigger"
      type="button"
      :disabled="!props.cards.length"
      @click="openHand"
    >
      Открыть руку · {{ props.cards.length }}
    </button>

    <dialog
      ref="dialog"
      class="hand-sheet"
      aria-labelledby="hand-sheet-title"
      @close="restoreFocus"
    >
      <form class="hand-sheet__surface" method="dialog">
        <header class="hand-sheet__header">
          <h2 id="hand-sheet-title">Рука · {{ props.cards.length }}</h2>
          <button
            data-close-hand
            class="hand-sheet__close"
            type="button"
            aria-label="Закрыть руку"
            @click="closeHand"
          >
            Закрыть
          </button>
        </header>
        <div v-if="props.cards.length" class="hand-sheet__grid" role="list">
          <GameCard
            v-for="card in props.cards"
            :key="`hand-sheet-${card.instance_id}`"
            :card="card"
            :content-set-id="props.contentSetId"
            compact
            role="listitem"
          />
        </div>
        <p v-else class="hand-sheet__empty" role="status">В руке сейчас нет карт.</p>
      </form>
    </dialog>
  </section>
</template>

<style scoped lang="scss">
@use "../../../assets/scss/api" as api;

.hand-sheet__trigger,
.hand-sheet__close {
  @include api.touch-target;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-control);
  padding: .5rem .7rem;
  color: var(--color-text-primary);
  background: transparent;
  font: inherit;
  font-size: .7rem;
  cursor: pointer;
}

.hand-sheet__trigger:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.hand-sheet__trigger:focus-visible,
.hand-sheet__close:focus-visible {
  @include api.focus-ring;
}

.hand-sheet {
  width: min(1056px, calc(100% - 32px));
  max-width: none;
  max-height: min(90dvh, 520px);
  border: 1px solid var(--color-line);
  border-radius: 24px;
  padding: 0;
  color: var(--color-text-primary);
  background: var(--color-surface);
  box-shadow: 0 16px 36px rgb(46 43 41 / 24%);
}

.hand-sheet::backdrop {
  background: var(--color-scrim);
}

.hand-sheet__surface {
  display: grid;
  gap: 20px;
  padding: 16px 24px 20px;
}

.hand-sheet__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}

.hand-sheet__header h2 {
  margin: 8px 0 0;
  font-size: 1.05rem;
}

.hand-sheet__grid {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, 150px);
  justify-content: center;
  gap: 32px;
}

.hand-sheet__grid :deep(.card-frame--compact) {
  width: 150px;
  min-height: 218px;
  height: 218px;
  grid-template-rows: auto 76px minmax(0, 1fr) auto;
  border-radius: 12px;
  padding: 8px;
}

.hand-sheet__grid :deep(.game-card__name) {
  font-family: var(--font-card);
  font-size: .74rem;
}

.hand-sheet__grid :deep(.game-card__rules) {
  font-size: .58rem;
  line-height: 1.28;
}

.hand-sheet__empty {
  margin: 0;
  color: var(--color-text-secondary);
}

@media (max-width: 599px) {
  .hand-sheet {
    width: min(100% - 16px, 28rem);
    border-radius: 16px;
  }

  .hand-sheet__surface {
    padding: 12px;
  }

  .hand-sheet__grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
  }

  .hand-sheet__grid :deep(.card-frame--compact) {
    width: 100%;
  }
}
</style>
