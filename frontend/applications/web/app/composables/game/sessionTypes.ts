import type {MaybeRefOrGetter} from "vue";

import type {
  ActionDescriptor,
  CharityAllocation,
  CommandPayload,
  CommandResult,
  InteractionIntent,
  Invalidation,
  Projection,
} from "@munchkin/contracts";

import type {
  GameCommandOptions,
  GameRequestOptions,
  GameApiError,
} from "@munchkin/api";

export type {GameConnectionState} from "@munchkin/shared";

export interface GameSessionAPI {
  getGame: (
    gameID: string,
    credential: string,
    options?: GameRequestOptions,
  ) => Promise<Projection>;
  command: (
    gameID: string,
    credential: string,
    name: ActionDescriptor["type"],
    expectedVersion: number,
    payload?: CommandPayload,
    options?: GameCommandOptions,
  ) => Promise<CommandResult>;
  requestCombatResolution: (
    gameID: string,
    credential: string,
    expectedVersion: number,
  ) => Promise<CommandResult>;
  interaction: (
    gameID: string,
    credential: string,
    expectedVersion: number,
    interactionID: string,
    actionID: string,
    intent: InteractionIntent,
    options?: GameCommandOptions,
  ) => Promise<CommandResult>;
  combatHelp: (
    gameID: string,
    credential: string,
    expectedVersion: number,
    actionID: string,
    options?: GameCommandOptions,
  ) => Promise<CommandResult>;
  economyOffer: (
    gameID: string,
    credential: string,
    expectedVersion: number,
    kind: "trade" | "gift",
    recipientPlayerID: string,
    offeredInstanceIDs: string[],
    requestedInstanceIDs?: string[],
    options?: GameCommandOptions,
  ) => Promise<CommandResult>;
  resolveCharity: (
    gameID: string,
    credential: string,
    expectedVersion: number,
    allocations?: CharityAllocation[],
    options?: GameCommandOptions,
  ) => Promise<CommandResult>;
  attemptTheft: (
    gameID: string,
    credential: string,
    expectedVersion: number,
    sourceInstanceID: string,
    abilityIndex: number,
    costInstanceID: string,
    victimPlayerID: string,
    options?: GameCommandOptions,
  ) => Promise<CommandResult>;
  stream: (
    gameID: string,
    credential: string,
    onInvalidation: (event: Invalidation) => void,
    onDisconnect: (error: GameApiError) => void,
    onConnected?: () => void,
  ) => () => void;
}

export interface GameCredentialAdapter {
  read: (gameID: string) => string | null;
  clearCurrentGame: (gameID: string) => void;
}

export interface GameSessionScheduler {
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export interface GameSessionControllerOptions {
  api: GameSessionAPI;
  credentials: GameCredentialAdapter;
  scheduler?: GameSessionScheduler;
  random?: () => number;
  createCommandID?: () => string;
  reconnectBackoffMs?: readonly number[];
  maxReconnectAttempts?: number;
  onDiagnostic?: (error: GameApiError) => void;
}

export interface UseGameSessionControllerOptions
  extends GameSessionControllerOptions {
  gameID: MaybeRefOrGetter<string>;
}
