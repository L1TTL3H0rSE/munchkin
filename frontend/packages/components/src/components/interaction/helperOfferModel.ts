import type {
  InteractionView,
  Projection,
} from "@munchkin/contracts";

export type InteractionActionView = InteractionView["actions"][number];

export interface HelperOfferOption {
  helperPlayerID: string;
  rewardTreasures: number[];
}

export interface AcceptedCombatHelper {
  helperPlayerID: string;
  rewardTreasures: number;
}

export function helperOfferActions(
  actions: readonly InteractionActionView[],
): InteractionActionView[] {
  return actions.filter((action) =>
    action.type === "offer_help" &&
    action.helper_player_id !== undefined &&
    action.reward_treasures !== undefined,
  );
}

export function helperOfferOptions(
  actions: readonly InteractionActionView[],
): HelperOfferOption[] {
  const options = new Map<string, Set<number>>();
  for (const action of helperOfferActions(actions)) {
    const helperPlayerID = action.helper_player_id;
    const rewardTreasures = action.reward_treasures;
    if (!helperPlayerID || rewardTreasures === undefined) {
      continue;
    }
    const rewards = options.get(helperPlayerID) ?? new Set<number>();
    rewards.add(rewardTreasures);
    options.set(helperPlayerID, rewards);
  }
  return [...options].map(([helperPlayerID, rewards]) => ({
    helperPlayerID,
    rewardTreasures: [...rewards].sort((left, right) => left - right),
  }));
}

export function helperRewardsFor(
  options: readonly HelperOfferOption[],
  helperPlayerID: string,
): number[] {
  return options.find((option) => option.helperPlayerID === helperPlayerID)
    ?.rewardTreasures ?? [];
}

export function helperOfferAction(
  actions: readonly InteractionActionView[],
  helperPlayerID: string,
  rewardTreasures: number,
): InteractionActionView | undefined {
  return helperOfferActions(actions).find((action) =>
    action.helper_player_id === helperPlayerID &&
    action.reward_treasures === rewardTreasures,
  );
}

export function helperCancelAction(
  interaction: InteractionView | undefined,
): InteractionActionView | undefined {
  return interaction?.actions.find((action) => action.type === "cancel_help");
}

export function isCombatantHelperOffer(
  interaction: InteractionView | undefined,
): boolean {
  return interaction?.public_kind === "combat_response" &&
    helperOfferActions(interaction.actions).length > 0;
}

export function isInvitedHelperOffer(
  interaction: InteractionView | undefined,
): boolean {
  return interaction?.public_kind === "combat_help_offer" &&
    interaction.combat_help_offer !== undefined;
}

export function projectedPlayerName(
  projection: Projection,
  playerID: string,
): string {
  if (projection.you.player_id === playerID) {
    return projection.you.name;
  }
  return projection.players.find((player) => player.player_id === playerID)
    ?.name ?? "Игрок из текущей проекции";
}

export function acceptedCombatHelper(
  projection: Projection,
): AcceptedCombatHelper | undefined {
  const combat = projection.turn.combat;
  if (
    !combat ||
    combat.helper_player_id === undefined ||
    combat.helper_reward_treasures === undefined
  ) {
    return undefined;
  }
  return {
    helperPlayerID: combat.helper_player_id,
    rewardTreasures: combat.helper_reward_treasures,
  };
}

export function formatAbsoluteDeadline(deadlineAt: string): string {
  const date = new Date(deadlineAt);
  if (Number.isNaN(date.getTime())) {
    return "Срок задан текущей проекцией сервера";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
