import type {
  CardView,
  InteractionView,
  InteractionIntent,
} from "@munchkin/contracts";

export type InteractionActionView = InteractionView["actions"][number];

const dismissingActionTypes = new Set<InteractionActionView["type"]>([
  "pass",
  "cancel_offer",
]);

const acceptedIntentTypes = new Set<InteractionActionView["type"]>([
  "pass",
  "respond",
  "accept",
  "decline",
  "cancel_offer",
]);

const terminalResponseStates = new Set<NonNullable<
  InteractionView["my_response_state"]
>>([
  "passed",
  "acted",
  "accepted",
  "declined",
  "timed_out",
  "auto_resolved",
]);

const kindLabels: Record<InteractionView["public_kind"], string> = {
  response_window: "Открытое решение",
  combat_response: "Ответ в бою",
  combat_help_offer: "Предложение помощи",
  target_response: "Выбор цели",
  run_away_response: "Ответ на побег",
  private_choice: "Личное решение",
  economy_offer: "Предложение обмена",
  charity_transfer: "Распределение карт",
  theft_response: "Ответ на кражу",
  death_loot_priority: "Приоритет добычи",
};

const actionLabels: Record<InteractionActionView["type"], string> = {
  pass: "Пасовать",
  respond: "Ответить",
  accept: "Принять",
  decline: "Отклонить",
  cancel_offer: "Отменить предложение",
  offer_help: "Предложить помощь",
  cancel_help: "Отменить помощь",
};

export function interactionTitle(interaction: InteractionView): string {
  return kindLabels[interaction.public_kind];
}

export function interactionActionLabel(
  action: InteractionActionView,
): string {
  return actionLabels[action.type] ?? "Действие";
}

export function interactionActionIntent(
  action: InteractionActionView,
): InteractionIntent | undefined {
  if (!acceptedIntentTypes.has(action.type)) {
    return undefined;
  }
  return action.type as InteractionIntent;
}

export function interactionActionKey(action: InteractionActionView): string {
  return `${action.interaction_id}:${action.revision}:${action.action_id}`;
}

export function interactionRevisionKey(
  interaction: InteractionView | undefined,
): string {
  if (!interaction) {
    return "";
  }
  const revision = interaction.actions
    .map((action) => `${action.action_id}:${action.revision}`)
    .join(",");
  return `${interaction.interaction_id}:${interaction.status}:`
    + `${interaction.my_response_state ?? "none"}:`
    + `${interaction.response_required_for_you}:${revision}`;
}

export function interactionCanDismiss(
  interaction: InteractionView,
): boolean {
  return !interaction.response_required_for_you ||
    interaction.actions.length === 0 ||
    interaction.actions.some((action) => dismissingActionTypes.has(action.type));
}

export function interactionIsTerminal(
  interaction: InteractionView,
): boolean {
  return interaction.my_response_state !== undefined &&
    terminalResponseStates.has(interaction.my_response_state);
}

export function interactionResponseMessage(
  state: InteractionView["my_response_state"],
): string {
  switch (state) {
    case "passed":
      return "Ваш пас принят текущей версией окна.";
    case "acted":
      return "Ваш ответ принят текущей версией окна.";
    case "accepted":
      return "Предложение принято.";
    case "declined":
      return "Предложение отклонено.";
    case "timed_out":
      return "Окно ответа истекло на сервере.";
    case "auto_resolved":
      return "Окно закрыто автоматическим решением сервера.";
    case "pending":
      return "Ответ обрабатывается сервером.";
    default:
      return "";
  }
}

export function interactionActionDescription(
  action: InteractionActionView,
  cards: readonly CardView[],
): string {
  const details: string[] = [];
  if (action.source_instance_id) {
    const source = cards.find((card) =>
      card.instance_id === action.source_instance_id,
    );
    details.push(`Источник: ${source?.name ?? "карта из текущей проекции"}`);
  }
  if (action.target === "player" || action.helper_player_id) {
    details.push("Цель: игрок из текущей проекции");
  }
  if (action.target === "monster" || action.target_monster_instance_id) {
    details.push("Цель: монстр текущего боя");
  }
  if (action.target_effect_id) {
    details.push("Цель: эффект текущего окна");
  }
  if (action.combat_delta !== undefined) {
    details.push(`Изменение силы: ${action.combat_delta > 0 ? "+" : ""}${action.combat_delta}`);
  }
  if (action.escape_delta !== undefined) {
    details.push(`Изменение побега: ${action.escape_delta > 0 ? "+" : ""}${action.escape_delta}`);
  }
  if (action.choice_ids?.length) {
    details.push("Доступен выбор из вариантов текущей проекции");
  }
  return details.join(" · ") || "Действие подтверждается сервером.";
}

export function actionIsSelectable(action: InteractionActionView): boolean {
  return interactionActionIntent(action) !== undefined;
}
