<script setup lang="ts">
import type {CardView, CommandPayload, Projection} from "@munchkin/contracts";
import {
  actionLabel,
  buildCommandPayload,
  selectionIsValid,
  type ActionEntry,
} from "../../actionModel";
import {
  isEconomyAction,
  type EconomySubmission,
} from "../../interaction/economyModel";
import SheetDialog from "../../ui/SheetDialog.vue";
import type {GameSheetRequest} from "../gameSheetModel";
import CardPresentation from "../primitives/CardPresentation.vue";

const props = defineProps<{
  projection: Projection;
  request: Extract<GameSheetRequest, {kind: "actions"}>;
  busy: boolean;
}>();
const emit = defineEmits<{
  close: [];
  execute: [entry: ActionEntry, payload: CommandPayload];
  "submit-economy": [request: EconomySubmission];
}>();

const supportedTypes = new Set([
  "use_ability",
  "discard_card",
  "sell_items",
  "propose_trade",
  "propose_gift",
  "attempt_theft",
]);
const entries = computed<ActionEntry[]>(() => props.projection.turn.available_actions
  .map((action, index) => ({action, index}))
  .filter(({action}) => supportedTypes.has(action.type)));
const selectedActionIndex = ref<number>();
const selectedIDs = ref<string[]>([]);
const requestedIDs = ref<string[]>([]);
const selectedTargetID = ref<string>();
const tradeStep = ref<"offered" | "requested">("offered");

const entry = computed(() => entries.value.find(({index}) =>
  index === selectedActionIndex.value,
));
const action = computed(() => entry.value?.action);
const ownCards = computed(() => [
  ...props.projection.you.hand,
  ...props.projection.you.carried,
  ...props.projection.you.equipped,
  ...props.projection.you.traits,
  ...props.projection.you.attachments,
  ...props.projection.you.persistent_curses,
]);
const ownCardsByID = computed(() => new Map(ownCards.value.map((card) => [
  card.instance_id,
  card,
])));
const sourceCard = computed(() => action.value?.source_instance_id
  ? ownCardsByID.value.get(action.value.source_instance_id)
  : undefined);
const selectionCards = computed(() => (action.value?.instance_ids ?? [])
  .map((instanceID) => ownCardsByID.value.get(instanceID))
  .filter((card): card is CardView => Boolean(card)));
const targetIDs = computed(() => action.value?.target_player_ids ?? []);
const targetPlayer = computed(() => props.projection.players.find((player) =>
  player.player_id === selectedTargetID.value,
));
const requestedCards = computed(() => {
  const allowed = new Set(action.value?.requested_instance_ids ?? []);
  return (targetPlayer.value?.carried ?? []).filter((card) => allowed.has(card.instance_id));
});
const selectedValue = computed(() => selectedIDs.value.reduce((total, instanceID) =>
  total + (action.value?.instance_values?.[instanceID] ?? 0),
0));
const isTrade = computed(() => action.value?.type === "propose_trade");
const isDirectDiscard = computed(() => action.value?.type === "discard_card");
const selectionComplete = computed(() => {
  const current = action.value;
  if (!current) return false;
  if (isDirectDiscard.value) return selectionIsValid(current, []);
  return selectionIsValid(current, selectedIDs.value, selectedTargetID.value);
});
const requestComplete = computed(() => !isTrade.value || (
  requestedIDs.value.length >= 1 &&
  requestedIDs.value.every((instanceID) =>
    action.value?.requested_instance_ids?.includes(instanceID),
  ) &&
  new Set(requestedIDs.value).size === requestedIDs.value.length
));
const selectionDescriptorsComplete = computed(() =>
  selectionCards.value.length === (action.value?.instance_ids?.length ?? 0),
);
const requestedDescriptorsComplete = computed(() =>
  requestedCards.value.length === (action.value?.requested_instance_ids?.length ?? 0),
);
const canSubmit = computed(() => !props.busy && selectionComplete.value &&
  requestComplete.value && selectionDescriptorsComplete.value &&
  (!isTrade.value || requestedDescriptorsComplete.value));

