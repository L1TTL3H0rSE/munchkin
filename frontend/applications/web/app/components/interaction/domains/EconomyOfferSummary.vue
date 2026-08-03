<script setup lang="ts">
import type {
  InteractionView,
  Projection,
} from "@munchkin/contracts";

import {projectedPlayerName} from "../helperOfferModel";

defineProps<{
  projection: Projection;
  interaction: InteractionView;
}>();
</script>

<template>
  <section
    v-if="interaction.public_kind === 'economy_offer'"
    class="economy-offer-summary"
    aria-label="Предложение обмена или подарка"
  >
    <p class="economy-offer-summary__eyebrow">ПРЕДЛОЖЕНИЕ</p>
    <template v-if="interaction.economy_offer">
      <p>
        {{ interaction.economy_offer.kind === "trade" ? "Обмен" : "Подарок" }} от
        <strong>{{ projectedPlayerName(projection, interaction.economy_offer.offerer_player_id) }}</strong>
        игроку
        <strong>{{ projectedPlayerName(projection, interaction.economy_offer.recipient_player_id) }}</strong>
      </p>
      <div class="economy-offer-summary__columns">
        <div>
          <span>Передаётся</span>
          <ul>
            <li v-for="card in interaction.economy_offer.offered" :key="card.instance_id">
              {{ card.name }}
            </li>
          </ul>
        </div>
        <div>
          <span>{{ interaction.economy_offer.kind === "trade" ? "Запрошено" : "Оговорка" }}</span>
          <ul v-if="interaction.economy_offer.requested.length">
            <li v-for="card in interaction.economy_offer.requested" :key="card.instance_id">
              {{ card.name }}
            </li>
          </ul>
          <p v-else>Подарок без встречной передачи.</p>
        </div>
      </div>
    </template>
    <p v-else>
      Детали предложения доступны только участникам; названия чужих карт не раскрываются.
    </p>
  </section>
</template>

<style scoped>
.economy-offer-summary {
  display: grid;
  gap: .6rem;
  min-width: 0;
  border: 1px solid var(--color-line, #566044);
  padding: .8rem;
}

.economy-offer-summary p {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.45;
}

.economy-offer-summary__eyebrow {
  color: var(--color-accent-strong);
  font-size: .75rem;
  letter-spacing: .08em;
}

.economy-offer-summary__columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: .75rem;
}

.economy-offer-summary__columns > div {
  min-width: 0;
  border: 1px solid var(--color-line, #566044);
  padding: .6rem;
}

.economy-offer-summary__columns span {
  color: var(--color-text-muted, #9eaa8e);
  font-size: .75rem;
  text-transform: uppercase;
}

.economy-offer-summary__columns ul {
  display: grid;
  gap: .35rem;
  margin: .45rem 0 0;
  padding-left: 1.1rem;
}
</style>
