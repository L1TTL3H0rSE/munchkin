<script setup lang="ts">
import type {ActionDescriptor, CommandPayload, Projection} from "@munchkin/contracts";
import {
  actionLabel,
  buildCommandPayload,
  type ActionEntry,
} from "../../actionModel";
import SheetDialog from "../../ui/SheetDialog.vue";
import CardPresentation from "../primitives/CardPresentation.vue";
import type {EquipmentSlot, GameSheetRequest} from "../gameSheetModel";

const props = defineProps<{
  projection: Projection;
  request: Extract<GameSheetRequest, {kind: "hand" | "equip-slot"}>;
  busy: boolean;
}>();
const emit = defineEmits<{
  close: [];
  execute: [entry: ActionEntry, payload: CommandPayload];
  "open-action": [actionIndex: number];
}>();

const selectedCardID = ref<string | undefined>(props.request.cardID);
const handMode = ref(props.request.kind === "hand" ? props.request.mode : undefined);
const selectedTargetID = ref<string>();
const activeActionIndex = ref<number>();
const slotLabels: Record<EquipmentSlot, string> = {
  headgear: "Головняк",
  armor: "Броня",
  footgear: "Обувь",
  hands: "Руки",
};
const allOwnedCards = computed(() => [
  ...props.projection.you.hand,
  ...props.projection.you.carried,
  ...props.projection.you.equipped,
]);
const cards = computed(() => {
  const request = props.request;
  if (request.kind === "hand") {
    return props.projection.you.hand;
  }
  return allOwnedCards.value.filter((card) =>
    card.kind === "item" && card.item_slot === request.slot,
  );
});
const entries = computed<ActionEntry[]>(() =>
  props.projection.turn.available_actions.map((action, index) => ({action, index})),
);
const selectedCard = computed(() => cards.value.find((card) =>
  card.instance_id === selectedCardID.value,
));
const selectedActions = computed(() => entries.value.filter(({action}) =>
  action.source_instance_id === selectedCardID.value && (
    props.request.kind === "equip-slot"
      ? action.type === "equip_item"
      : handMode.value === "fast-equip"
        ? action.type === "equip_item"
      : [
        "play_card",
        "look_for_trouble",
        "play_target_effect",
        "discard_card",
        "use_ability",
      ].includes(action.type)
  ),
));
const activeAction = computed(() => selectedActions.value.find(({index}) =>
  index === activeActionIndex.value,
) ?? selectedActions.value[0]);
const contextualAction = computed(() => activeAction.value && actionNeedsTarget(activeAction.value.action)
  ? activeAction.value
  : undefined);
const targetIDs = computed(() => [
  ...(contextualAction.value?.action.target_player_ids ?? []),
  ...(contextualAction.value?.action.target_instance_ids ?? []),
]);
const currentItem = computed(() => {
  const request = props.request;
  return request.kind === "equip-slot"
    ? props.projection.you.equipped.find((card) => card.item_slot === request.slot)
    : undefined;
});
const currentUnequipEntry = computed(() => {
  const current = currentItem.value;
  return current
    ? entries.value.find(({action}) =>
      action.type === "unequip_item" && action.source_instance_id === current.instance_id,
    )
    : undefined;
});
const title = computed(() => props.request.kind === "hand"
  ? `Рука · ${props.projection.you.hand.length}`
  : "Выбор карты");
const description = computed(() => {
  const request = props.request;
  if (request.kind === "hand") {
    return selectedCard.value?.name ?? "Выбери карту из руки";
  }
  const current = currentItem.value;
  return `${slotLabels[request.slot]} · ${current?.name ?? "пусто"} ${current?.bonus ? `+${current.bonus}` : ""}`;
});

watch(cards, (nextCards) => {
  if (!nextCards.some((card) => card.instance_id === selectedCardID.value)) {
    selectedCardID.value = props.request.kind === "equip-slot" || handMode.value === "fast-equip"
      ? nextCards[0]?.instance_id
      : undefined;
  }
}, {immediate: true});

watch(selectedCardID, () => {
  selectedTargetID.value = undefined;
  activeActionIndex.value = selectedActions.value[0]?.index;
});

watch(selectedActions, (nextActions) => {
  if (!nextActions.some(({index}) => index === activeActionIndex.value)) {
    activeActionIndex.value = nextActions[0]?.index;
    selectedTargetID.value = undefined;
  }
}, {immediate: true});

