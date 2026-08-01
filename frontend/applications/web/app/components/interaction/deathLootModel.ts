import type {
  CardView,
  InteractionView,
  Projection,
} from "@munchkin/contracts";

import type {InteractionActionView} from "./interactionModel";

export type DeathLootInteraction = InteractionView & {
  death_loot: NonNullable<InteractionView["death_loot"]>;
};

export interface DeathLootOption {
  card: CardView;
  action: InteractionActionView;
}

export interface DeathLootParticipant {
  playerID: string;
  name: string;
}

export function isDeathLootInteraction(
  interaction: InteractionView | undefined,
): interaction is DeathLootInteraction {
  return interaction?.public_kind === "death_loot_priority" &&
    interaction.death_loot !== undefined;
}

export function deathLootOptions(
  interaction: InteractionView | undefined,
): DeathLootOption[] {
  if (!isDeathLootInteraction(interaction)) {
    return [];
  }
  if (!interaction.response_required_for_you) {
    return [];
  }

  const pickActions = interaction.actions.filter((action) =>
    action.type === "respond" && (action.choice_ids?.length ?? 0) > 0,
  );
  const usedActionIDs = new Set<string>();

  return interaction.death_loot.options.flatMap((card) => {
    const action = pickActions.find((candidate) =>
      !usedActionIDs.has(candidate.action_id) &&
      candidate.choice_ids?.includes(card.instance_id),
    );
    if (!action) {
      return [];
    }
    usedActionIDs.add(action.action_id);
    return [{card, action}];
  });
}

export function deathLootPassAction(
  interaction: InteractionView | undefined,
): InteractionActionView | undefined {
  if (!isDeathLootInteraction(interaction)) {
    return undefined;
  }
  return interaction.actions.find((action) => action.type === "pass");
}

export function deathLootParticipants(
  projection: Projection,
  interaction: DeathLootInteraction,
): DeathLootParticipant[] {
  const players = [
    {
      playerID: projection.you.player_id,
      name: projection.you.name,
      dead: projection.you.dead,
    },
    ...projection.players.map((player) => ({
      playerID: player.player_id,
      name: player.name,
      dead: player.dead,
    })),
  ];

  const seen = new Set<string>();
  return players
    .filter((player) => !player.dead &&
      player.playerID !== interaction.death_loot.dead_player_id)
    .filter((player) => {
      if (seen.has(player.playerID)) {
        return false;
      }
      seen.add(player.playerID);
      return true;
    })
    .map(({playerID, name}) => ({playerID, name}));
}

export function deathLootTerminalMessage(
  interaction: DeathLootInteraction,
): string {
  const loot = interaction.death_loot;
  if (loot.remaining_count > 0) {
    return "";
  }
  if (loot.initial_count > 0 && loot.picked_count === 0) {
    return "Все доступные участники пропустили выбор; остаток отправлен в публичную зону.";
  }
  return "Пул добычи исчерпан; подтверждённый результат уже находится в projection.";
}
