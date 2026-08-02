import type {CardView, Projection} from "@munchkin/contracts";

import {uniqueCards} from "../gameTableViewModel";

export type MobileStateFamily =
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

export function mobileStateFamily(projection: Projection): MobileStateFamily {
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

export function mobileEncounterCards(projection: Projection): CardView[] {
  return uniqueCards([
    ...(projection.turn.combat?.monsters ?? []),
    ...(projection.turn.encounter ? [projection.turn.encounter] : []),
  ]);
}

export function mobileOpponentStatus(
  projection: Projection,
  player: Projection["players"][number],
): "active" | "waiting" | "dead" | "ready" {
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

export function mobileOpponentStatusLabel(
  status: ReturnType<typeof mobileOpponentStatus>,
): string {
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
    projection.interaction?.response_required_for_you &&
    projection.interaction.deadline_at &&
    projection.interaction.server_time,
  );
}
