import type {Projection} from "@munchkin/contracts";

export type Phase = Projection["turn"]["phase"];

export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "":
      return "Ожидание хода";
    case "setup":
      return "Подготовка";
    case "preparation":
      return "Подготовка хода";
    case "door_choice":
      return "Дверь";
    case "combat":
      return "Бой";
    case "run_away":
      return "Побег";
    case "resolve_effect":
      return "Решение";
    case "charity":
      return "Благотворительность";
    case "end_turn":
      return "Завершение хода";
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
}
