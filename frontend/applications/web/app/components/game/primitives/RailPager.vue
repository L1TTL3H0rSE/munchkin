<script setup lang="ts">
const props = withDefaults(defineProps<{
  page: number;
  pageCount: number;
  label?: string;
}>(), {
  label: "Навигация по картам",
});

const emit = defineEmits<{
  select: [page: number];
}>();

function select(page: number) {
  if (page >= 0 && page < props.pageCount && page !== props.page) {
    emit("select", page);
  }
}
</script>

<template>
  <nav v-if="pageCount > 1" class="rail-pager" :aria-label="label">
    <button
      type="button"
      :disabled="page <= 0"
      aria-label="Предыдущая страница карт"
      @click="select(page - 1)"
    >
      ←
    </button>
    <ol>
      <li v-for="index in pageCount" :key="index">
        <button
          type="button"
          :aria-label="`Страница ${index}`"
          :aria-current="index - 1 === page ? 'page' : undefined"
          @click="select(index - 1)"
        >
          {{ index }}
        </button>
      </li>
    </ol>
    <button
      type="button"
      :disabled="page >= pageCount - 1"
      aria-label="Следующая страница карт"
      @click="select(page + 1)"
    >
      →
    </button>
  </nav>
</template>

<style scoped lang="scss">
@use "../../../assets/scss/api" as api;

.rail-pager,
.rail-pager ol {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.rail-pager {
  justify-content: center;
}

.rail-pager ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rail-pager button {
  @include api.touch-target;
  min-width: 2.75rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-paper);
  font: inherit;
  cursor: pointer;
}

.rail-pager button:focus-visible {
  @include api.focus-ring;
}

.rail-pager button[aria-current="page"] {
  border-color: var(--color-accent-strong);
  color: var(--color-paper);
  background: var(--color-accent-strong);
}

.rail-pager button:disabled {
  cursor: not-allowed;
  opacity: .5;
}
</style>
