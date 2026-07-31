<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";
import type {
  CardActionBinding,
  CardActionState,
} from "../actionModel";

withDefaults(defineProps<{
  cards: CardView[];
  contentSetId: string;
  bindingsForCard?: (cardID: string) => CardActionBinding[];
  stateForCard?: (cardID: string) => CardActionState;
  confirmedCardIds?: ReadonlySet<string>;
}>(), {
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
        <h3 id="hand-title">Рука — {{ cards.length }} карт</h3>
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

    <div
      class="hand-browser__rail"
      :role="cards.length ? 'list' : undefined"
      :tabindex="cards.length ? 0 : undefined"
      aria-label="Карты в руке, прокручиваемая лента"
    >
      <GameCard
        v-for="card in cards"
        :key="card.instance_id"
        :card="card"
        :content-set-id="contentSetId"
        compact
        :action-bindings="bindingsForCard(card.instance_id)"
        :action-state="stateForCard(card.instance_id)"
        :motion-state="confirmedCardIds.has(card.instance_id) ? 'confirmed' : undefined"
        role="listitem"
        @activate="emit('activate', $event)"
      />
      <p v-if="!cards.length" class="hand-browser__empty">Карт нет.</p>
    </div>

    <dialog ref="dialog" class="hand-sheet" aria-labelledby="hand-sheet-title" @close="restoreFocus">
      <form class="hand-sheet__surface" method="dialog">
        <header class="hand-sheet__header">
          <div>
            <p class="eyebrow">ПОЛНЫЙ ПРОСМОТР</p>
            <h2 id="hand-sheet-title">Вся рука</h2>
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

<style scoped>
.hand-browser {
  min-width: 0;
  display: grid;
  gap: .5rem;
}

.hand-browser__heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.hand-browser__heading h3 {
  margin: .35rem 0 0;
}

.hand-browser__open {
  flex: 0 0 auto;
  min-height: 2.75rem;
  border-color: var(--line);
  color: var(--ink);
  background: transparent;
  text-transform: none;
  letter-spacing: 0;
}

.hand-browser__rail {
  display: flex;
  gap: .75rem;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  padding: 1rem .15rem;
  scrollbar-gutter: stable;
}

.hand-browser__empty {
  margin: 1rem 0;
  color: var(--muted);
}

.hand-sheet {
  width: min(56rem, calc(100% - 1rem));
  max-width: none;
  max-height: min(90dvh, 56rem);
  border: 1px solid var(--line);
  padding: 0;
  color: var(--ink);
  background: var(--paper);
}

.hand-sheet::backdrop {
  background: rgb(0 0 0 / 72%);
}

.hand-sheet__surface {
  display: grid;
  gap: 1rem;
  max-height: min(90dvh, 56rem);
  overflow: auto;
  padding: 1rem;
}

.hand-sheet__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  position: sticky;
  top: 0;
  z-index: 1;
  padding-bottom: .75rem;
  background: var(--paper);
}

.hand-sheet__header h2 { margin: .35rem 0 0; }

.hand-sheet__close {
  border-color: var(--line);
  color: var(--ink);
  background: transparent;
}

.hand-sheet__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(178px, 1fr));
  gap: .75rem;
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
