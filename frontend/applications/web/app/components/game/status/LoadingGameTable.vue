<script setup lang="ts">
import SystemStateSurface from "./SystemStateSurface.vue";
</script>

<template>
  <main
    class="loading-game-table"
    data-figma-node="296:3058"
    aria-label="Загрузка игрового стола"
    aria-busy="true"
  >
    <SystemStateSurface kind="loading" />
  </main>
</template>

<style scoped>
.loading-game-table {
  min-height: 100svh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  padding: 24px;
  background: var(--color-canvas);
}
</style>
