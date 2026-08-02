<script setup lang="ts">
import {computed} from "vue";

const route = useRoute();
const isLobby = computed(() => route.path === "/");

useHead({
  meta: [
    {
      name: "viewport",
      content: "width=device-width, initial-scale=1, viewport-fit=cover",
    },
  ],
});
</script>

<template>
  <div
    class="app-shell"
    :class="{'app-shell--lobby': isLobby}"
    :data-route="isLobby ? 'lobby' : 'game'"
  >
    <a class="skip-link" href="#main-content">
      Перейти к основному содержимому
    </a>
    <header v-if="!isLobby" class="topbar" aria-label="Навигация игры">
      <NuxtLink class="brand" to="/">MUNCHKIN CLONE // ORIGINAL DEMO</NuxtLink>
      <span class="status-pill">Итоги подтверждает сервер</span>
    </header>
    <main id="main-content" class="app-main" tabindex="-1">
      <NuxtPage />
    </main>
  </div>
</template>