const title = computed(() => {
  const current = action.value;
  if (!current) return "Действия";
  const targetName = selectedTargetID.value
    ? playerName(selectedTargetID.value)
    : "игроком";
  if (current.type === "use_ability") return `Способность: ${sourceCard.value?.name ?? "карта"}`;
  if (current.type === "discard_card") return "Сбросить черту";
  if (current.type === "sell_items") return "Продажа вещей";
  if (current.type === "propose_gift") return `Подарок для ${targetName}`;
  if (current.type === "propose_trade") return `Обмен с ${targetName}`;
  if (current.type === "attempt_theft") return `Кража у ${targetName}`;
  return actionLabel(current);
});
const description = computed(() => {
  const current = action.value;
  if (!current) return "Сейчас нет дополнительных действий.";
  if (current.type === "use_ability") {
    return `Выбери ровно ${current.minimum ?? 0} карты из руки для способности.`;
  }
  if (current.type === "discard_card") return `Источник: ${sourceCard.value?.name ?? "доступная карта"}`;
  if (current.type === "sell_items") {
    return `Выбрано на ${selectedValue.value} / ${current.minimum_total ?? 0} голдов.`;
  }
  if (current.type === "propose_trade") {
    return tradeStep.value === "offered"
      ? "Сначала выбери вещи, которые отдашь."
      : "Теперь выбери вещи, которые попросишь взамен.";
  }
  if (current.type === "propose_gift") return "Выбери вещи, которые передашь игроку.";
  if (current.type === "attempt_theft") return "Выбери одну карту из руки как стоимость попытки.";
  return "Выбери только разрешённые сервером карты.";
});
const visibleCards = computed(() => isTrade.value && tradeStep.value === "requested"
  ? requestedCards.value
  : selectionCards.value);
const visibleSelection = computed(() => isTrade.value && tradeStep.value === "requested"
  ? requestedIDs.value
  : selectedIDs.value);
const primaryLabel = computed(() => {
  if (props.busy) return "Подтверждаем…";
  if (isTrade.value && tradeStep.value === "offered") return "Выбрать встречные карты";
  return action.value ? actionLabel(action.value) : "Закрыть";
});
const primaryDisabled = computed(() => {
  if (isTrade.value && tradeStep.value === "offered") {
    return props.busy || !selectionComplete.value || !selectionDescriptorsComplete.value;
  }
  return !canSubmit.value;
});

watch(
  () => `${props.projection.version}:${props.request.actionIndex ?? ""}:${entries.value.map(({index}) => index).join("|")}`,
  () => {
    const requested = props.request.actionIndex;
    selectedActionIndex.value = entries.value.some(({index}) => index === requested)
      ? requested
      : entries.value[0]?.index;
  },
  {immediate: true},
);

watch(
  () => selectedActionIndex.value,
  () => {
    selectedIDs.value = [];
    requestedIDs.value = [];
    selectedTargetID.value = action.value?.target_player_ids?.[0];
    tradeStep.value = "offered";
  },
  {immediate: true},
);

function playerName(playerID: string): string {
  return props.projection.players.find((player) => player.player_id === playerID)?.name
    ?? "Игрок";
}

function entryLabel(candidate: ActionEntry): string {
  const source = candidate.action.source_instance_id
    ? ownCardsByID.value.get(candidate.action.source_instance_id)?.name
    : undefined;
  const target = candidate.action.target_player_ids?.[0];
  const base = actionLabel(candidate.action);
  if (target) return `${base} · ${playerName(target)}`;
  if (source) return `${base} · ${source}`;
  return base;
}

function toggleCard(instanceID: string): void {
  if (props.busy) return;
  const current = action.value;
  if (!current) return;
  const requested = isTrade.value && tradeStep.value === "requested";
  const selected = requested ? requestedIDs : selectedIDs;
  if (selected.value.includes(instanceID)) {
    selected.value = selected.value.filter((id) => id !== instanceID);
    return;
  }
  const maximum = requested
    ? (current.requested_instance_ids?.length ?? 0)
    : (current.maximum ?? current.minimum ?? 0);
  if (selected.value.length >= maximum) return;
  selected.value = [...selected.value, instanceID];
}

function continueOrSubmit(): void {
  const currentEntry = entry.value;
  if (!currentEntry || primaryDisabled.value) return;
  if (isTrade.value && tradeStep.value === "offered") {
    tradeStep.value = "requested";
    return;
  }
  const current = currentEntry.action;
  if (isEconomyAction(current)) {
    if (current.type === "attempt_theft") {
      emit("submit-economy", {
        kind: "theft",
        action: current,
        victimPlayerID: selectedTargetID.value ?? "",
        costInstanceID: selectedIDs.value[0] ?? "",
      });
      return;
    }
    if (current.type === "propose_gift" || current.type === "propose_trade") {
      emit("submit-economy", {
        kind: "offer",
        offerKind: current.type === "propose_trade" ? "trade" : "gift",
        action: current,
        recipientPlayerID: selectedTargetID.value ?? "",
        offeredInstanceIDs: [...selectedIDs.value],
        requestedInstanceIDs: current.type === "propose_trade" ? [...requestedIDs.value] : [],
      });
      return;
    }
  }
  emit("execute", currentEntry, buildCommandPayload(
    current,
    isDirectDiscard.value ? [] : selectedIDs.value,
    selectedTargetID.value,
  ));
}
</script>

