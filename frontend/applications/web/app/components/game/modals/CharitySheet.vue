<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import {useInteractionCountdown} from "../../../composables/useInteractionCountdown";
import type {
  EconomyAction,
  EconomySubmission,
} from "../../interaction/economyModel";
import SheetDialog from "../../ui/SheetDialog.vue";
import CardPresentation from "../primitives/CardPresentation.vue";

const props = defineProps<{
  projection: Projection;
  action?: EconomyAction;
  busy: boolean;
}>();
type CharitySubmission = Extract<EconomySubmission, {kind: "charity"}>;
const emit = defineEmits<{
  close: [];
  submit: [request: CharitySubmission];
}>();

const transfer = computed(() => props.projection.interaction?.charity_transfer);
const excess = computed(() => transfer.value?.excess ?? props.action?.minimum ?? 0);
const instanceIDs = computed(() => transfer.value?.instance_ids ?? props.action?.instance_ids ?? []);
const recipientIDs = computed(() =>
  transfer.value?.eligible_recipient_ids ?? props.action?.target_player_ids ?? [],
);
const cards = computed(() => {
  const allowed = new Set(instanceIDs.value);
  return props.projection.you.hand.filter((card) => allowed.has(card.instance_id));
});
const selectedIDs = ref<string[]>([]);
const assigningRecipients = ref(false);
const recipients = reactive<Record<string, string>>({});
const discardOnly = computed(() => recipientIDs.value.length === 0);
const selectionComplete = computed(() => selectedIDs.value.length === excess.value);
const assignmentComplete = computed(() => selectionComplete.value &&
  selectedIDs.value.every((instanceID) => recipients[instanceID]));
const complete = computed(() => selectionComplete.value &&
  (discardOnly.value || assignmentComplete.value));
const title = computed(() => discardOnly.value ? "Сброс карт" : "Благотворительность");
const description = computed(() => {
  if (assigningRecipients.value && !discardOnly.value) {
    return `Выбрано ${selectedIDs.value.length} карты · назначь получателя для каждой`;
  }
  const first = `Рука ${props.projection.you.hand.length} / ${props.projection.you.hand_limit} · выбери ровно ${excess.value} карты`;
  return discardOnly.value
    ? `${first}\nЛишние карты будут сброшены.`
    : `${first}\nЗатем назначишь получателя для каждой.`;
});
const countdown = useInteractionCountdown(
  () => props.projection.interaction?.deadline_at,
  () => props.projection.interaction?.server_time,
);
const timerText = computed(() => props.projection.interaction?.deadline_at
  ? `${Math.floor(countdown.remainingSeconds.value / 60).toString().padStart(2, "0")}:${(countdown.remainingSeconds.value % 60).toString().padStart(2, "0")}`
  : "");
const remaining = computed(() => Math.max(0, excess.value - selectedIDs.value.length));
const primaryLabel = computed(() => {
  if (props.busy) return "Подтверждаем…";
  if (!selectionComplete.value) {
    return remaining.value === 1 ? "Выбери ещё 1 карту" : `Выбери ещё ${remaining.value} карты`;
  }
  if (discardOnly.value) return "Сбросить карты";
  if (!assigningRecipients.value) return "Назначить получателей";
  return "Передать карты";
});
const primaryDisabled = computed(() => props.busy || (
  assigningRecipients.value && !discardOnly.value
    ? !assignmentComplete.value
    : !selectionComplete.value
));

watch(
  () => `${props.projection.version}:${instanceIDs.value.join("|")}`,
  () => {
    assigningRecipients.value = false;
    selectedIDs.value = selectedIDs.value.filter((id) => instanceIDs.value.includes(id));
    for (const key of Object.keys(recipients)) {
      if (!selectedIDs.value.includes(key)) {
        Reflect.deleteProperty(recipients, key);
      }
    }
  },
  {immediate: true},
);

function toggle(instanceID: string): void {
  if (props.busy || assigningRecipients.value) return;
  if (selectedIDs.value.includes(instanceID)) {
    selectedIDs.value = selectedIDs.value.filter((id) => id !== instanceID);
    Reflect.deleteProperty(recipients, instanceID);
    return;
  }
  if (selectedIDs.value.length >= excess.value) return;
  selectedIDs.value = [...selectedIDs.value, instanceID];
}

function playerName(playerID: string): string {
  return props.projection.players.find((player) =>
    player.player_id === playerID,
  )?.name ?? "Игрок";
}

function submit(): void {
  if (!complete.value || props.busy) return;
  emit("submit", {
    kind: "charity",
    ...(props.action ? {action: props.action} : {}),
    ...(props.projection.interaction?.interaction_id
      ? {interactionID: props.projection.interaction.interaction_id}
      : {}),
    allocations: selectedIDs.value.map((instanceID) => ({
      instance_id: instanceID,
      ...(discardOnly.value
        ? {}
        : {recipient_player_id: recipients[instanceID]}),
    })),
  });
}

function continueFlow(): void {
  if (primaryDisabled.value) return;
  if (!discardOnly.value && !assigningRecipients.value) {
    assigningRecipients.value = true;
    return;
  }
  submit();
}
</script>

