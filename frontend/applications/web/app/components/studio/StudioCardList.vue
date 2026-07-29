<script setup lang="ts">
import type {StudioCardDefinition} from "@munchkin/contracts";

defineProps<{
  cards: StudioCardDefinition[];
  selectedID: string;
}>();

const emit = defineEmits<{
  select: [cardID: string];
}>();
</script>

<template>
  <div class="studio-card-list" role="listbox" aria-label="Карты Moscow v1">
    <button
      v-for="card in cards"
      :key="card.id"
      type="button"
      class="studio-card-row"
      :class="{'studio-card-row--selected': card.id === selectedID}"
      :aria-selected="card.id === selectedID"
      role="option"
      @click="emit('select', card.id)"
    >
      <span class="studio-card-row__name">{{ card.name }}</span>
      <span class="studio-card-row__meta">
        {{ card.deck === "door" ? "Дверь" : "Сокровище" }}
        · {{ card.kind.replaceAll("_", " ") }}
      </span>
      <span class="studio-card-row__status" :data-status="card.art_status">
        {{ card.art_status }}
      </span>
    </button>
  </div>
</template>
