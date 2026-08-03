<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";

import {
  acceptedCombatHelper,
  projectedPlayerName,
} from "../helperOfferModel";

const props = defineProps<{
  projection: Projection;
}>();

const helper = computed(() => acceptedCombatHelper(props.projection));
const helperName = computed(() => helper.value
  ? projectedPlayerName(props.projection, helper.value.helperPlayerID)
  : "");
</script>

<template>
  <section
    v-if="helper"
    class="combat-helper-summary"
    role="status"
    aria-label="Принятая помощь в бою"
  >
    <p class="combat-helper-summary__eyebrow">ПОМОЩЬ ПРИНЯТА СЕРВЕРОМ</p>
    <strong>{{ helperName }}</strong>
    <span>Награда помощника: {{ helper.rewardTreasures }} сокр.</span>
  </section>
</template>

<style scoped>
.combat-helper-summary {
  display: grid;
  gap: .25rem;
  min-width: 0;
  border: 1px solid var(--color-accent-strong, #c4f23a);
  padding: .7rem 1rem;
  text-align: center;
}

.combat-helper-summary > * {
  min-width: 0;
  overflow-wrap: anywhere;
}

.combat-helper-summary__eyebrow {
  margin: 0;
  color: var(--color-accent-strong, #c4f23a);
  font-size: .75rem;
  letter-spacing: .08em;
}

.combat-helper-summary span {
  color: var(--color-text);
}
</style>
