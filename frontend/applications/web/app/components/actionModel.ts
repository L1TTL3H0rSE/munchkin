import type {ActionDescriptor, CommandPayload} from "@munchkin/contracts";

export type ActionEntry = {
  action: ActionDescriptor;
  index: number;
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
    play_target_effect: "Применить эффект к цели",
    equip_item: "Надеть предмет",
    unequip_item: "Снять предмет",
    discard_card: "Сбросить черту",
    sell_items: "Продать предметы",
    open_door: "Вышибить дверь",
    look_for_trouble: "Искать неприятности",
    loot_room: "Обыскать комнату",
    use_ability: "Использовать способность",
    request_combat_resolution: "Завершить бой",
    resolve_combat: "Завершить бой",
    run_away: "Смыться",
    choose_effect: "Подтвердить выбор",
    resolve_charity: "Завершить благотворительность",
    propose_trade: "Предложить обмен",
    propose_gift: "Предложить подарок",
    attempt_theft: "Начать кражу",
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
