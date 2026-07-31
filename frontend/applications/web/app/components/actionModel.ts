import type {
  ActionDescriptor,
  CardView,
  CommandPayload,
} from "@munchkin/contracts";

export type ActionEntry = {
  action: ActionDescriptor;
  index: number;
};

export type CardActionMode = "direct" | "contextual";

export type CardActionState =
  | "idle"
  | "available"
  | "selected"
  | "pending"
  | "confirmed"
  | "disabled";

export type CardActionBinding = ActionEntry & {
  cardInstanceID: CardView["instance_id"];
  key: string;
  mode: CardActionMode;
};

export type CardActionMap = {
  byCard: Map<string, CardActionBinding[]>;
  cardBoundActionIndexes: Set<number>;
};

const selectionCommands = new Set([
  "sell_items",
  "use_ability",
  "resolve_charity",
]);

export function actionLabel(action: ActionDescriptor) {
  const labels: Record<ActionDescriptor["type"], string> = {
    start: "Начать игру",
    finish_setup: "Закончить подготовку",
    play_card: "Сыграть карту",
    equip_item: "Надеть предмет",
    unequip_item: "Снять предмет",
    discard_card: "Сбросить черту",
    sell_items: "Продать предметы",
    open_door: "Вышибить дверь",
    look_for_trouble: "Искать неприятности",
    loot_room: "Обыскать комнату",
    use_ability: "Использовать способность",
    resolve_combat: "Завершить бой",
    run_away: "Смыться",
    choose_effect: "Подтвердить выбор",
    resolve_charity: "Завершить благотворительность",
    end_turn: "Закончить ход",
    fight: "Завершить бой",
    loot: "Обыскать комнату",
  };
  return labels[action.type];
}

export function selectionIsValid(
  action: ActionDescriptor,
  selected: string[],
  target?: string,
) {
  const unique = new Set(selected);
  if (unique.size !== selected.length) {
    return false;
  }
  const options = action.instance_ids ?? [];
  if (selected.some((instanceID) => !options.includes(instanceID))) {
    return false;
  }
  const minimum = action.minimum ?? 0;
  const maximum = action.maximum ?? minimum;
  if (selected.length < minimum || selected.length > maximum) {
    return false;
  }
  if (action.minimum_total !== undefined) {
    const values = action.instance_values ?? {};
    let total = 0;
    for (const instanceID of selected) {
      const value = values[instanceID];
      if (value === undefined) {
        return false;
      }
      total += value;
    }
    if (total < action.minimum_total) {
      return false;
    }
  }
  const targetOptions = [
    ...(action.target_instance_ids ?? []),
    ...(action.target_player_ids ?? []),
  ];
  if (
    (targetOptions.length > 0 && (!target || !targetOptions.includes(target))) ||
    (targetOptions.length === 0 && target !== undefined)
  ) {
    return false;
  }
  return true;
}

export function reconcileActionState(
  actions: Array<ActionDescriptor | ActionEntry>,
  selections: Record<string, string[]>,
  targets: Record<string, string>,
) {
  const liveKeys = new Set<string>();
  actions.forEach((entry, index) => {
    const action = "action" in entry ? entry.action : entry;
    const actionIndex = "action" in entry ? entry.index : index;
    const key = actionKey(action, actionIndex);
    liveKeys.add(key);
    const options = new Set(action.instance_ids ?? []);
    if (selections[key]) {
      selections[key] = selections[key].filter((id) => options.has(id));
    }
    const target = targets[key];
    if (target && !(action.target_instance_ids ?? []).includes(target)) {
      Reflect.deleteProperty(targets, key);
    }
  });
  for (const key of Object.keys(selections)) {
    if (!liveKeys.has(key)) {
      Reflect.deleteProperty(selections, key);
    }
  }
  for (const key of Object.keys(targets)) {
    if (!liveKeys.has(key)) {
      Reflect.deleteProperty(targets, key);
    }
  }
}

export function buildCommandPayload(
  action: ActionDescriptor,
  selected: string[] = [],
  target?: string,
): CommandPayload {
  if (!selectionIsValid(action, selected, target)) {
    throw new Error("Недопустимый выбор для действия");
  }
  const payload: CommandPayload = {};
  if (action.source_instance_id) {
    payload.instance_id = action.source_instance_id;
  }
  if (target) {
    if (action.target_player_ids?.includes(target)) {
      payload.target_player_id = target;
    } else {
      payload.target_instance_id = target;
    }
  }
  if (action.type === "choose_effect") {
    payload.choice_ids = selected;
  } else if (selectionCommands.has(action.type)) {
    payload.instance_ids = selected;
  }
  if (action.ability_index !== undefined) {
    payload.ability_index = action.ability_index;
  }
  return payload;
}

export function actionKey(action: ActionDescriptor, index: number) {
  return [
    action.type,
    action.source_instance_id ?? "",
    action.ability_index ?? "",
    index,
  ].join(":");
}

export function actionNeedsContext(action: ActionDescriptor) {
  return Boolean(
    action.instance_ids?.length ||
    action.target_instance_ids?.length ||
    action.target_player_ids?.length ||
    action.requested_instance_ids?.length ||
    action.minimum !== undefined ||
    action.maximum !== undefined ||
    action.minimum_total !== undefined ||
    action.instance_values,
  );
}

export function actionMode(action: ActionDescriptor): CardActionMode {
  return action.source_instance_id && !actionNeedsContext(action)
    ? "direct"
    : "contextual";
}

export function mapCardActions(
  cards: CardView[],
  entries: ActionEntry[],
): CardActionMap {
  const cardIDs = new Set(cards.map((card) => card.instance_id));
  const byCard = new Map<string, CardActionBinding[]>();
  const cardBoundActionIndexes = new Set<number>();

  for (const entry of entries) {
    const actionCardIDs = new Set<string>();
    if (
      entry.action.source_instance_id &&
      cardIDs.has(entry.action.source_instance_id)
    ) {
      actionCardIDs.add(entry.action.source_instance_id);
    }
    for (const instanceID of entry.action.instance_ids ?? []) {
      if (cardIDs.has(instanceID)) {
        actionCardIDs.add(instanceID);
      }
    }
    if (actionCardIDs.size === 0) {
      continue;
    }

    cardBoundActionIndexes.add(entry.index);
    for (const cardInstanceID of actionCardIDs) {
      const bindings = byCard.get(cardInstanceID) ?? [];
      bindings.push({
        ...entry,
        cardInstanceID,
        key: actionKey(entry.action, entry.index),
        mode: actionMode(entry.action),
      });
      byCard.set(cardInstanceID, bindings);
    }
  }

  return {byCard, cardBoundActionIndexes};
}

export function cardActionState(
  bindings: CardActionBinding[],
  options: {
    busy: boolean;
    selected: boolean;
    pending: boolean;
    confirmed: boolean;
  },
): CardActionState {
  if (bindings.length === 0) {
    return "idle";
  }
  if (options.pending) {
    return "pending";
  }
  if (options.busy) {
    return "disabled";
  }
  if (options.confirmed) {
    return "confirmed";
  }
  if (options.selected) {
    return "selected";
  }
  return "available";
}
