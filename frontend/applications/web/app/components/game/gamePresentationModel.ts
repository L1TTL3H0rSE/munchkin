import type {ActionDescriptor, CardView, Projection} from "@munchkin/contracts";

function uniqueCards(cards: readonly CardView[]): CardView[] {
  return [...new Map(cards.map((card) => [card.instance_id, card])).values()];
}

export type GameStateFamily =
  | "lobby"
  | "setup"
  | "preparation"
  | "door-choice"
  | "combat"
  | "run-away"
  | "resolve-effect"
  | "charity"
  | "end-turn"
  | "waiting"
  | "finished";

export type PrimarySurface =
  | {kind: "finished"}
  | {kind: "required-decision"; optionCount: number}
  | {kind: "run-away"; completed: false}
  | {kind: "result"; source: "reward"; levels: number; treasures: number}
  | {
    kind: "result";
    source: "run-away";
    escaped: boolean;
    roll: number;
    modifier: number;
    total: number;
    monsterName: string;
  }
  | {kind: "combat"}
  | {kind: "door-choice"}
  | {kind: "resolving"; cardCount: number}
  | {kind: "phase"; family: GameStateFamily}
  | {kind: "waiting"};

export type OpponentStatus = "active" | "waiting" | "dead" | "ready";

export type GamePresentationModel = {
  family: GameStateFamily;
  primary: PrimarySurface;
  desktopNodeID: string;
  mobileNodeID: string;
  phaseLabel: string;
  turnHeadline: string;
  currentPlayerName: string;
  isActorTurn: boolean;
  turnActions: ActionDescriptor[];
  encounterCards: CardView[];
  activeEncounterIndex: number;
  encounterPage: number;
  encounterPageCount: number;
};

export function projectedTurnActions(projection: Projection): ActionDescriptor[] {
  const actions = [...projection.turn.available_actions];
  const resolution = projection.turn.combat?.resolution_action;
  if (resolution && !actions.some((action) => action.type === resolution.type)) {
    actions.push({type: resolution.type});
  }
  return actions;
}

function phaseLabel(primary: PrimarySurface, family: GameStateFamily): string {
  if (primary.kind === "finished") return "ИТОГ";
  if (primary.kind === "result") return primary.source === "reward" ? "ИТОГ" : "ПОБЕГ";
  if (primary.kind === "run-away") return "ПОБЕГ";
  switch (family) {
    case "setup":
    case "preparation": return "ПОДГОТ.";
    case "door-choice": return "ДВЕРЬ";
    case "combat": return "БОЙ";
    case "waiting": return "ОЖИД.";
    case "resolve-effect": return "ЭФФЕКТ";
    case "charity": return "БЛАГОТ.";
    case "end-turn": return "ИТОГ";
    case "lobby": return "ЛОББИ";
    default: return "ХОД";
  }
}

function playerNameForTurn(projection: Projection): string {
  if (projection.turn.player_id === projection.you.player_id) {
    return projection.you.name;
  }
  return projection.players.find((player) =>
    player.player_id === projection.turn.player_id,
  )?.name ?? "другой игрок";
}

function turnHeadline(
  projection: Projection,
  primary: PrimarySurface,
  currentPlayerName: string,
): string {
  if (primary.kind === "finished") return "ИГРА ОКОНЧЕНА";
  if (primary.kind === "result") {
    return primary.source === "reward"
      ? "РЕЗУЛЬТАТ"
      : primary.escaped ? "УСПЕХ" : "НЕУДАЧА";
  }
  if (primary.kind === "run-away") return "ТВОЁ РЕШЕНИЕ";
  return projection.turn.player_id === projection.you.player_id
    ? "ТВОЙ ХОД"
    : `ХОДИТ ${currentPlayerName}`;
}

function desktopNodeID(primary: PrimarySurface): string {
  switch (primary.kind) {
    case "finished": return "295:2518";
    case "required-decision": return "296:2748";
    case "run-away": return "285:1473";
    case "result": return primary.source === "reward"
      ? "285:1566"
      : primary.escaped ? "294:1998" : "294:2072";
    case "combat": return "248:5";
    case "door-choice": return "285:1315";
    case "resolving": return "293:1706";
    case "waiting": return "257:447";
    case "phase":
      switch (primary.family) {
        case "setup":
        case "preparation": return "293:1617";
        case "charity": return "256:316";
        case "end-turn": return "294:2235";
        default: return "248:5";
      }
    default: {
      const exhaustive: never = primary;
      return exhaustive;
    }
  }
}

function mobileNodeID(primary: PrimarySurface): string {
  switch (primary.kind) {
    case "finished": return "184:1687";
    case "required-decision": return "188:1777";
    case "run-away": return "183:1671";
    case "result": return primary.source === "reward" ? "184:1687" : "183:1671";
    case "door-choice": return "181:1634";
    case "waiting": return "147:1082";
    case "phase": return primary.family === "charity" ? "147:978" : "147:731";
    case "combat":
    case "resolving":
      return "147:731";
    default: {
      const exhaustive: never = primary;
      return exhaustive;
    }
  }
}

