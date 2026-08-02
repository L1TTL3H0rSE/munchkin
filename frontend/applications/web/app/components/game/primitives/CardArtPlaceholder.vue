<script setup lang="ts">
defineProps<{
  label: string;
}>();
</script>

<template>
  <div class="card-art-placeholder" role="img" :aria-label="label">
    <span class="card-art-placeholder__diamond" aria-hidden="true" />
    <span class="card-art-placeholder__line" aria-hidden="true" />
  </div>
</template>

<style scoped>
.card-art-placeholder {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: var(--card-accent, var(--color-accent-strong));
  background:
    radial-gradient(circle at 72% 22%, currentColor 0 4%, transparent 4.5%),
    linear-gradient(34deg, transparent 0 43%, currentColor 43.5% 45%, transparent 45.5%),
    linear-gradient(145deg, var(--card-accent-deep, var(--color-board)), var(--color-board));
}

.card-art-placeholder__diamond,
.card-art-placeholder__line {
  position: absolute;
  border: 2px solid currentColor;
  transform: rotate(45deg);
}

.card-art-placeholder__diamond {
  width: 34%;
  aspect-ratio: 1;
}

.card-art-placeholder__line {
  width: 55%;
  height: 22%;
  border-width: 0 0 2px;
  transform: rotate(-18deg);
}
</style>
