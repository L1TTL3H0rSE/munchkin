<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";

import CardDetailSheet from "./CardDetailSheet.vue";
import SheetDialog from "./SheetDialog.vue";

defineProps<{
  projection: Projection;
}>();
</script>

<template>
  <SheetDialog
    title="Персонаж"
    trigger-label="Открыть персонажа"
    dialog-id="game-character-sheet"
  >
    <dl class="character-sheet__facts">
      <div>
        <dt>Имя</dt>
        <dd>{{ projection.you.name }}</dd>
      </div>
      <div>
        <dt>Уровень</dt>
        <dd>{{ projection.you.level }}</dd>
      </div>
      <div>
        <dt>Раса и класс</dt>
        <dd>{{ projection.you.character_tags.join(" · ") || "Не указаны" }}</dd>
      </div>
      <div>
        <dt>Статус</dt>
        <dd>{{ projection.you.dead ? "Погиб" : "В игре" }}</dd>
      </div>
    </dl>
    <section class="character-sheet__section" aria-labelledby="character-equipment-title">
      <h3 id="character-equipment-title">Снаряжение</h3>
      <ul>
        <li v-for="(card, index) in projection.you.equipped" :key="card.instance_id">
          <span>{{ card.name }}</span>
          <CardDetailSheet :card="card" :dialog-id="`game-equipped-card-sheet-${index}`" />
        </li>
        <li v-if="!projection.you.equipped.length">Слоты пока пусты.</li>
      </ul>
    </section>
    <section class="character-sheet__section" aria-labelledby="character-carried-title">
      <h3 id="character-carried-title">Переносимые карты</h3>
      <ul>
        <li v-for="(card, index) in projection.you.carried" :key="card.instance_id">
          <span>{{ card.name }}</span>
          <CardDetailSheet :card="card" :dialog-id="`game-carried-card-sheet-${index}`" />
        </li>
        <li v-if="!projection.you.carried.length">Переносимых карт нет.</li>
      </ul>
    </section>
  </SheetDialog>
</template>

<style scoped>
.character-sheet__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: .6rem;
  margin: 0;
}

.character-sheet__facts > div {
  border: 1px solid var(--color-line, #566044);
  padding: .6rem;
}

.character-sheet__facts dt {
  color: var(--color-text-muted, #9eaa8e);
  font-size: .75rem;
  text-transform: uppercase;
}

.character-sheet__facts dd {
  margin: .2rem 0 0;
  overflow-wrap: anywhere;
}

.character-sheet__section h3 {
  margin: 0 0 .5rem;
  font-size: 1rem;
}

.character-sheet__section ul {
  display: grid;
  gap: .45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.character-sheet__section li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .7rem;
  min-width: 0;
  border-bottom: 1px solid var(--color-line, #566044);
  padding: .45rem 0;
}

.character-sheet__section li span {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
