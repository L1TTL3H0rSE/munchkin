import {
  computed,
  readonly,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

export interface CardSelectionOptions {
  projectionVersion: MaybeRefOrGetter<number>;
  availableCardIDs: MaybeRefOrGetter<readonly string[]>;
}

export interface CardSelectionOwner {
  selectedCardID: Readonly<Ref<string | null>>;
  hasSelection: Readonly<Ref<boolean>>;
  isSelected: (cardID: string) => boolean;
  selectCard: (cardID: string) => void;
  clearSelection: () => void;
}

export function reconcileCardSelection(
  selectedCardID: string | null,
  availableCardIDs: readonly string[],
): string | null {
  if (selectedCardID === null || !availableCardIDs.includes(selectedCardID)) {
    return null;
  }
  return selectedCardID;
}

export function useCardSelection(
  options: CardSelectionOptions,
): CardSelectionOwner {
  const selectedCardID = ref<string | null>(null);

  const clearSelection = () => {
    selectedCardID.value = null;
  };

  const selectCard = (cardID: string) => {
    const available = toValue(options.availableCardIDs);
    if (available.includes(cardID)) {
      selectedCardID.value = cardID;
    }
  };

  watch(
    () => toValue(options.projectionVersion),
    (version, previousVersion) => {
      if (previousVersion !== undefined && version !== previousVersion) {
        clearSelection();
      }
    },
  );

  watch(
    () => [...toValue(options.availableCardIDs)],
    (availableCardIDs) => {
      selectedCardID.value = reconcileCardSelection(
        selectedCardID.value,
        availableCardIDs,
      );
    },
    {immediate: true},
  );

  const hasSelection = computed(() => selectedCardID.value !== null);

  return {
    selectedCardID: readonly(selectedCardID),
    hasSelection: readonly(hasSelection),
    isSelected: (cardID) => selectedCardID.value === cardID,
    selectCard,
    clearSelection,
  };
}