function submit(entry: ActionEntry, target?: string): void {
  if (props.busy) {
    return;
  }
  if (entry.action.type === "use_ability") {
    emit("open-action", entry.index);
    return;
  }
  emit("execute", entry, buildCommandPayload(entry.action, [], target));
}

function handleAction(entry: ActionEntry): void {
  if (actionNeedsTarget(entry.action)) {
    if (activeActionIndex.value !== entry.index) {
      activeActionIndex.value = entry.index;
      selectedTargetID.value = undefined;
      return;
    }
    if (!selectedTargetID.value) return;
  }
  submit(entry, selectedTargetID.value);
}

function selectCard(cardID: string): void {
  selectedCardID.value = cardID;
  if (props.request.kind !== "hand") return;
  handMode.value = entries.value.some(({action}) =>
    action.type === "equip_item" && action.source_instance_id === cardID,
  ) ? "fast-equip" : "expanded";
}

function label(action: ActionDescriptor): string {
  if (action.type === "equip_item") return "Экипировать";
  if (action.type === "unequip_item") return "Снять";
  return actionLabel(action);
}

function targetLabel(targetID: string): string {
  return props.projection.players.find((player) => player.player_id === targetID)?.name
    ?? allOwnedCards.value.find((card) => card.instance_id === targetID)?.name
    ?? "Доступная цель";
}

function actionNeedsTarget(action: ActionDescriptor): boolean {
  return Boolean(action.target_player_ids?.length || action.target_instance_ids?.length);
}
</script>

<template>
  <SheetDialog
    class="game-choice-dialog"
    :class="{
      'game-choice-dialog--hand-expanded': request.kind === 'hand' && handMode === 'expanded',
      'game-choice-dialog--fast-equip': request.kind === 'hand' && handMode === 'fast-equip',
    }"
    :open="true"
    :title="title"
    :description="description"
    :data-figma-desktop-node="request.kind === 'hand' && handMode === 'expanded' ? '253:96' : '291:1587'"
    :data-figma-compact-node="request.kind === 'hand' ? (handMode === 'fast-equip' ? '342:3574' : '181:1634') : '340:3475'"
    @close="emit('close')"
  >
    <template #header-action>
      <button
        v-if="request.kind === 'equip-slot' && currentUnequipEntry"
        class="game-choice-sheet__header-action"
        type="button"
        :disabled="busy"
        @click="submit(currentUnequipEntry)"
      >
        {{ busy ? "Снимаем…" : "Снять" }}
      </button>
      <button
        v-else
        class="game-choice-sheet__header-action game-choice-sheet__header-action--close"
        type="button"
        @click="emit('close')"
      >
        Закрыть
      </button>
    </template>
    <div class="game-choice-sheet">
      <div class="game-choice-sheet__rail" role="listbox" :aria-label="title">
        <button
          v-for="card in cards"
          :key="card.instance_id"
          type="button"
          role="option"
          :aria-selected="card.instance_id === selectedCardID"
          :class="{'game-choice-sheet__card--selected': card.instance_id === selectedCardID}"
          @click="selectCard(card.instance_id)"
        >
          <CardPresentation :card="card" variant="choice" />
          <span v-if="card.instance_id === selectedCardID" class="game-choice-sheet__selected-label">
            ВЫБРАНО
          </span>
        </button>
        <p v-if="!cards.length">Для этого слота нет доступных предметов.</p>
      </div>
      <div v-if="contextualAction && targetIDs.length" class="game-choice-sheet__targets">
        <span>ВЫБЕРИ ЦЕЛЬ</span>
        <div>
          <button
            v-for="targetID in targetIDs"
            :key="targetID"
            type="button"
            :aria-pressed="selectedTargetID === targetID"
            @click="selectedTargetID = targetID"
          >
            {{ targetLabel(targetID) }}
          </button>
        </div>
      </div>
      <div v-if="selectedActions.length" class="game-choice-sheet__actions">
        <button
          v-for="entry in selectedActions"
          :key="`${entry.action.type}:${entry.action.source_instance_id}`"
          type="button"
          :disabled="busy || (actionNeedsTarget(entry.action) && activeActionIndex === entry.index && !selectedTargetID)"
          @click="handleAction(entry)"
        >
          {{ busy ? "Подтверждаем…" : label(entry.action) }}
        </button>
      </div>
    </div>
  </SheetDialog>
