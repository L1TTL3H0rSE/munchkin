import type {Projection} from "@munchkin/contracts";

import type {
  GameApiErrorKind,
} from "../../../composables/useGameApi";
import type {
  GameConnectionState,
} from "../../../composables/useGameSessionController";

export type ConnectionPresentation = {
  visible: boolean;
  tone: "info" | "warning" | "danger";
  icon: "sync" | "offline" | "error";
  label: string;
  description: string;
  canRetry: boolean;
  ariaBusy: boolean;
  ariaLive: "off" | "polite" | "assertive";
};

export type SystemSurfaceKind =
  | "loading"
  | "auth"
  | "not-found"
  | "unavailable"
  | "protocol"
  | "victory"
  | "death"
  | "waiting";

export type SystemSurfaceModel = {
  tone: "info" | "warning" | "danger" | "success";
  icon: "loading" | "lock" | "search" | "offline" | "sync" | "trophy" | "skull" | "pause";
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: "retry" | "lobby" | undefined;
  primaryLabel: string | undefined;
  winnerName: string | undefined;
};

export type RouteSystemState =
  | {kind: "loading"}
  | {kind: "auth"}
  | {kind: "not-found"}
  | {kind: "unavailable"}
  | {kind: "protocol"}
  | {kind: "victory"; projection: Projection}
  | {kind: "game"; projection: Projection};

export function buildConnectionPresentation(
  state: GameConnectionState,
  errorKind: GameApiErrorKind | null,
  hasProjection: boolean,
): ConnectionPresentation {
  if (state === "connected") {
    return {
      visible: false,
      tone: "info",
      icon: "sync",
      label: "Связь подтверждена",
      description: "",
      canRetry: false,
      ariaBusy: false,
      ariaLive: "off",
    };
  }

  if (state === "connecting") {
    return {
      visible: hasProjection,
      tone: "info",
      icon: "sync",
      label: "Восстанавливаем связь",
      description: "Последняя подтверждённая проекция остаётся на экране.",
      canRetry: false,
      ariaBusy: true,
      ariaLive: "polite",
    };
  }

  if (state === "resyncing") {
    return {
      visible: hasProjection,
      tone: "info",
      icon: "sync",
      label: "Синхронизируем игру",
      description: "Проверяем свежую проекцию сервера перед продолжением.",
      canRetry: false,
      ariaBusy: true,
      ariaLive: "polite",
    };
  }

  if (state === "offline") {
    return {
      visible: hasProjection,
      tone: "warning",
      icon: "offline",
      label: "Связь потеряна",
      description: "Переподключаемся…",
      canRetry: false,
      ariaBusy: true,
      ariaLive: "polite",
    };
  }

  switch (errorKind) {
    case "auth":
      return {
        visible: hasProjection,
        tone: "danger",
        icon: "error",
        label: "Сессия завершена",
        description: "Вернитесь в лобби, чтобы войти в игру снова.",
        canRetry: false,
        ariaBusy: false,
        ariaLive: "assertive",
      };
    case "not_found":
      return {
        visible: hasProjection,
        tone: "danger",
        icon: "error",
        label: "Игра недоступна",
        description: "Сервер не нашёл эту комнату.",
        canRetry: false,
        ariaBusy: false,
        ariaLive: "assertive",
      };
    case "protocol":
    case "stale_version":
      return {
        visible: hasProjection,
        tone: "warning",
        icon: "error",
        label: "Нужно обновить состояние",
        description: "Проверяем актуальную проекцию перед новым действием.",
        canRetry: true,
        ariaBusy: false,
        ariaLive: "assertive",
      };
    case "offline":
    case "transient":
      return {
        visible: hasProjection,
        tone: "warning",
        icon: "offline",
        label: "Не удалось восстановить связь",
        description: "Попробуйте снова, чтобы запросить свежую проекцию.",
        canRetry: true,
        ariaBusy: false,
        ariaLive: "assertive",
      };
    case "validation":
    case "conflict":
    case "unexpected":
    case "aborted":
    case null:
      return {
        visible: hasProjection,
        tone: "danger",
        icon: "error",
        label: "Игра временно недоступна",
        description: "Попробуйте запросить свежую проекцию.",
        canRetry: true,
        ariaBusy: false,
        ariaLive: "assertive",
      };
  }
}

