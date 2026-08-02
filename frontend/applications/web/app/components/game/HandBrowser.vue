<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";
import type {
  CardActionBinding,
  CardActionState,
} from "../actionModel";
import CardRail from "./primitives/CardRail.vue";

withDefaults(defineProps<{
  cards: CardView[];
  contentSetId: string;
  showMeta?: boolean;
  bindingsForCard?: (cardID: string) => CardActionBinding[];
  stateForCard?: (cardID: string) => CardActionState;
  confirmedCardIds?: ReadonlySet<string>;
}>(), {
  showMeta: false,
  bindingsForCard: () => [],
  stateForCard: () => "idle" as CardActionState,
  confirmedCardIds: () => new Set<string>(),
});

const emit = defineEmits<{
  activate: [binding: CardActionBinding];
}>();

const dialog = ref<HTMLDialogElement | null>(null);
const openButton = ref<HTMLButtonElement | null>(null);

function openHandSheet() {
  dialog.value?.showModal();
  nextTick(() => {
    dialog.value?.querySelector<HTMLButtonElement>("[data-close-hand]")?.focus();
  });
}

function closeHandSheet() {
  if (dialog.value?.open) {
    dialog.value.close();
  }
}

function restoreFocus() {
  openButton.value?.focus();
}
</script>

<template>
  <section class="hand-browser" aria-labelledby="hand-title">
    <div class="hand-browser__heading">
      <div>
        <p class="eyebrow">СОБСТВЕННЫЕ КАРТЫ</p>
        <h3 id="hand-title">Рука · {{ cards.length }}</h3>
      </div>
      <button
        ref="openButton"
        class="hand-browser__open"
        type="button"
        :disabled="!cards.length"
        @click="openHandSheet"
      >
        Показать всю руку
      </button>
    </div>

    <CardRail
      title="Карты в руке"
      :item-count="cards.length"
      labelled-by="hand-title"
      :show-heading="false"
    >
      <GameCard
        v-for="card in cards"
        :key="card.instance_id"
        :card="card"
        :content-set-id="contentSetId"
        compact
        :show-meta="showMeta"
        :action-bindings="bindingsForCard(card.instance_id)"
        :action-state="stateForCard(card.instance_id)"
        :motion-state="confirmedCardIds.has(card.instance_id) ? 'confirmed' : undefined"
        role="listitem"
        @activate="emit('activate', $event)"
      />
    </CardRail>

    <dialog
      ref="dialog"
      class="hand-sheet"
      aria-labelledby="hand-sheet-title"
      @close="restoreFocus"
    >
      <form class="hand-sheet__surface" method="dialog">
        <header class="hand-sheet__header">
          <div>
            <p class="eyebrow">ПОЛНЫЙ ПРОСМОТР</p>
            <h2 id="hand-sheet-title">Рука · {{ cards.length }}</h2>
          </div>
          <button
            data-close-hand
            class="hand-sheet__close"
            type="button"
            aria-label="Закрыть полный просмотр руки"
            @click="closeHandSheet"
          >
            Закрыть
          </button>
        </header>
        <div class="hand-sheet__grid" role="list">
          <GameCard
            v-for="card in cards"
            :key="`sheet-${card.instance_id}`"
            :card="card"
            :content-set-id="contentSetId"
            compact
            :show-meta="showMeta"
            :action-bindings="bindingsForCard(card.instance_id)"
            :action-state="stateForCard(card.instance_id)"
            :motion-state="confirmedCardIds.has(card.instance_id) ? 'confirmed' : undefined"
            role="listitem"
            @activate="emit('activate', $event)"
          />
        </div>
      </form>
    </dialog>
  </section>
</template>

<style scoped lang="scss">
@use "../../assets/scss/api" as api;

.hand-browser {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}

.hand-browser__heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-4);
}

.hand-browser__heading h3 {
  margin: .35rem 0 0;
}

.hand-browser__open,
.hand-sheet__close {
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

.hand-browser__open:focus-visible,
.hand-sheet__close:focus-visible {
  @include api.focus-ring;
}

.hand-browser__open:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.hand-sheet {
  width: min(56rem, calc(100% - 1rem));
  max-width: none;
  max-height: min(90dvh, 56rem);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sheet);
  padding: 0;
  color: var(--color-text);
  background: var(--color-paper);
}

.hand-sheet::backdrop {
  background: var(--color-scrim);
}

.hand-sheet__surface {
  display: grid;
  gap: var(--space-4);
  max-height: min(90dvh, 56rem);
  overflow: auto;
  padding: var(--space-4);
}

.hand-sheet__header {
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

.hand-sheet__header h2 { margin: .35rem 0 0; }

.hand-sheet__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(178px, 1fr));
  gap: var(--space-3);
}

@media (width <= 599px) {
  .hand-browser__heading {
    align-items: start;
    flex-direction: column;
  }

  .hand-browser__open {
    width: 100%;
  }

  .hand-sheet__grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style>
