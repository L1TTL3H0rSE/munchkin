import type {Ref, ShallowRef} from "vue";

import type {
  ActionDescriptor,
  CommandPayload,
  CommandResult,
  InteractionIntent,
  InteractionView,
  Projection,
} from "@munchkin/contracts";

import type {EconomySubmission} from "@munchkin/components";

import {
  GameApiError,
  normalizeGameApiError,
  safeGameApiMessage,
} from "@munchkin/api";
import type {
  GameConnectionState,
  GameSessionAPI,
} from "./sessionTypes";

type InteractionActionView = InteractionView["actions"][number];

type SessionSubmissionContext = {
  api: GameSessionAPI;
  projectionState: ShallowRef<Projection | null>;
  actionBusyState: Ref<boolean>;
  interactionBusyState: Ref<boolean>;
  errorMessageState: Ref<string>;
  interactionErrorState: Ref<string>;
  connectionState: Ref<GameConnectionState>;
  getOwner: () => number;
  getGameID: () => string;
  getCredential: () => string | null;
  isCurrent: (owner: number) => boolean;
  withRequest: <T>(
    owner: number,
    request: (signal: AbortSignal) => Promise<T>,
  ) => Promise<T>;
  createCommandID: () => string;
  clearConnectionError: () => void;
  setConnectionError: (error: GameApiError) => void;
  requestResync: (requiredVersion?: number) => Promise<void>;
  hasActiveStream: () => boolean;
  reportDiagnostic: (error: GameApiError) => void;
  scheduleRecovery: (owner: number) => void;
  finishTerminalAuth: (owner: number) => void;
  finishTerminalFailure: (error: GameApiError, owner: number) => void;
  stopActiveStream: () => void;
};