<template>
  <SheetDialog
    class="turn-action-dialog"
    :open="true"
    :title="title"
    :description="description"
    :compact-title="title"
    :compact-description="description"
    data-figma-desktop-node="291:1587"
    data-figma-compact-node="174:1735"
    @close="emit('close')"
  >
    <div class="turn-action-sheet">
      <div v-if="entries.length > 1" class="turn-action-sheet__tabs" role="tablist" aria-label="Доступные действия">
        <button
          v-for="candidate in entries"
          :key="candidate.index"
          type="button"
          role="tab"
          :aria-selected="candidate.index === selectedActionIndex"
          @click="selectedActionIndex = candidate.index"
        >
          {{ entryLabel(candidate) }}
        </button>
      </div>

      <div v-if="targetIDs.length > 1" class="turn-action-sheet__targets">
        <span>ЦЕЛЬ</span>
        <button
          v-for="targetID in targetIDs"
          :key="targetID"
          type="button"
          :aria-pressed="selectedTargetID === targetID"
          @click="selectedTargetID = targetID"
        >
          {{ playerName(targetID) }}
        </button>
      </div>

      <div v-if="sourceCard" class="turn-action-sheet__source">
        <span>ИСТОЧНИК</span>
        <strong>{{ sourceCard.name }}</strong>
      </div>

      <div v-if="visibleCards.length" class="turn-action-sheet__rail" role="listbox" :aria-label="description">
        <button
          v-for="card in visibleCards"
          :key="card.instance_id"
          type="button"
          role="option"
          :aria-selected="visibleSelection.includes(card.instance_id)"
          @click="toggleCard(card.instance_id)"
        >
          <CardPresentation :card="card" variant="choice" />
          <span v-if="visibleSelection.includes(card.instance_id)">ВЫБРАНО</span>
        </button>
      </div>
      <p v-else-if="action && !isDirectDiscard" class="turn-action-sheet__protocol-error" role="alert">
        Сервер не передал видимые карточки для этого действия.
      </p>

      <button
        v-if="action"
        class="turn-action-sheet__submit"
        type="button"
        :disabled="primaryDisabled"
        @click="continueOrSubmit"
      >
        {{ primaryLabel }}
      </button>
    </div>
  </SheetDialog>
</template>

<style scoped lang="scss">
:deep(.turn-action-dialog) { width: min(768px, calc(100% - 24px)); }
:deep(.turn-action-dialog .sheet-dialog__surface) { min-height: 502px; box-sizing: border-box; }
.turn-action-sheet { min-width: 0; display: grid; align-content: start; gap: 12px; }
.turn-action-sheet__tabs { min-width: 0; display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
.turn-action-sheet__tabs button,
.turn-action-sheet__targets button { flex: 0 0 auto; min-height: 36px; border: 1px solid var(--color-line); border-radius: 999px; padding: 0 12px; color: inherit; background: transparent; font: inherit; font-size: 10px; }
.turn-action-sheet__tabs button[aria-selected="true"],
.turn-action-sheet__targets button[aria-pressed="true"] { border-color: var(--color-accent-strong); color: #fff9ef; background: var(--color-accent-strong); }
.turn-action-sheet__targets { display: flex; align-items: center; gap: 8px; overflow-x: auto; }
.turn-action-sheet__targets > span,
.turn-action-sheet__source > span { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.turn-action-sheet__source { min-height: 36px; display: flex; align-items: center; gap: 10px; border-radius: 12px; padding: 0 12px; background: var(--color-surface-control); }
.turn-action-sheet__source strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.turn-action-sheet__rail { min-width: 0; min-height: 218px; display: flex; align-items: center; justify-content: safe center; gap: 58px; overflow-x: auto; padding: 4px; }
.turn-action-sheet__rail > button { position: relative; flex: 0 0 auto; border: 2px solid transparent; border-radius: 16px; padding: 0; background: transparent; }
.turn-action-sheet__rail > button[aria-selected="true"] { border-color: var(--color-accent-strong); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent-strong), transparent 82%); }
.turn-action-sheet__rail > button > span { position: absolute; right: 10px; bottom: 8px; color: var(--color-accent-strong); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.turn-action-sheet__submit { min-height: 52px; border: 0; border-radius: 14px; padding: 0 18px; color: #fff9ef; background: var(--color-accent-strong); font: inherit; font-weight: 800; }
.turn-action-sheet__submit:disabled { color: #9b8170; background: #abbfb8; }
.turn-action-sheet__protocol-error { min-height: 218px; display: grid; place-items: center; margin: 0; color: var(--color-danger); text-align: center; }

@media (width < 1024px) {
  :deep(.turn-action-dialog) { width: min(560px, calc(100% - 24px)); max-height: min(470px, calc(100dvh - 24px)); }
  :deep(.turn-action-dialog .sheet-dialog__surface) { min-height: min(470px, calc(100dvh - 24px)); max-height: min(470px, calc(100dvh - 24px)); padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px)); }
  .turn-action-sheet__rail { justify-content: start; gap: 12px; padding: 0; }
  .turn-action-sheet__submit { width: 100%; margin-top: auto; }
}

@media (width < 600px) {
  :deep(.turn-action-dialog) { width: 100%; }
}
</style>
