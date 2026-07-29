<script setup lang="ts">
import type {StudioJob} from "@munchkin/contracts";

defineProps<{
  jobs: StudioJob[];
  selectedID?: string;
}>();

const emit = defineEmits<{
  select: [job: StudioJob];
}>();
</script>

<template>
  <div class="studio-history">
    <p v-if="jobs.length === 0" class="studio-empty">
      Для этой карты generation history пока пуста.
    </p>
    <template v-else>
      <button
        v-for="job in jobs"
        :key="job.id"
        type="button"
        class="studio-history__job"
        :class="{'studio-history__job--selected': job.id === selectedID}"
        @click="emit('select', job)"
      >
        <span :data-status="job.status">{{ job.status }}</span>
        <strong>{{ job.quality }} · {{ job.model }}</strong>
        <small>{{ new Date(job.created_at).toLocaleString("ru-RU") }}</small>
      </button>
    </template>
  </div>
</template>
