import type {CardView, Projection} from "@munchkin/contracts";

export type OwnZone =
  | "equipped"
  | "carried"
  | "traits"
  | "attachments"
  | "persistent_curses";

export type OwnZones = Record<OwnZone, CardView[]>;

type Opponent = Projection["players"][number];

export function uniqueCards(cards: readonly CardView[]): CardView[] {
  return [...new Map(cards.map((card) => [card.instance_id, card])).values()];
}

export function buildOwnZones(projection: Projection): OwnZones {
  return {
    equipped: uniqueCards(projection.you.equipped),
    carried: uniqueCards(projection.you.carried),
    traits: uniqueCards(projection.you.traits),
    attachments: uniqueCards(projection.you.attachments),
    persistent_curses: uniqueCards(projection.you.persistent_curses),
  };
}

export function ownCarriedCards(projection: Projection): CardView[] {
  const zones = buildOwnZones(projection);
  return uniqueCards([
    ...zones.carried,
    ...zones.traits,
    ...zones.attachments,
    ...zones.persistent_curses,
  ]);
}

export function publicCardsForOpponent(player: Opponent): CardView[] {
  return uniqueCards([
    ...player.carried,
    ...player.equipped,
    ...player.traits,
    ...player.attachments,
    ...player.persistent_curses,
  ]);
}

export function opponentDensity(
  opponentCount: number,
): "solo" | "small" | "full" {
  if (opponentCount <= 1) {
    return "solo";
  }
  if (opponentCount <= 3) {
    return "small";
  }
  return "full";
}

export function currentPlayerName(projection: Projection): string {
  return projection.players.find((player) =>
    player.player_id === projection.turn.player_id,
  )?.name ?? "другого игрока";
}
