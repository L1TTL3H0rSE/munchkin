<script setup lang="ts">
import {computed, ref, watch} from "vue";
import type {CardView, CommandPayload, Projection} from "@munchkin/contracts";

import {buildCommandPayload, type ActionEntry} from "../../actionModel";
import {equipEntryFor} from "../equipmentChoiceModel";
import type {GameSheetRequest} from "../gameSheetModel";
import CardPresentation from "../primitives/CardPresentation.vue";
import SheetDialog from "../../ui/SheetDialog.vue";

const props = defineProps<{
  projection: Projection;
  request: Extract<GameSheetRequest, {kind: "hand"}>;
  busy: boolean;
}>();
const emit = defineEmits<{
  close: [];
  execute: [entry: ActionEntry, payload: CommandPayload];
}>();

const equippableIDs = computed(() => new Set(props.projection.turn.available_actions
  .filter((action) => action.type === "equip_item")
  .map((action) => action.source_instance_id)
  .filter((instanceID): instanceID is string => Boolean(instanceID))));
const selectedCardID = ref<string>();
const selectedCard = computed(() => props.projection.you.hand.find((card) =>
  card.instance_id === selectedCardID.value,
));
const orderedCards = computed(() => {
  const hand = props.projection.you.hand;
  const selectedIndex = hand.findIndex((card) => card.instance_id === selectedCardID.value);
  if (selectedIndex < 0 || hand.length < 2) return hand;
  const preferred = [
    hand[(selectedIndex - 1 + hand.length) % hand.length],
    hand[selectedIndex],
    hand[(selectedIndex + 1) % hand.length],
  ].filter((card): card is CardView => Boolean(card));
  const preferredIDs = new Set(preferred.map((card) => card.instance_id));
  return [...preferred, ...hand.filter((card) => !preferredIDs.has(card.instance_id))];
});
const equipEntry = computed(() => equipEntryFor(props.projection, selectedCardID.value));

watch([() => props.request.cardID, equippableIDs], ([preferred]) => {
  if (preferred && equippableIDs.value.has(preferred)) {
    selectedCardID.value = preferred;
    return;
  }
  if (!equippableIDs.value.has(selectedCardID.value ?? "")) {
    selectedCardID.value = props.projection.you.hand.find((card) =>
      equippableIDs.value.has(card.instance_id),
    )?.instance_id;
  }
}, {immediate: true});

function select(cardID: string): void {
  if (!equippableIDs.value.has(cardID)) return;
  selectedCardID.value = cardID;
}

function submit(): void {
  if (!equipEntry.value || props.busy) return;
  emit("execute", equipEntry.value, buildCommandPayload(equipEntry.value.action));
}
</script>

<template>
  <SheetDialog
    class="fast-equip-dialog"
    :open="true"
    :title="`Рука · ${projection.you.hand.length}`"
    :description="selectedCard?.name ?? 'Выбери предмет из руки'"
    desktop-width="768px"
    desktop-padding="24px"
    compact-height="410px"
    compact-gap="0px"
    :hide-compact-description="true"
    data-figma-owner="game-modal:fast-equip"
    data-figma-desktop-node="291:1587"
    data-figma-compact-node="342:3574"
    @close="emit('close')"
  >
    <template #header-action>
      <button class="fast-equip-sheet__close" type="button" @click="emit('close')">Закрыть</button>
    </template>

    <div class="fast-equip-sheet">
      <div class="fast-equip-sheet__rail" role="listbox" aria-label="Карты в руке">
        <button
          v-for="card in orderedCards"
          :key="card.instance_id"
          type="button"
          role="option"
          :disabled="!equippableIDs.has(card.instance_id)"
          :aria-selected="card.instance_id === selectedCardID"
          :class="{'fast-equip-sheet__card--selected': card.instance_id === selectedCardID}"
          @click="select(card.instance_id)"
        >
          <CardPresentation :card="card" variant="choice" />
          <span v-if="card.instance_id === selectedCardID">ВЫБРАНО</span>
        </button>
      </div>
      <button
        class="fast-equip-sheet__submit"
        type="button"
        :disabled="busy || !equipEntry"
        @click="submit"
      >
        {{ busy ? "Экипируем…" : "Экипировать" }}
      </button>
    </div>
  </SheetDialog>
</template>

<style scoped lang="scss">
:deep(.fast-equip-dialog) { --sheet-dialog-width: min(768px, calc(100% - 24px)); width: min(768px, calc(100% - 24px)); }
:deep(.fast-equip-dialog .sheet-dialog__surface) { min-height: 502px; box-sizing: border-box; }
.fast-equip-sheet { min-width: 0; min-height: 390px; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 16px; }
.fast-equip-sheet__rail { min-width: 0; display: flex; align-items: flex-start; justify-content: safe center; gap: 12px; overflow-x: auto; padding: 28px 8px 8px; }
.fast-equip-sheet__rail > button { position: relative; flex: 0 0 auto; border: 2px solid transparent; border-radius: 16px; padding: 0; background: transparent; transition: transform .16s ease; }
.fast-equip-sheet__rail > button:disabled { opacity: .58; }
.fast-equip-sheet__rail > button.fast-equip-sheet__card--selected { z-index: 2; border-color: var(--color-accent-strong); transform: translateY(-20px); opacity: 1; }
.fast-equip-sheet__rail span { position: absolute; right: 10px; bottom: 8px; color: var(--color-accent-strong); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.fast-equip-sheet__submit { width: min(100%, 328px); min-height: 52px; justify-self: end; border: 0; border-radius: 14px; color: #fff9ef; background: var(--color-accent-strong); font: inherit; font-weight: 800; }
.fast-equip-sheet__submit:disabled { opacity: .45; }
.fast-equip-sheet__close { min-width: 70px; min-height: 40px; border: 1px solid var(--color-line); border-radius: 12px; color: var(--color-text-muted); background: transparent; font: inherit; font-size: 10px; }

@media (width < 1024px) {
  .fast-equip-sheet { height: 100%; min-height: 0; }
  .fast-equip-sheet__rail { height: 218px; min-height: 218px; justify-content: start; overflow-y: hidden; margin-top: -8px; padding: 20px 0 0; }
  .fast-equip-sheet__rail > button { margin-right: -59px; }
  .fast-equip-sheet__submit { width: 100%; }
  .fast-equip-sheet__close { width: 70px; min-width: 70px; min-height: 44px; margin-top: -10px; padding: 0; }
}
@media (width < 600px) { :deep(.fast-equip-dialog) { width: 100%; } }
</style>
