<script setup lang="ts">
withDefaults(defineProps<{
  label: string;
  tone?: "neutral" | "positive" | "info" | "warning" | "danger";
}>(), {
  tone: "neutral",
});
</script>

<template>
  <span class="status-badge" :data-tone="tone" role="status">
    <span class="status-badge__mark" aria-hidden="true" />
    <span>{{ label }}</span>
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  padding: .25rem .55rem;
  color: var(--color-text-muted);
  background: var(--color-paper);
  font-size: .7rem;
  font-weight: 800;
  line-height: 1.2;
}

.status-badge__mark {
  width: .5rem;
  height: .5rem;
  border-radius: 50%;
  background: currentColor;
}

.status-badge[data-tone="positive"] { color: var(--color-success); }
.status-badge[data-tone="info"] { color: var(--color-info); }
.status-badge[data-tone="warning"] { color: var(--color-rust); }
.status-badge[data-tone="danger"] { color: var(--color-danger); }
</style>
