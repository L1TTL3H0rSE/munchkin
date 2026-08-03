import type {CardView, Projection} from "@munchkin/contracts";

export type StrengthContributor = {
  id: string;
  label: string;
  value: number;
};

type Opponent = Projection["players"][number];

export function uniqueCards(cards: readonly CardView[]): CardView[] {
  return [...new Map(cards.map((card) => [card.instance_id, card])).values()];
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

export function currentPlayerName(projection: Projection): string {
  return projection.players.find((player) =>
    player.player_id === projection.turn.player_id,
  )?.name ?? "другого игрока";
}

export function visibleCardsForProjection(projection: Projection): CardView[] {
  return uniqueCards([
    ...projection.you.hand,
    ...projection.you.carried,
    ...projection.you.equipped,
    ...projection.you.traits,
    ...projection.you.attachments,
    ...projection.you.persistent_curses,
    ...projection.turn.resolving,
    ...(projection.turn.encounter ? [projection.turn.encounter] : []),
    ...projection.players.flatMap((player) => publicCardsForOpponent(player)),
  ]);
}

export function buildStrengthBreakdown(
  authoritativeTotal: number,
  contributors: readonly StrengthContributor[],
): StrengthContributor[] {
  const visible = contributors.filter((contributor) =>
    Number.isFinite(contributor.value) && contributor.value !== 0,
  );
  const knownTotal = visible.reduce((total, contributor) => total + contributor.value, 0);
  const residual = authoritativeTotal - knownTotal;
  if (residual === 0) {
    return [...visible];
  }
  return [
    ...visible,
    {
      id: "other-effects",
      label: "Прочие эффекты",
      value: residual,
    },
  ];
}
