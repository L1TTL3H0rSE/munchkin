import {
  onBeforeUnmount,
  onMounted,
  toValue,
  watch,
} from "vue";

import {createGameSessionController} from "./game/sessionController";
import type {UseGameSessionControllerOptions} from "./game/sessionTypes";

export {createGameSessionController} from "./game/sessionController";
export type {
  GameConnectionState,
  GameCredentialAdapter,
  GameSessionAPI,
  GameSessionControllerOptions,
  GameSessionScheduler,
  UseGameSessionControllerOptions,
} from "./game/sessionTypes";

export function useGameSessionController(
  options: UseGameSessionControllerOptions,
) {
  const controller = createGameSessionController(options);
  onMounted(() => {
    watch(
      () => toValue(options.gameID),
      (gameID) => {
        void controller.start(gameID);
      },
      {immediate: true},
    );
  });
  onBeforeUnmount(() => controller.stop());
  return controller;
}
