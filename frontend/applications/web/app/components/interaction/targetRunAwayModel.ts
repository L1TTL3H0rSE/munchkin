import type {
  CardView,
  InteractionView,
  Projection,
} from "@munchkin/contracts";

export type TargetRunAwayAction = InteractionView["actions"][number];
export type RunAwayView = NonNullable<Projection["turn"]["run_away"]>;
export type RunAwayAttempt = RunAwayView["attempts"][number];
export type RunAwayEffect = RunAwayView["effects"][number];

function projectedPlayers(projection: Projection) {
  return [
    {player_id: projection.you.player_id, name: projection.you.name},
    ...projection.players,
  ];
}

export function isTargetInteraction(
  interaction: InteractionView | undefined,
): boolean {
  return interaction?.public_kind === "target_response" ||
    interaction?.public_kind === "private_choice";
}

export function isRunAwayInteraction(
  interaction: InteractionView | undefined,
): boolean {
  return interaction?.public_kind === "run_away_response";
}

export function targetPlayerName(
  projection: Projection,
  playerID: string | undefined,
): string {
  if (!playerID) {
    return "участник текущего эффекта";
  }
  return projectedPlayers(projection).find((player) => player.player_id === playerID)
    ?.name ?? "участник текущего эффекта";
}

function sourceName(action: TargetRunAwayAction, cards: readonly CardView[]): string {
  if (!action.source_instance_id) {
    return "";
  }
  return `Источник: ${cards.find((card) =>
    card.instance_id === action.source_instance_id,
  )?.name ?? "карта из текущей проекции"}`;
}

function choiceName(
  choiceID: string,
  cards: readonly CardView[],
  index: number,
): string {
  return cards.find((card) => card.instance_id === choiceID)?.name
    ?? `вариант ${index + 1}`;
}

export function targetRunAwayActionLabel(
  action: TargetRunAwayAction,
  actionIndex: number,
  cards: readonly CardView[],
): string {
  if (action.type === "pass") {
    return "Пасовать";
  }
  if (action.choice_ids?.length) {
    const names = action.choice_ids.map((choiceID, index) =>
      choiceName(choiceID, cards, index),
    );
    return names.length === 1
      ? `Выбрать ${names[0]}`
      : `Выбрать набор ${actionIndex + 1}`;
  }
  if (action.escape_delta !== undefined) {
    return "Усилить попытку побега";
  }
  if (action.target_effect_id || action.combat_capability === "counter_combat_effect") {
    return "Контрдействие на эффект";
  }
  return "Ответить";
}

export function targetRunAwayActionDetails(
  action: TargetRunAwayAction,
  projection: Projection,
  cards: readonly CardView[],
  interaction: InteractionView,
): string[] {
  const details: string[] = [];
  const source = sourceName(action, cards);
  if (source) {
    details.push(source);
  }
  if (interaction.public_kind === "target_response") {
    details.push(`Цель: ${targetPlayerName(projection, interaction.target_player_id)}`);
  }
  if (action.choice_ids?.length) {
    const choices = action.choice_ids.map((choiceID, index) =>
      choiceName(choiceID, cards, index),
    );
    details.push(`Серверный вариант: ${choices.join(", ")}`);
  }
  if (action.escape_delta !== undefined) {
    const sign = action.escape_delta > 0 ? "+" : "";
    details.push(`Изменение побега: ${sign}${action.escape_delta}`);
    details.push("После окна ответов бросок D6 выполняет сервер.");
  }
  if (action.target_effect_id) {
    details.push("Цель: текущий эффект без раскрытия opaque ID");
  }
  return details.length > 0
    ? details
    : ["Решение и результат подтверждает сервер."];
}

export function runAwayState(
  projection: Projection,
): RunAwayView | undefined {
  return projection.turn.run_away;
}

export function runAwayCurrentPlayerName(projection: Projection): string {
  return targetPlayerName(projection, projection.turn.run_away?.current_player_id);
}

export function runAwayMonsterName(
  projection: Projection,
  monsterID: string | undefined,
): string {
  const monsters = [
    ...(projection.turn.combat?.monsters ?? []),
    ...(projection.turn.encounter ? [projection.turn.encounter] : []),
  ];
  return monsters.find((monster) => monster.instance_id === monsterID)?.name
    ?? "монстр текущего шага";
}

export function runAwayAttemptPlayerName(
  projection: Projection,
  attempt: RunAwayAttempt,
): string {
  return targetPlayerName(projection, attempt.player_id);
}

export function runAwayAttemptMonsterName(
  projection: Projection,
  attempt: RunAwayAttempt,
): string {
  return runAwayMonsterName(projection, attempt.monster_instance_id);
}

export function runAwayAttemptRoll(attempt: RunAwayAttempt): string {
  if (attempt.roll === undefined) {
    return "Бросок D6 ожидает серверного разрешения";
  }
  const modifier = attempt.modifier >= 0
    ? `+${attempt.modifier}`
    : String(attempt.modifier);
  const total = attempt.total === undefined ? "" : ` = ${attempt.total}`;
  return `D6 ${attempt.roll} ${modifier}${total}`;
}

export function runAwayAttemptResult(attempt: RunAwayAttempt): string {
  if (attempt.escaped) {
    return "Побег подтверждён сервером";
  }
  if (attempt.bad_stuff_applied) {
    return "Попытка не удалась; Bad Stuff применён сервером";
  }
  if (attempt.roll === undefined) {
    return "Ожидаем подтверждённый результат";
  }
  return "Попытка не удалась";
}

export function runAwayEffectLabel(effect: RunAwayEffect): string {
  if (effect.kind === "counter") {
    return "Контрдействие на модификатор побега";
  }
  if (effect.amount === undefined) {
    return "Модификатор побега";
  }
  const sign = effect.amount > 0 ? "+" : "";
  return `Модификатор побега ${sign}${effect.amount}`;
}
