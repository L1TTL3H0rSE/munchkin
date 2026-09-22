import type {
  CardView,
  InteractionView,
  Projection,
} from "@munchkin/contracts";

import {projectedPlayerName} from "./helperOfferModel";

export type InteractionActionView = InteractionView["actions"][number];
export type AdvancedCombatCapability = NonNullable<
  InteractionActionView["combat_capability"]
>;
export type AdvancedCombatAction = InteractionActionView & {
  combat_capability: AdvancedCombatCapability;
};
export type CombatEffectView = NonNullable<
  NonNullable<Projection["turn"]["combat"]>["effects"][number]
>;

const capabilityLabels: Record<AdvancedCombatCapability, string> = {
  add_monster: "Добавить монстра",
  enhance_monster: "Усилить монстра",
  counter_combat_effect: "Контрдействие на эффект",
  force_combat_helper: "Принудительная помощь",
};

export function advancedCombatActions(
  actions: readonly InteractionActionView[],
): AdvancedCombatAction[] {
  return actions.filter((action): action is AdvancedCombatAction =>
    action.type === "respond" && action.combat_capability !== undefined,
  );
}

export function advancedCombatActionLabel(
  action: AdvancedCombatAction,
): string {
  return capabilityLabels[action.combat_capability];
}

export function combatMonsters(projection: Projection): CardView[] {
  const monsters = projection.turn.combat?.monsters ?? [];
  if (monsters.length > 0) {
    return monsters;
  }
  return projection.turn.encounter ? [projection.turn.encounter] : [];
}

export function combatEffects(projection: Projection): CombatEffectView[] {
  return projection.turn.combat?.effects ?? [];
}

export function combatMonsterName(
  projection: Projection,
  monsterInstanceID: string | undefined,
): string {
  if (!monsterInstanceID) {
    return "текущий бой";
  }
  return combatMonsters(projection).find((monster) =>
    monster.instance_id === monsterInstanceID,
  )?.name ?? "монстр из текущей проекции";
}

export function combatEffectLabel(
  projection: Projection,
  effectID: string | undefined,
): string {
  const effects = combatEffects(projection);
  const index = effects.findIndex((effect) => effect.effect_id === effectID);
  const effect = index >= 0 ? effects[index] : undefined;
  const kind = effect?.kind === "enhance_monster"
    ? "Усиление монстра"
    : "Эффект боя";
  return index >= 0 ? `${kind} ${index + 1}` : "Эффект текущего боя";
}

export function combatEffectTarget(
  projection: Projection,
  effect: CombatEffectView,
): string {
  return effect.target_monster_instance_id
    ? combatMonsterName(projection, effect.target_monster_instance_id)
    : "текущий бой";
}

export function advancedCombatActionDetails(
  action: AdvancedCombatAction,
  projection: Projection,
  ownCards: readonly CardView[],
): string[] {
  const details: string[] = [];
  if (action.source_instance_id) {
    const source = ownCards.find((card) =>
      card.instance_id === action.source_instance_id,
    );
    details.push(`Источник: ${source?.name ?? "карта текущего игрока"}`);
  }

  switch (action.combat_capability) {
    case "add_monster":
      details.push("Дополнительный монстр появится только после ответа сервера.");
      break;
    case "enhance_monster":
      details.push(`Цель: ${combatMonsterName(
        projection,
        action.target_monster_instance_id,
      )}`);
      details.push(`Изменение силы монстра: +${action.combat_delta ?? 0}`);
      break;
    case "counter_combat_effect":
      details.push(`Цель: ${combatEffectLabel(
        projection,
        action.target_effect_id,
      )}`);
      break;
    case "force_combat_helper":
      details.push(`Обязательный помощник: ${projectedPlayerName(
        projection,
        action.helper_player_id ?? "",
      )}`);
      details.push("Условия задаёт сервер; клиент не добавляет обещаний.");
      break;
  }
  return details;
}