export function gameStateFamily(projection: Projection): GameStateFamily {
  if (projection.status === "lobby") {
    return "lobby";
  }
  if (projection.status === "finished") {
    return "finished";
  }
  switch (projection.turn.phase) {
    case "":
      return "waiting";
    case "setup":
      return "setup";
    case "preparation":
      return "preparation";
    case "door_choice":
      return "door-choice";
    case "combat":
      return "combat";
    case "run_away":
      return "run-away";
    case "resolve_effect":
      return "resolve-effect";
    case "charity":
      return "charity";
    case "end_turn":
      return "end-turn";
    default: {
      const exhaustive: never = projection.turn.phase;
      return exhaustive;
    }
  }
}

export function encounterCards(projection: Projection): CardView[] {
  return uniqueCards([
    ...(projection.turn.combat?.monsters ?? []),
    ...(projection.turn.encounter ? [projection.turn.encounter] : []),
  ]);
}

export function selectPrimarySurface(projection: Projection): PrimarySurface {
  if (projection.status === "finished") {
    return {kind: "finished"};
  }
  if (projection.turn.pending_decision) {
    return {
      kind: "required-decision",
      optionCount: projection.turn.pending_decision.options.length,
    };
  }
  if (projection.turn.run_away?.completed) {
    const runAway = projection.turn.run_away;
    const attempt = [...runAway.attempts].reverse().find((candidate) =>
      candidate.player_id === runAway.current_player_id,
    ) ?? runAway.attempts.at(-1);
    const monster = encounterCards(projection).find((candidate) =>
      candidate.instance_id === (attempt?.monster_instance_id ?? runAway.current_monster_instance_id),
    );
    return {
      kind: "result",
      source: "run-away",
      escaped: attempt?.escaped ?? false,
      roll: attempt?.roll ?? 0,
      modifier: attempt?.modifier ?? 0,
      total: attempt?.total ?? 0,
      monsterName: monster?.name ?? "Монстр",
    };
  }
  if (projection.recent_combat_result?.outcome === "victory") {
    const reward = projection.recent_combat_result.public_rewards.find((candidate) =>
      candidate.player_id === projection.you.player_id,
    );
    return {
      kind: "result",
      source: "reward",
      levels: reward?.levels_gained ?? 0,
      treasures: reward?.treasure_count ?? 0,
    };
  }
  if (projection.turn.phase === "run_away" && projection.turn.run_away) {
    if (projection.turn.run_away.current_player_id !== projection.you.player_id) {
      return {kind: "waiting"};
    }
    return {kind: "run-away", completed: false};
  }
  if (projection.turn.phase === "door_choice") {
    return {kind: "door-choice"};
  }
  if (
    projection.status === "active"
    && projection.turn.player_id
    && projection.turn.player_id !== projection.you.player_id
    && !projection.interaction?.response_required_for_you
  ) {
    return {kind: "waiting"};
  }
  if (projection.turn.phase === "combat" && projection.turn.combat) {
    return {kind: "combat"};
  }
  if (projection.turn.resolving.length > 0) {
    return {kind: "resolving", cardCount: projection.turn.resolving.length};
  }
  const family = gameStateFamily(projection);
  if (family === "waiting") {
    return {kind: "waiting"};
  }
  return {kind: "phase", family};
}

export function buildGamePresentationModel(
  projection: Projection,
): GamePresentationModel {
  const cards = encounterCards(projection);
  const activeInstanceID = projection.turn.run_away?.current_monster_instance_id
    ?? projection.turn.encounter?.instance_id;
  const requestedIndex = activeInstanceID
    ? cards.findIndex((card) => card.instance_id === activeInstanceID)
    : 0;
  const activeEncounterIndex = requestedIndex >= 0 ? requestedIndex : 0;
  const primary = selectPrimarySurface(projection);
  const currentPlayerName = playerNameForTurn(projection);
  return {
    family: gameStateFamily(projection),
    primary,
    desktopNodeID: desktopNodeID(primary),
    mobileNodeID: mobileNodeID(primary),
    phaseLabel: phaseLabel(primary, gameStateFamily(projection)),
    turnHeadline: turnHeadline(projection, primary, currentPlayerName),
    currentPlayerName,
    isActorTurn: projection.turn.player_id === projection.you.player_id,
    turnActions: projectedTurnActions(projection),
    encounterCards: cards,
    activeEncounterIndex,
    encounterPage: cards.length > 0 ? activeEncounterIndex + 1 : 1,
    encounterPageCount: Math.max(1, cards.length),
  };
}

export function opponentStatus(
  projection: Projection,
  player: Projection["players"][number],
): OpponentStatus {
  if (player.dead) {
    return "dead";
  }
  if (projection.turn.player_id === player.player_id) {
    return "active";
  }
  if (projection.status === "active" && !player.setup_done) {
    return "waiting";
  }
  return "ready";
}

export function opponentStatusLabel(status: OpponentStatus): string {
  switch (status) {
    case "active":
      return "Ходит";
    case "waiting":
      return "Готовится";
    case "dead":
      return "Вне хода";
    case "ready":
      return "Готов";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function hasActionableDeadline(projection: Projection): boolean {
  return Boolean(
    projection.interaction?.response_required_for_you
      && projection.interaction.deadline_at
      && projection.interaction.server_time,
  );
}