export function buildRouteSystemState(input: {
  hydrated: boolean;
  loading: boolean;
  projection: Projection | null;
  errorKind: GameApiErrorKind | null;
}): RouteSystemState {
  if (!input.hydrated || input.loading) {
    return {kind: "loading"};
  }
  if (input.projection?.status === "finished") {
    return {kind: "victory", projection: input.projection};
  }
  if (input.projection) {
    return {kind: "game", projection: input.projection};
  }
  switch (input.errorKind) {
    case "auth":
      return {kind: "auth"};
    case "not_found":
      return {kind: "not-found"};
    case "protocol":
      return {kind: "protocol"};
    case "offline":
    case "transient":
      return {kind: "unavailable"};
    case "aborted":
    case "validation":
    case "conflict":
    case "stale_version":
    case "unexpected":
    case null:
      return {kind: "unavailable"};
  }
}

function winnerName(projection: Projection): string {
  if (projection.winner_player_id === projection.you.player_id) {
    return projection.you.name;
  }
  return projection.players.find((player) =>
    player.player_id === projection.winner_player_id,
  )?.name ?? "Победитель подтверждён сервером";
}

export function buildSystemSurface(
  kind: SystemSurfaceKind,
  projection?: Projection,
): SystemSurfaceModel {
  switch (kind) {
    case "loading":
      return {
        tone: "info",
        icon: "loading",
        eyebrow: "ЗАГРУЗКА",
        title: "Подготавливаем стол…",
        description: "Проверяем сессию, версию игры и доступные действия.",
        primaryAction: undefined,
        primaryLabel: undefined,
        winnerName: undefined,
      };
    case "auth":
      return {
        tone: "warning",
        icon: "lock",
        eyebrow: "СЕССИЯ",
        title: "Сессия игры завершена",
        description: "Вернитесь в лобби и войдите в комнату снова.",
        primaryAction: "lobby",
        primaryLabel: "Вернуться в лобби",
        winnerName: undefined,
      };
    case "not-found":
      return {
        tone: "danger",
        icon: "search",
        eyebrow: "КОМНАТА",
        title: "Игра не найдена",
        description: "Проверьте код комнаты или создайте новую игру в лобби.",
        primaryAction: "lobby",
        primaryLabel: "Открыть лобби",
        winnerName: undefined,
      };
    case "unavailable":
      return {
        tone: "warning",
        icon: "offline",
        eyebrow: "СВЯЗЬ",
        title: "Игра временно недоступна",
        description: "Запросите свежую проекцию или вернитесь в лобби.",
        primaryAction: "retry",
        primaryLabel: "Попробовать снова",
        winnerName: undefined,
      };
    case "protocol":
      return {
        tone: "danger",
        icon: "sync",
        eyebrow: "СИНХРОНИЗАЦИЯ",
        title: "Не удалось прочитать игру",
        description: "Обновите проекцию. Если проблема повторится, вернитесь в лобби.",
        primaryAction: "retry",
        primaryLabel: "Обновить состояние",
        winnerName: undefined,
      };
    case "victory":
      return {
        tone: "success",
        icon: "trophy",
        eyebrow: "ФИНАЛ",
        title: projection && projection.winner_player_id === projection.you.player_id
          ? "Победа подтверждена"
          : "Игра завершена",
        description: "Итоговая проекция зафиксирована сервером. Новые действия закрыты.",
        primaryAction: "lobby",
        primaryLabel: "Вернуться в лобби",
        winnerName: projection ? winnerName(projection) : undefined,
      };
    case "death":
      return {
        tone: "danger",
        icon: "skull",
        eyebrow: "ПЕРСОНАЖ",
        title: "Персонаж выбыл",
        description: "Сервер готовит следующий подтверждённый шаг игры.",
        primaryAction: undefined,
        primaryLabel: undefined,
        winnerName: undefined,
      };
    case "waiting":
      return {
        tone: "info",
        icon: "pause",
        eyebrow: "ОЖИДАНИЕ",
        title: "Ожидаем ход",
        description: projection
          ? `Сейчас ходит ${projection.players.find((player) =>
            player.player_id === projection.turn.player_id,
          )?.name ?? "другого игрока"}.`
          : "Следующее действие появится из новой проекции.",
        primaryAction: undefined,
        primaryLabel: undefined,
        winnerName: undefined,
      };
  }
}
