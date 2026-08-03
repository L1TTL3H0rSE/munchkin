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
    <main id="main-content" class="app-main" tabindex="-1">
      <NuxtPage />
    </main>
  </div>
</template>