export function createSessionSubmissions(context: SessionSubmissionContext) {
  let pendingCommand:
    | {commandID: string; lifecycle: number}
    | undefined;
  let pendingInteraction:
    | {
        commandID: string;
        lifecycle: number;
        interactionID: string;
        actionID: string;
      }
    | undefined;

  async function executeWithOneRetry(
    execute: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    try {
      return await execute();
    } catch (error) {
      const normalized = normalizeGameApiError(error);
      if (normalized.kind !== "offline" && normalized.kind !== "transient") {
        throw normalized;
      }
      return execute();
    }
  }

  function applyResult(result: CommandResult): void {
    const gameID = context.getGameID();
    if (result.game_id !== gameID || result.projection.game_id !== gameID) {
      throw new GameApiError("protocol", safeGameApiMessage("protocol"));
    }
    const visible = context.projectionState.value;
    if (!visible || result.projection.version >= visible.version) {
      context.projectionState.value = result.projection;
    }
  }

  async function resyncStaleSubmission(owner: number): Promise<void> {
    context.setConnectionError(new GameApiError(
      "stale_version",
      safeGameApiMessage("stale_version"),
    ));
    context.connectionState.value = "resyncing";
    await context.requestResync().catch((error: unknown) => {
      context.reportDiagnostic(normalizeGameApiError(error));
    });
    if (context.isCurrent(owner) && context.hasActiveStream()) {
      context.connectionState.value = "connected";
    }
  }

  async function submitAction(
    action: ActionDescriptor,
    payload: CommandPayload,
  ): Promise<void> {
    const owner = context.getOwner();
    const current = context.projectionState.value;
    const credential = context.getCredential();
    if (
      !context.isCurrent(owner) ||
      !current ||
      !credential ||
      pendingCommand
    ) {
      return;
    }

    const commandID = context.createCommandID();
    pendingCommand = {commandID, lifecycle: owner};
    context.actionBusyState.value = true;
    context.clearConnectionError();

    const execute = () => context.withRequest(
      owner,
      (signal) => action.type === "request_combat_resolution"
        ? context.api.requestCombatResolution(
          context.getGameID(),
          credential,
          current.version,
        )
        : context.api.command(
          context.getGameID(),
          credential,
          action.type,
          current.version,
          payload,
          {commandID, signal},
        ),
    );

    try {
      const result = await executeWithOneRetry(execute);
      if (!context.isCurrent(owner)) {
        return;
      }
      applyResult(result);
    } catch (error) {
      if (context.isCurrent(owner)) {
        await handleActionFailure(normalizeGameApiError(error), owner);
      }
    } finally {
      if (
        pendingCommand?.commandID === commandID &&
        pendingCommand.lifecycle === owner
      ) {
        pendingCommand = undefined;
        context.actionBusyState.value = false;
      }
    }
  }

  async function submitEconomy(request: EconomySubmission): Promise<void> {
    const owner = context.getOwner();
    const current = context.projectionState.value;
    const credential = context.getCredential();
    if (
      !context.isCurrent(owner) ||
      !current ||
      !credential ||
      pendingCommand ||
      pendingInteraction
    ) {
      return;
    }

    if (request.kind === "charity" && request.interactionID &&
      current.interaction?.interaction_id !== request.interactionID) {
      await resyncStaleSubmission(owner);
      return;
    }

    if (request.kind !== "charity") {
      const liveAction = current.turn.available_actions.find((candidate) =>
        candidate.type === request.action.type &&
        candidate.source_instance_id === request.action.source_instance_id &&
        candidate.ability_index === request.action.ability_index,
      );
      if (!liveAction) {
        await resyncStaleSubmission(owner);
        return;
      }
    }

    const commandID = context.createCommandID();
    pendingCommand = {commandID, lifecycle: owner};
    context.actionBusyState.value = true;
    context.clearConnectionError();

    const charityCompletionCommandID = `${commandID}:complete`;
    const execute = () => context.withRequest(
      owner,
      async (signal) => {
        switch (request.kind) {
          case "offer":
            return context.api.economyOffer(
              context.getGameID(),
              credential,
              current.version,
              request.offerKind,
              request.recipientPlayerID,
              request.offeredInstanceIDs,
              request.requestedInstanceIDs,
              {commandID, signal},
            );
          case "charity":
            if (current.turn.phase === "charity" && !current.interaction &&
              request.allocations.length > 0) {
              const begun = await context.api.resolveCharity(
                context.getGameID(),
                credential,
                current.version,
                [],
                {commandID, signal},
              );
              return context.api.resolveCharity(
                context.getGameID(),
                credential,
                begun.projection.version,
                request.allocations,
                {commandID: charityCompletionCommandID, signal},
              );
            }
            return context.api.resolveCharity(
              context.getGameID(),
              credential,
              current.version,
              request.allocations,
              {commandID, signal},
            );
          case "theft":
            return context.api.attemptTheft(
              context.getGameID(),
              credential,
              current.version,
              request.action.source_instance_id ?? "",
              request.action.ability_index ?? 0,
              request.costInstanceID,
              request.victimPlayerID,
              {commandID, signal},
            );
        }
      },
    );

    try {
      const result = await executeWithOneRetry(execute);
      if (!context.isCurrent(owner)) {
        return;
      }
      applyResult(result);
      context.clearConnectionError();
    } catch (error) {
      if (context.isCurrent(owner)) {
        await handleActionFailure(normalizeGameApiError(error), owner);
      }
    } finally {
      if (
        pendingCommand?.commandID === commandID &&
        pendingCommand.lifecycle === owner
      ) {
        pendingCommand = undefined;
        context.actionBusyState.value = false;
      }
    }
  }

  async function handleActionFailure(
    error: GameApiError,
    owner: number,
  ): Promise<void> {
    context.reportDiagnostic(error);
    context.setConnectionError(error);
    switch (error.kind) {
      case "aborted":
        return;
      case "auth":
        context.finishTerminalAuth(owner);
        return;
      case "stale_version":
        context.errorMessageState.value = error.message;
        context.connectionState.value = "resyncing";
        try {
          await context.requestResync();
          if (context.isCurrent(owner) && context.hasActiveStream()) {
            context.connectionState.value = "connected";
          }
        } catch (refreshError) {
          if (context.isCurrent(owner)) {
            const normalized = normalizeGameApiError(refreshError);
            context.reportDiagnostic(normalized);
            if (
              normalized.kind === "offline" ||
              normalized.kind === "transient"
            ) {
              context.scheduleRecovery(owner);
            } else if (normalized.kind === "auth") {
              context.finishTerminalAuth(owner);
            } else {
              context.finishTerminalFailure(normalized, owner);
            }
          }
        }
        return;
      case "offline":
      case "transient":
        context.scheduleRecovery(owner);
        return;
      case "protocol":
        context.stopActiveStream();
        context.connectionState.value = "failed";
        return;
      case "validation":
      case "conflict":
      case "not_found":
      case "unexpected":
        return;
    }
  }

  async function submitInteraction(
    action: InteractionActionView,
  ): Promise<void> {
    const owner = context.getOwner();
    const current = context.projectionState.value;
    const credential = context.getCredential();
    const visibleInteraction = current?.interaction;
    if (
      !context.isCurrent(owner) ||
      !current ||
      !credential ||
      !visibleInteraction ||
      pendingInteraction
    ) {
      return;
    }

    const descriptor = visibleInteraction.actions.find((candidate) =>
      candidate.interaction_id === action.interaction_id &&
      candidate.action_id === action.action_id,
    );
    const isCombatHelpAction = descriptor?.type === "offer_help" ||
      descriptor?.type === "cancel_help";
    const intent = isCombatHelpAction
      ? undefined
      : descriptor?.type as InteractionIntent | undefined;
    if (
      !descriptor ||
      (!isCombatHelpAction && intent === undefined) ||
      (!isCombatHelpAction && descriptor.type !== intent)
    ) {
      context.interactionErrorState.value = safeGameApiMessage("validation");
      return;
    }

    const commandID = context.createCommandID();
    pendingInteraction = {
      commandID,
      lifecycle: owner,
      interactionID: descriptor.interaction_id,
      actionID: descriptor.action_id,
    };
    context.interactionBusyState.value = true;
    context.interactionErrorState.value = "";

    const execute = () => context.withRequest(
      owner,
      (signal) => isCombatHelpAction
        ? context.api.combatHelp(
          context.getGameID(),
          credential,
          current.version,
          descriptor.action_id,
          {commandID, signal},
        )
        : context.api.interaction(
          context.getGameID(),
          credential,
          current.version,
          descriptor.interaction_id,
          descriptor.action_id,
          intent as InteractionIntent,
          {commandID, signal},
        ),
    );

    try {
      const result = await executeWithOneRetry(execute);
      if (!context.isCurrent(owner)) {
        return;
      }
      applyResult(result);
      context.interactionErrorState.value = "";
    } catch (error) {
      if (context.isCurrent(owner)) {
        await handleInteractionFailure(normalizeGameApiError(error), owner);
      }
    } finally {
      if (
        pendingInteraction?.commandID === commandID &&
        pendingInteraction.lifecycle === owner
      ) {
        pendingInteraction = undefined;
        context.interactionBusyState.value = false;
      }
    }
  }

  async function handleInteractionFailure(
    error: GameApiError,
    owner: number,
  ): Promise<void> {
    context.reportDiagnostic(error);
    switch (error.kind) {
      case "aborted":
        return;
      case "auth":
        context.finishTerminalAuth(owner);
        return;
      case "stale_version":
      case "conflict":
      case "protocol":
        context.interactionErrorState.value = error.message;
        context.connectionState.value = "resyncing";
        try {
          await context.requestResync();
          if (context.isCurrent(owner) && context.hasActiveStream()) {
            context.connectionState.value = "connected";
          }
        } catch (refreshError) {
          if (!context.isCurrent(owner)) {
            return;
          }
          const normalized = normalizeGameApiError(refreshError);
          context.reportDiagnostic(normalized);
          if (normalized.kind === "auth") {
            context.finishTerminalAuth(owner);
          } else if (
            normalized.kind === "offline" ||
            normalized.kind === "transient"
          ) {
            context.interactionErrorState.value = normalized.message;
            context.scheduleRecovery(owner);
          } else {
            context.interactionErrorState.value = normalized.message;
            context.connectionState.value = "failed";
          }
        }
        return;
      case "offline":
      case "transient":
        context.interactionErrorState.value = error.message;
        context.scheduleRecovery(owner);
        return;
      case "validation":
      case "not_found":
      case "unexpected":
        context.interactionErrorState.value = error.message;
    }
  }

  function reset(): void {
    pendingCommand = undefined;
    pendingInteraction = undefined;
    context.actionBusyState.value = false;
    context.interactionBusyState.value = false;
  }

  return {reset, submitAction, submitEconomy, submitInteraction};
}