<template>
  <SheetDialog
    class="charity-dialog"
    :open="true"
    :title="title"
    :description="description"
    :compact-description="description"
    :dismissible="false"
    data-figma-desktop-node="256:316"
    data-figma-compact-node="147:978"
    @close="emit('close')"
  >
    <template #header-action>
      <span v-if="timerText" class="charity-sheet__timer">{{ timerText }}</span>
    </template>

    <div class="charity-sheet">
      <div
        v-if="!assigningRecipients || discardOnly"
        class="charity-sheet__rail"
        aria-label="Карты для обязательного лимита руки"
      >
        <button
          v-for="card in cards"
          :key="card.instance_id"
          type="button"
          :aria-pressed="selectedIDs.includes(card.instance_id)"
          :class="{'charity-sheet__card--selected': selectedIDs.includes(card.instance_id)}"
          @click="toggle(card.instance_id)"
        >
          <CardPresentation :card="card" variant="choice" />
          <span v-if="selectedIDs.includes(card.instance_id)" class="charity-sheet__selected-label">
            ВЫБРАНО
          </span>
        </button>
      </div>

      <p v-if="!assigningRecipients || discardOnly" class="charity-sheet__progress">
        Выбрано {{ selectedIDs.length }} / {{ excess }} · листай ещё {{ Math.max(0, cards.length - selectedIDs.length) }} карт
      </p>

      <div v-else class="charity-sheet__recipients">
        <div v-for="instanceID in selectedIDs" :key="instanceID">
          <strong>{{ cards.find((card) => card.instance_id === instanceID)?.name }}</strong>
          <div>
            <button
              v-for="playerID in recipientIDs"
              :key="playerID"
              type="button"
              :aria-pressed="recipients[instanceID] === playerID"
              @click="recipients[instanceID] = playerID"
            >
              {{ playerName(playerID) }}
            </button>
          </div>
        </div>
      </div>

      <button
        class="charity-sheet__submit"
        type="button"
        :disabled="primaryDisabled"
        @click="continueFlow"
      >
        {{ primaryLabel }}
      </button>
    </div>
  </SheetDialog>
</template>

<style scoped lang="scss">
:deep(.charity-dialog) { width: min(768px, calc(100% - 24px)); }
:deep(.charity-dialog .sheet-dialog__surface) { min-height: 502px; box-sizing: border-box; }
:deep(.charity-dialog .sheet-dialog__header p) { white-space: pre-line; }
.charity-sheet { min-width: 0; display: grid; gap: 14px; }
.charity-sheet__rail { min-width: 0; min-height: 234px; display: flex; align-items: center; justify-content: safe center; gap: 58px; overflow-x: auto; padding: 6px; }
.charity-sheet__rail > button { position: relative; flex: 0 0 auto; border: 2px solid transparent; border-radius: 16px; padding: 0; background: transparent; cursor: pointer; }
.charity-sheet__rail > button.charity-sheet__card--selected { border-color: var(--color-accent-strong); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent-strong), transparent 82%); }
.charity-sheet__selected-label { position: absolute; right: 10px; bottom: 8px; color: var(--color-accent-strong); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.charity-sheet__progress { margin: 0; color: var(--color-text-muted); font-size: 11px; }
.charity-sheet__timer { min-width: 70px; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--color-status-warning, #765044); border-radius: 12px; color: var(--color-status-warning, #765044); font-size: 14px; font-weight: 700; }
.charity-sheet__recipients { min-height: 234px; display: grid; align-content: center; gap: 12px; overflow: auto; }
.charity-sheet__recipients > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid var(--color-line); border-radius: 14px; padding: 12px; }
.charity-sheet__recipients > div > div { display: flex; flex-wrap: wrap; justify-content: end; gap: 6px; }
.charity-sheet__recipients button { border: 1px solid var(--color-line); border-radius: 999px; padding: 7px 10px; color: inherit; background: transparent; }
.charity-sheet__recipients button[aria-pressed="true"] { color: #fff9ef; background: var(--color-accent-strong); }
.charity-sheet__submit { min-height: 52px; border: 0; border-radius: 14px; padding: 0 18px; color: #fff9ef; background: var(--color-accent-strong); font: inherit; font-weight: 800; }
.charity-sheet__submit:disabled { color: #9b8170; background: #abbfb8; }

@media (width < 1024px) {
  :deep(.charity-dialog) { width: min(560px, calc(100% - 24px)); max-height: min(470px, calc(100dvh - 24px)); }
  :deep(.charity-dialog .sheet-dialog__surface) { min-height: min(470px, calc(100dvh - 24px)); max-height: min(470px, calc(100dvh - 24px)); padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px)); }
  .charity-sheet__rail { width: 100%; min-height: 218px; justify-content: start; gap: 12px; box-sizing: border-box; padding: 0; }
  .charity-sheet__recipients { min-height: 218px; max-height: 218px; }
  .charity-sheet__recipients > div { align-items: start; flex-direction: column; }
  .charity-sheet__recipients > div > div { justify-content: start; }
  .charity-sheet__submit { width: 100%; margin-top: auto; }
}

@media (width < 600px) {
  :deep(.charity-dialog) { width: 100%; }
}
</style>
