import {
  computed,
  toValue,
  type MaybeRefOrGetter,
} from "vue";
import type {
  ActionDescriptor,
  CardView,
  InteractionView,
  Projection,
} from "@munchkin/contracts";
import {
  actionKey,
  actionLabel,
  type ActionEntry,
} from "../components/actionModel";

type Phase = Projection["turn"]["phase"];
type CombatProjection = NonNullable<Projection["turn"]["combat"]>;
type RunAwayProjection = NonNullable<Projection["turn"]["run_away"]>;
type DecisionProjection = NonNullable<Projection["turn"]["pending_decision"]>;
type InteractionAction = InteractionView["actions"][number];

export type StatusPresentation =
  | {kind: "lobby"; status: "lobby"; isFinished: false}
  | {kind: "active"; status: "active"; isFinished: false}
  | {
    kind: "finished";
    status: "finished";
    isFinished: true;
    winnerPlayerID?: string;
  };

export type PhasePresentation =
  | {kind: "lobby"; phase: "lobby"; turnPlayerID: string}
  | {kind: "finished"; phase: "finished"; turnPlayerID: string}
  | {kind: "waiting"; phase: "waiting"; turnPlayerID: string}
  | {
    kind: Exclude<Phase, "">;
    phase: Exclude<Phase, "">;
    turnPlayerID: string;
    isActorTurn: boolean;
  };

export type EncounterPresentation =
  | {kind: "none"}
  | {kind: "card"; card: CardView};

export type CombatPresentation =
  | {kind: "none"}
  | {kind: "active"; combat: CombatProjection}
  | {kind: "closed"; combat: CombatProjection};

export type RunAwayPresentation =
  | {kind: "none"}
  | {kind: "active"; runAway: RunAwayProjection}
  | {kind: "completed"; runAway: RunAwayProjection};

export type DecisionPresentation =
  | {kind: "none"}
  | {kind: "pending"; decision: DecisionProjection};

export type TurnActionPresentation = ActionEntry & {
  source: "turn";
  key: string;
  label: string;
  enabled: true;
};

export type InteractionActionPresentation = {
  source: "interaction";
  action: InteractionAction;
  key: string;
  label: string;
  enabled: boolean;
};

export type GamePresentation = {
  projectionVersion: number;
  status: StatusPresentation;
  phase: PhasePresentation;
  encounter: EncounterPresentation;
  combat: CombatPresentation;
  runAway: RunAwayPresentation;
  decision: DecisionPresentation;
  turnActions: readonly TurnActionPresentation[];
  interactionActions: readonly InteractionActionPresentation[];
  hasActionableTurn: boolean;
  hasActionableInteraction: boolean;
  currentPlayerName: string;
  isActorTurn: boolean;
};

function statusPresentation(projection: Projection): StatusPresentation {
  switch (projection.status) {
    case "lobby":
      return {kind: "lobby", status: "lobby", isFinished: false};
    case "active":
      return {kind: "active", status: "active", isFinished: false};
    case "finished":
      return {
        kind: "finished",
        status: "finished",
        isFinished: true,
        ...(projection.winner_player_id === undefined
          ? {}
          : {winnerPlayerID: projection.winner_player_id}),
      };
    default: {
      const exhaustive: never = projection.status;
      return exhaustive;
    }
  }
}

function phasePresentation(
  projection: Projection,
  isActorTurn: boolean,
): PhasePresentation {
  const turnPlayerID = projection.turn.player_id;
  if (projection.status === "lobby") {
    return {kind: "lobby", phase: "lobby", turnPlayerID};
  }
  if (projection.status === "finished") {
    return {kind: "finished", phase: "finished", turnPlayerID};
  }
  if (projection.turn.phase === "") {
    return {kind: "waiting", phase: "waiting", turnPlayerID};
  }
  return {
    kind: projection.turn.phase,
    phase: projection.turn.phase,
    turnPlayerID,
    isActorTurn,
  };
}

function interactionActionLabel(action: InteractionAction): string {
  switch (action.type) {
    case "pass":
      return "Пас";
    case "respond":
      return "Подтвердить ответ";
    case "accept":
      return "Принять";
    case "decline":
      return "Отказаться";
    case "cancel_offer":
      return "Отменить предложение";
    case "offer_help":
      return "Предложить помощь";
    case "cancel_help":
      return "Отменить помощь";
    default: {
      const exhaustive: never = action.type;
      return exhaustive;
    }
  }
}

function turnActionPresentations(
  actions: readonly ActionDescriptor[],
): readonly TurnActionPresentation[] {
  return actions.map((action, index) => ({
    action,
    index,
    source: "turn",
    key: actionKey(action, index),
    label: actionLabel(action),
    enabled: true,
  }));
}

function interactionActionPresentations(
  interaction: InteractionView | undefined,
): readonly InteractionActionPresentation[] {
  if (!interaction) {
    return [];
  }
  return interaction.actions.map((action) => ({
    source: "interaction",
    action,
    key: `${action.interaction_id}:${action.action_id}:${action.revision}`,
    label: interactionActionLabel(action),
    enabled: interaction.response_required_for_you,
  }));
}

export function buildGamePresentation(projection: Projection): GamePresentation {
  const isActorTurn = projection.turn.player_id === projection.you.player_id;
  const turnActions = turnActionPresentations(
    projection.turn.available_actions,
  );
  const interactionActions = interactionActionPresentations(
    projection.interaction,
  );
  const combat = projection.turn.combat === undefined
    ? {kind: "none" as const}
    : projection.turn.combat.combat_closed
      ? {kind: "closed" as const, combat: projection.turn.combat}
      : {kind: "active" as const, combat: projection.turn.combat};
  const runAway = projection.turn.run_away === undefined
    ? {kind: "none" as const}
    : projection.turn.run_away.completed
      ? {kind: "completed" as const, runAway: projection.turn.run_away}
      : {kind: "active" as const, runAway: projection.turn.run_away};
  const currentPlayerName = projection.players.find((player) =>
    player.player_id === projection.turn.player_id,
  )?.name
    ?? (projection.turn.player_id === projection.you.player_id
      ? projection.you.name
      : "другого игрока");

  return {
    projectionVersion: projection.version,
    status: statusPresentation(projection),
    phase: phasePresentation(projection, isActorTurn),
    encounter: projection.turn.encounter === undefined
      ? {kind: "none"}
      : {kind: "card", card: projection.turn.encounter},
    combat,
    runAway,
    decision: projection.turn.pending_decision === undefined
      ? {kind: "none"}
      : {kind: "pending", decision: projection.turn.pending_decision},
    turnActions,
    interactionActions,
    hasActionableTurn: turnActions.length > 0,
    hasActionableInteraction: interactionActions.some((action) => action.enabled),
    currentPlayerName,
    isActorTurn,
  };
}

export const mapGamePresentation = buildGamePresentation;

export function useGamePresentation(
  projection: MaybeRefOrGetter<Projection | null | undefined>,
) {
  return computed(() => {
    const current = toValue(projection);
    return current ? buildGamePresentation(current) : null;
  });
}
