<script setup lang="ts">
import type {CommandPayload, Projection} from "@munchkin/contracts";

import {buildCommandPayload, type ActionEntry} from "../../actionModel";
import {
  equipEntryFor,
  exactEquipCandidates,
  unequipEntryFor,
} from "../equipmentChoiceModel";
import type {GameSheetRequest} from "../gameSheetModel";
import CardPresentation from "../primitives/CardPresentation.vue";
import SheetDialog from "../../ui/SheetDialog.vue";

const props = defineProps<{
  projection: Projection;
  request: Extract<GameSheetRequest, {kind: "equip-slot"}>;
  busy: boolean;
}>();
const emit = defineEmits<{
  close: [];
  execute: [entry: ActionEntry, payload: CommandPayload];
}>();

const slotLabels = {
  headgear: "Головняк",
  armor: "Броня",
  footgear: "Обувь",
  hands: "Руки",
} as const;
const cards = computed(() => exactEquipCandidates(props.projection, props.request.slot));
const currentItem = computed(() => props.projection.you.equipped.find((card) =>
  card.item_slot === props.request.slot,
));
const selectedCardID = ref<string>();
const equipEntry = computed(() => equipEntryFor(props.projection, selectedCardID.value));
const unequipEntry = computed(() => unequipEntryFor(
  props.projection,
  currentItem.value?.instance_id,
));
const description = computed(() => {
  const current = currentItem.value;
  const suffix = current?.bonus ? ` +${current.bonus}` : "";
  return `${slotLabels[props.request.slot]} · ${current?.name ?? "пусто"}${suffix}`;
});

watch(cards, (next) => {
  const preferred = props.request.cardID;
  if (!next.some((card) => card.instance_id === selectedCardID.value)) {
    selectedCardID.value = next.find((card) => card.instance_id === preferred)?.instance_id
      ?? next[0]?.instance_id;
  }
}, {immediate: true});

function submit(entry: ActionEntry | undefined): void {
  if (!entry || props.busy) return;
  emit("execute", entry, buildCommandPayload(entry.action));
}
</script>

<template>
  <SheetDialog
    class="exact-equip-dialog"
    :open="true"
    title="Выбор карты"
    :description="description"
    desktop-width="768px"
    desktop-padding="24px"
    compact-gap="24px"
    data-figma-owner="game-modal:exact-equip"
    data-figma-desktop-node="291:1587"
    data-figma-compact-node="340:3475"
    @close="emit('close')"
  >
    <template #header-action>
      <button
        v-if="unequipEntry"
        class="exact-equip-sheet__remove"
        type="button"
        :disabled="busy"
        @click="submit(unequipEntry)"
      >
        {{ busy ? "Снимаем…" : "Снять" }}
      </button>
      <button v-else class="exact-equip-sheet__close" type="button" @click="emit('close')">
        Закрыть
      </button>
    </template>

    <div class="exact-equip-sheet">
      <div class="exact-equip-sheet__rail" role="listbox" aria-label="Подходящие предметы">
        <button
          v-for="card in cards"
          :key="card.instance_id"
          type="button"
          role="option"
          :aria-selected="card.instance_id === selectedCardID"
          :class="{'exact-equip-sheet__card--selected': card.instance_id === selectedCardID}"
          @click="selectedCardID = card.instance_id"
        >
          <CardPresentation :card="card" variant="choice" />
          <span v-if="card.instance_id === selectedCardID">ВЫБРАНО</span>
        </button>
        <p v-if="!cards.length">Для этого слота нет доступных предметов.</p>
      </div>
      <button
        class="exact-equip-sheet__submit"
        type="button"
        :disabled="busy || !equipEntry"
        @click="submit(equipEntry)"
      >
        {{ busy ? "Экипируем…" : "Экипировать" }}
      </button>
    </div>
  </SheetDialog>
</template>

<style scoped lang="scss">
:deep(.exact-equip-dialog) { --sheet-dialog-width: min(768px, calc(100% - 24px)); width: min(768px, calc(100% - 24px)); }
:deep(.exact-equip-dialog .sheet-dialog__surface) { min-height: 502px; box-sizing: border-box; }
.exact-equip-sheet { height: 100%; min-width: 0; min-height: 390px; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 16px; }
.exact-equip-sheet__rail { min-width: 0; display: flex; align-items: start; justify-content: safe center; gap: 58px; overflow-x: auto; padding: 8px; }
.exact-equip-sheet__rail > button { position: relative; flex: 0 0 auto; border: 2px solid transparent; border-radius: 16px; padding: 0; background: transparent; }
.exact-equip-sheet__rail > button.exact-equip-sheet__card--selected { border-color: var(--color-accent-strong); }
.exact-equip-sheet__rail span { position: absolute; right: 10px; bottom: 8px; color: var(--color-accent-strong); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.exact-equip-sheet__rail p { margin: auto; color: var(--color-text-muted); }
.exact-equip-sheet__submit { width: min(100%, 328px); min-height: 52px; justify-self: end; border: 0; border-radius: 14px; color: #fff9ef; background: var(--color-accent-strong); font: inherit; font-weight: 800; }
.exact-equip-sheet__submit:disabled { opacity: .45; }
.exact-equip-sheet__remove,
.exact-equip-sheet__close { min-width: 70px; min-height: 40px; border: 1px solid var(--color-status-warning); border-radius: 12px; padding: 0 12px; color: var(--color-status-warning); background: transparent; font: inherit; }
.exact-equip-sheet__close { border-color: var(--color-line); color: var(--color-text-muted); font-size: 10px; }

@media (width < 1024px) {
  :deep(.exact-equip-dialog) { width: min(560px, calc(100% - 24px)); max-height: min(470px, calc(100dvh - 24px)); }
  .exact-equip-sheet { height: auto; min-height: 0; grid-template-rows: 218px 52px; gap: 55px; }
  .exact-equip-sheet__rail { min-height: 218px; justify-content: start; gap: 12px; padding: 0; }
  .exact-equip-sheet__submit { width: 100%; }
  .exact-equip-sheet__remove,
  .exact-equip-sheet__close { width: 70px; min-width: 70px; min-height: 44px; margin-top: -10px; padding: 0; }
}
@media (width < 600px) { :deep(.exact-equip-dialog) { width: 100%; } }
</style>
