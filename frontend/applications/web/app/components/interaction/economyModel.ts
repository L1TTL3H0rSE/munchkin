import type {
  ActionDescriptor,
  CharityAllocation,
  CardView,
  InteractionView,
  Projection,
} from "@munchkin/contracts";

export type EconomyActionType =
  | "resolve_charity"
  | "propose_trade"
  | "propose_gift"
  | "attempt_theft";

export type EconomyAction = Omit<ActionDescriptor, "type"> & {
  type: EconomyActionType;
};

export type EconomySubmission =
  | {
      kind: "offer";
      offerKind: "trade" | "gift";
      action: EconomyAction;
      recipientPlayerID: string;
      offeredInstanceIDs: string[];
      requestedInstanceIDs: string[];
    }
  | {
      kind: "charity";
      action?: EconomyAction;
      interactionID?: string;
      allocations: CharityAllocation[];
    }
  | {
      kind: "theft";
      action: EconomyAction;
      victimPlayerID: string;
      costInstanceID: string;
    };

export type CharitySurfaceData = {
  excess: number;
  instanceIDs: string[];
  eligibleRecipientIDs: string[];
};

const economyActionTypes: ReadonlySet<ActionDescriptor["type"]> = new Set([
  "resolve_charity",
  "propose_trade",
  "propose_gift",
  "attempt_theft",
]);

export function isEconomyAction(action: ActionDescriptor): action is EconomyAction {
  return economyActionTypes.has(action.type);
}

export function economyActionKey(action: EconomyAction, index: number): string {
  return [
    action.type,
    action.source_instance_id ?? "",
    action.ability_index ?? "",
    index,
  ].join(":");
}

export function economyActions(
  actions: readonly ActionDescriptor[],
): Array<{action: EconomyAction; index: number}> {
  return actions.flatMap((action, index) =>
    isEconomyAction(action) ? [{action, index}] : [],
  );
}

export function ownCardByID(
  projection: Projection,
  instanceID: string,
): CardView | undefined {
  return [
    ...projection.you.hand,
    ...projection.you.carried,
    ...projection.you.equipped,
    ...projection.you.traits,
    ...projection.you.attachments,
    ...projection.you.persistent_curses,
  ].find((card) => card.instance_id === instanceID);
}

export function ownCarriedCardsFor(
  projection: Projection,
  action: EconomyAction,
): CardView[] {
  const allowed = new Set(action.instance_ids ?? []);
  return projection.you.carried.filter((card) => allowed.has(card.instance_id));
}

export function ownHandCardsFor(
  projection: Projection,
  action: EconomyAction,
): CardView[] {
  const allowed = new Set(action.instance_ids ?? []);
  return projection.you.hand.filter((card) => allowed.has(card.instance_id));
}

export function playerName(
  projection: Projection,
  playerID: string,
): string {
  if (projection.you.player_id === playerID) {
    return projection.you.name;
  }
  return projection.players.find((player) => player.player_id === playerID)?.name
    ?? "Игрок из текущей проекции";
}

export function charitySurfaceData(
  interaction: InteractionView | undefined,
  action: EconomyAction | undefined,
): CharitySurfaceData | undefined {
  if (interaction?.charity_transfer) {
    return {
      excess: interaction.charity_transfer.excess,
      instanceIDs: interaction.charity_transfer.instance_ids,
      eligibleRecipientIDs: interaction.charity_transfer.eligible_recipient_ids,
    };
  }
  if (action?.type !== "resolve_charity") {
    return undefined;
  }
  return {
    excess: action.minimum ?? 0,
    instanceIDs: action.instance_ids ?? [],
    eligibleRecipientIDs: action.target_player_ids ?? [],
  };
}

export function interactionHasCharityForm(
  interaction: InteractionView | undefined,
): boolean {
  return Boolean(interaction?.charity_transfer);
}

export function theftActionLabel(action: EconomyAction): string {
  return action.type === "attempt_theft" ? "Начать кражу" : "Действие экономики";
}

