<script setup lang="ts">
import CardStudioPanel from "../../components/studio/CardStudioPanel.vue";

if (!import.meta.dev) {
  throw createError({statusCode: 404, statusMessage: "Not Found"});
}

useHead({
  title: "Moscow Card Studio",
  meta: [
    {
      name: "robots",
      content: "noindex,nofollow,noarchive",
    },
  ],
});
</script>

<template>
  <CardStudioPanel />
</template>
