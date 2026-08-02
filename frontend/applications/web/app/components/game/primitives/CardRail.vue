<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  itemCount: number;
  currentIndex?: number;
  pageCount?: number;
  emptyCopy?: string;
  labelledBy?: string;
  showHeading?: boolean;
}>(), {
  currentIndex: 0,
  pageCount: 1,
  emptyCopy: "Пока ничего.",
  labelledBy: undefined,
  showHeading: true,
});

const emit = defineEmits<{
  previous: [];
  next: [];
}>();
</script>

<template>
  <section
    class="card-rail"
    :aria-labelledby="labelledBy"
    :aria-label="labelledBy ? undefined : title"
  >
    <header v-if="showHeading" class="card-rail__header">
      <h3 :id="labelledBy">{{ title }}</h3>
      <span v-if="itemCount" class="card-rail__count">{{ itemCount }}</span>
    </header>
    <div
      class="card-rail__viewport"
      :role="itemCount ? 'list' : undefined"
      :tabindex="itemCount ? 0 : undefined"
      :aria-label="`${title}, прокручиваемая лента`"
    >
      <slot v-if="itemCount" />
      <p v-else class="card-rail__empty" role="status">{{ emptyCopy }}</p>
    </div>
    <nav
      v-if="pageCount > 1"
      class="card-rail__pager"
      :aria-label="`Навигация: ${title}`"
    >
      <button
        type="button"
        :disabled="currentIndex <= 0"
        @click="emit('previous')"
      >
        Назад
      </button>
      <span aria-live="polite">{{ currentIndex + 1 }} из {{ pageCount }}</span>
      <button
        type="button"
        :disabled="currentIndex >= pageCount - 1"
        @click="emit('next')"
      >
        Дальше
      </button>
    </nav>
  </section>
</template>

<style scoped lang="scss">
@use "../../../assets/scss/api" as api;

.card-rail {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}

.card-rail__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.card-rail__header h3 {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.card-rail__count {
  color: var(--color-text-muted);
  font-size: .75rem;
  font-variant-numeric: tabular-nums;
}

.card-rail__viewport {
  display: flex;
  gap: var(--space-3);
  min-width: 0;
  min-height: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  padding: var(--space-2) .15rem var(--space-3);
  scrollbar-gutter: stable;
  scroll-snap-type: inline proximity;
}

.card-rail__viewport:focus-visible {
  @include api.focus-ring;
}

.card-rail__empty {
  margin: var(--space-2) 0;
  color: var(--color-text-muted);
}

.card-rail__pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--color-text-muted);
  font-size: .75rem;
}

.card-rail__pager button {
  @include api.touch-target;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-control);
  padding: .35rem .6rem;
  color: var(--color-text);
  background: var(--color-paper);
  font: inherit;
  cursor: pointer;
}

.card-rail__pager button:focus-visible {
  @include api.focus-ring;
}

.card-rail__pager button:disabled {
  cursor: not-allowed;
  opacity: .5;
}
</style>
