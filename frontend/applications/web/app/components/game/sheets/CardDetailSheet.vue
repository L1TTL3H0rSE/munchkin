<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";

import SheetDialog from "./SheetDialog.vue";

defineProps<{
  card: CardView;
  dialogId: string;
}>();
</script>

<template>
  <SheetDialog
    :title="card.name"
    :trigger-label="`Подробнее: ${card.name}`"
    :dialog-id="dialogId"
  >
    <article class="card-detail-sheet">
      <div class="card-detail-sheet__art" aria-hidden="true">
        <img v-if="card.image" :src="`/${card.image}`" alt="">
        <span v-else>Иллюстрация появится позже</span>
      </div>
      <dl class="card-detail-sheet__facts">
        <div v-if="card.combat_strength !== undefined">
          <dt>Сила</dt>
          <dd>{{ card.combat_strength }}</dd>
        </div>
        <div v-if="card.bonus !== undefined">
          <dt>Бонус</dt>
          <dd>{{ card.bonus > 0 ? `+${card.bonus}` : card.bonus }}</dd>
        </div>
        <div v-if="card.value !== undefined">
          <dt>Стоимость</dt>
          <dd>{{ card.value }}</dd>
        </div>
        <div v-if="card.treasure_count !== undefined">
          <dt>Сокровища</dt>
          <dd>{{ card.treasure_count }}</dd>
        </div>
      </dl>
      <p v-if="card.rules_text">{{ card.rules_text }}</p>
      <p v-if="card.flavor_text" class="card-detail-sheet__flavor">{{ card.flavor_text }}</p>
    </article>
  </SheetDialog>
</template>

<style scoped>
.card-detail-sheet {
  display: grid;
  gap: .8rem;
  min-width: 0;
}

.card-detail-sheet__art {
  display: grid;
  place-items: center;
  min-height: 10rem;
  border: 1px dashed var(--color-line, #566044);
  color: var(--color-text-muted, #9eaa8e);
  text-align: center;
}

.card-detail-sheet__art img {
  display: block;
  width: 100%;
  max-height: 18rem;
  object-fit: contain;
}

.card-detail-sheet__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: .6rem;
  margin: 0;
}

.card-detail-sheet__facts > div {
  border: 1px solid var(--color-line, #566044);
  padding: .6rem;
}

.card-detail-sheet__facts dt {
  color: var(--color-text-muted, #9eaa8e);
  font-size: .75rem;
  text-transform: uppercase;
}

.card-detail-sheet__facts dd {
  margin: .2rem 0 0;
  color: var(--color-accent-strong);
}

.card-detail-sheet p {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.card-detail-sheet__flavor {
  color: var(--color-text-muted, #9eaa8e);
  font-style: italic;
}

</style>
