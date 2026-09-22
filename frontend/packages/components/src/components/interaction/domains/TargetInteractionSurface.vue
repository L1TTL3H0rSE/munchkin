<script setup lang="ts">
import {computed} from "vue";
import type {InteractionView, Projection} from "@munchkin/contracts";

import {
  isTargetInteraction,
  targetPlayerName,
} from "../targetRunAwayModel";

const props = defineProps<{
  projection: Projection;
  interaction: InteractionView;
}>();

const target = computed(() => isTargetInteraction(props.interaction)
  ? props.interaction
  : undefined);
</script>

<template>
  <section
    v-if="target"
    class="target-interaction-surface interaction-domain-summary"
    aria-label="Цель взаимодействия"
  >
    <p class="target-interaction-surface__eyebrow">ЦЕЛЕВОЙ ЭФФЕКТ</p>
    <p v-if="target.target_player_id">
      Цель:
      <strong>{{ targetPlayerName(projection, target.target_player_id) }}</strong>
    </p>
    <p v-if="target.public_kind === 'private_choice'">
      Варианты выбора доступны только текущему игроку.
    </p>
    <p v-else>
      Окно ответа остаётся закрытым; варианты других игроков не раскрываются.
    </p>
  </section>
</template>

<style scoped>
.target-interaction-surface {
  display: grid;
  gap: .35rem;
  min-width: 0;
  border: 1px solid var(--color-line, #566044);
  padding: .8rem;
  overflow-wrap: anywhere;
  line-height: 1.45;
}

.target-interaction-surface p { margin: 0; }

.target-interaction-surface__eyebrow {
  color: var(--color-accent-strong);
  font-size: .75rem;
  letter-spacing: .08em;
}
</style>
