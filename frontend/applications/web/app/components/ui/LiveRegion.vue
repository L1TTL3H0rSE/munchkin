<script setup lang="ts">
withDefaults(defineProps<{
  politeness?: "polite" | "assertive" | "off";
  atomic?: boolean;
}>(), {
  politeness: "polite",
  atomic: true,
});
</script>

<template>
  <p
    class="live-region"
    :aria-live="politeness"
    :aria-atomic="atomic"
    role="status"
  >
    <slot />
  </p>
</template>

<style scoped>
.live-region {
  min-height: 1.25em;
  margin: 0;
  color: var(--color-text-muted);
}
</style>
