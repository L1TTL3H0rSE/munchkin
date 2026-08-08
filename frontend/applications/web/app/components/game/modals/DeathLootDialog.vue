<script setup lang="ts">
import type {InteractionView} from "@munchkin/contracts";

import {useInteractionCountdown} from "../../../composables/useInteractionCountdown";
import DeathLootSurface from "../../interaction/DeathLootSurface.vue";
import {isDeathLootInteraction} from "../../interaction/deathLootModel";
import type {InteractionActionView} from "../../interaction/interactionModel";
import SheetDialog from "../../ui/SheetDialog.vue";

const props = defineProps<{
  interaction: InteractionView;
  busy: boolean;
}>();

const emit = defineEmits<{
  submit: [action: InteractionActionView];
}>();
const interaction = computed(() => isDeathLootInteraction(props.interaction)
  ? props.interaction
  : undefined);
const countdown = useInteractionCountdown(
  () => interaction.value?.deadline_at,
  () => interaction.value?.server_time,
);
const timerText = computed(() => {
  const seconds = countdown.remainingSeconds.value;
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
});
</script>

<template>
  <SheetDialog
    v-if="interaction?.response_required_for_you"
    class="death-loot-dialog"
    :open="true"
    title="Добыча после смерти"
    aria-label="Добыча после смерти"
    hide-header
    :dismissible="false"
    desktop-width="768px"
    data-figma-owner="game-modal:death-loot"
    data-figma-desktop-node="295:2355"
    data-figma-compact-node="177:130"
  >
    <DeathLootSurface
      :interaction="interaction"
      :busy="busy"
      :timer-text="timerText"
      @submit="emit('submit', $event)"
    />
  </SheetDialog>
</template>

<style scoped lang="scss">
:deep(.death-loot-dialog) { --sheet-dialog-max-width: 768px; }
:deep(.death-loot-dialog .sheet-dialog__surface) { min-height: 470px; box-sizing: border-box; padding: 16px; overflow: hidden; }
@media (width < 1024px) {
  :deep(.death-loot-dialog) { --sheet-dialog-compact-max-width: 560px; }
  :deep(.death-loot-dialog .sheet-dialog__surface) { min-height: min(470px, calc(100dvh - 24px)); max-height: min(470px, calc(100dvh - 24px)); }
}
@media (width < 600px) {
  :deep(.death-loot-dialog) { --sheet-dialog-mobile-width: 100%; }
}
</style>
