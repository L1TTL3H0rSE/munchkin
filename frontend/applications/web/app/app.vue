<script setup lang="ts">
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
  <div class="app-shell">
    <a class="skip-link" href="#main-content">
      Перейти к основному содержимому
    </a>
    <header class="topbar">
      <NuxtLink class="brand" to="/">MUNCHKIN CLONE // ORIGINAL DEMO</NuxtLink>
      <span class="status-pill">authoritative server</span>
    </header>
    <main id="main-content" class="app-main" tabindex="-1">
      <NuxtPage />
    </main>
  </div>
</template>