</template>

<style scoped lang="scss">
:deep(.game-choice-dialog) { width: min(768px, calc(100% - 24px)); }
:deep(.game-choice-dialog .sheet-dialog__surface) { min-height: 502px; box-sizing: border-box; }
.game-choice-sheet { min-width: 0; min-height: 390px; display: grid; grid-template-rows: minmax(0, 1fr) auto auto; gap: 16px; }
.game-choice-sheet__rail { min-width: 0; min-height: 234px; display: flex; align-items: start; gap: 12px; overflow-x: auto; padding: 8px; }
.game-choice-sheet__rail > button { position: relative; flex: 0 0 auto; border: 2px solid transparent; border-radius: 16px; padding: 0; background: transparent; cursor: pointer; }
.game-choice-sheet__rail > button.game-choice-sheet__card--selected { border-color: var(--color-accent-strong); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent-strong), transparent 82%); }
.game-choice-sheet__selected-label { position: absolute; right: 10px; bottom: 8px; color: var(--color-accent-strong); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.game-choice-sheet__rail p { margin: auto; color: var(--color-text-muted); }
.game-choice-sheet__actions { display: flex; justify-content: end; gap: 8px; }
.game-choice-sheet__actions button { min-width: 168px; min-height: 52px; border: 0; border-radius: 14px; padding: 0 16px; color: #fff9ef; background: var(--color-accent-strong); font: inherit; font-weight: 800; }
.game-choice-sheet__header-action { flex: 0 0 auto; min-width: 70px; min-height: 40px; border: 1px solid var(--color-status-warning, #765044); border-radius: 12px; padding: 0 12px; color: var(--color-status-warning, #765044); background: transparent; font: inherit; font-size: 14px; font-weight: 600; }
.game-choice-sheet__header-action--close { min-height: 44px; border-color: var(--color-line); color: var(--color-text-muted); font-size: 10px; font-weight: 500; }
.game-choice-sheet__targets { display: grid; gap: 8px; }
.game-choice-sheet__targets > span { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.game-choice-sheet__targets > div { display: flex; flex-wrap: wrap; gap: 8px; }
.game-choice-sheet__targets button { min-height: 36px; border: 1px solid var(--color-line); border-radius: 999px; padding: 0 12px; color: inherit; background: transparent; }
.game-choice-sheet__targets button[aria-pressed="true"] { border-color: var(--color-accent-strong); color: #fff9ef; background: var(--color-accent-strong); }

@media (width >= 1024px) {
  .game-choice-sheet__rail { justify-content: safe center; gap: 58px; }
}

@media (width < 1024px) {
  :deep(.game-choice-dialog) { width: min(560px, calc(100% - 24px)); max-height: min(470px, calc(100dvh - 24px)); }
  :deep(.game-choice-dialog .sheet-dialog__surface) { min-height: min(470px, calc(100dvh - 24px)); max-height: min(470px, calc(100dvh - 24px)); padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px)); }
  :deep(.game-choice-dialog--fast-equip) { max-height: min(410px, calc(100dvh - 24px)); }
  :deep(.game-choice-dialog--fast-equip .sheet-dialog__surface) { min-height: min(410px, calc(100dvh - 24px)); max-height: min(410px, calc(100dvh - 24px)); }
  .game-choice-sheet { min-height: 0; }
  .game-choice-sheet__rail { min-height: 218px; width: 100%; box-sizing: border-box; padding: 0; }
  .game-choice-sheet__actions { margin-top: auto; }
  .game-choice-sheet__actions button { width: 100%; }
  :deep(.game-choice-dialog--fast-equip) .game-choice-sheet__rail { height: 218px; min-height: 218px; align-items: flex-start; overflow-y: hidden; padding-top: 20px; }
  :deep(.game-choice-dialog--fast-equip) .game-choice-sheet__rail > button { margin-right: -59px; }
  :deep(.game-choice-dialog--fast-equip) .game-choice-sheet__rail > button.game-choice-sheet__card--selected { z-index: 2; transform: translateY(-20px); }
}

@media (width < 600px) {
  :deep(.game-choice-dialog) { width: 100%; }
}
</style>
