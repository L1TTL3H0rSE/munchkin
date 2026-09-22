import {$fetch, type FetchOptions} from "ofetch";

import {
  commandResultSchema,
  combatHelpRequestSchema,
  combatResolutionRequestSchema,
  economyOfferRequestSchema,
  charityRequestSchema,
  theftRequestSchema,
  interactionCommandRequestSchema,
  lobbyResultSchema,
  lobbySummarySchema,
  projectionSchema,
  commandPayloadSchema,
  type ActionType,
  type CommandResult,
  type CommandPayload,
  type Invalidation,
  type InteractionIntent,
  type CharityAllocation,
  type LobbyResult,
  type Projection,
} from "@munchkin/contracts";

import {
  GameApiError,
  normalizeGameApiError,
  safeGameApiMessage,
} from "./apiErrors.js";
import {consumeGameStream} from "./realtime.js";

export type GameFetch = (
  url: string,
  options?: Pick<FetchOptions<"json">, "headers" | "body" | "signal"> & {method?: "GET" | "POST"},
) => Promise<unknown>;

export interface GameRequestOptions {
  signal?: AbortSignal;
}

export interface GameCommandOptions extends GameRequestOptions {
  commandID?: string;
}

export function createGameApi(baseURL: string, fetcher: GameFetch = $fetch) {
  async function createLobby(displayName: string) {
    return requestGameplay(
      () => fetcher(`${baseURL}/api/v1/lobbies`, {
        method: "POST",
        body: {display_name: displayName},
      }),
      clientLobbyResult,
    );
  }

  async function getLobby(gameID: string) {
    return requestGameplay(
      () => fetcher(
        `${baseURL}/api/v1/lobbies/${encodeURIComponent(gameID)}`,
      ),
      (response) => lobbySummarySchema.parse(response),
    );
  }

  async function joinLobby(gameID: string, displayName: string, expectedVersion: number) {
    const credential = randomCredential();
    const commandID = crypto.randomUUID();
    const request = () => requestGameplay(
      () => fetcher(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/players`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": commandID,
          },
          body: {
            display_name: displayName,
            expected_version: expectedVersion,
          },
        },
      ),
      clientLobbyResult,
    );
    try {
      return await request();
    } catch (error) {
      const normalized = normalizeGameApiError(error);
      if (
        normalized.kind !== "offline" &&
        normalized.kind !== "transient"
      ) {
        throw error;
      }
      return request();
    }
  }

  async function getGame(
    gameID: string,
    credential: string,
    options: GameRequestOptions = {},
  ) {
    return requestGameplay(
      () => fetcher(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}`,
        {
          headers: authorization(credential),
          ...(options.signal ? {signal: options.signal} : {}),
        },
      ),
      clientProjection,
    );
  }

  async function command(
    gameID: string,
    credential: string,
    name: ActionType,
    expectedVersion: number,
    payload: CommandPayload = {},
    options: GameCommandOptions = {},
  ) {
    const pathName = name.replaceAll("_", "-");
    const path = name === "start" ? "start" : `commands/${pathName}`;
    const commandID = options.commandID ?? crypto.randomUUID();
    const parsedPayload = parseClientRequest(
      () => commandPayloadSchema.parse(payload),
    );
    return requestGameplay(
      () => fetcher(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/${path}`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": commandID,
          },
          body: {
            expected_version: expectedVersion,
            ...parsedPayload,
          },
          ...(options.signal ? {signal: options.signal} : {}),
        },
      ),
      clientCommandResult,
    );
  }

  async function interaction(
    gameID: string,
    credential: string,
    expectedVersion: number,
    interactionID: string,
    actionID: string,
    intent: InteractionIntent,
    options: GameCommandOptions = {},
  ) {
    const request = parseClientRequest(
      () => interactionCommandRequestSchema.parse({
        expected_version: expectedVersion,
        interaction_id: interactionID,
        action_id: actionID,
        intent,
      }),
    );
    const path = intent === "pass"
      ? "pass-interaction"
      : "respond-interaction";
    const commandID = options.commandID ?? crypto.randomUUID();
    return requestGameplay(
      () => fetcher(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/commands/${path}`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": commandID,
          },
          body: request,
          ...(options.signal ? {signal: options.signal} : {}),
        },
      ),
      clientCommandResult,
    );
  }

  async function requestCombatResolution(
    gameID: string,
    credential: string,
    expectedVersion: number,
  ) {
    const request = parseClientRequest(
      () => combatResolutionRequestSchema.parse({
        expected_version: expectedVersion,
      }),
    );
    return requestGameplay(
      () => fetcher(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/commands/request-combat-resolution`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: request,
        },
      ),
      clientCommandResult,
    );
  }

  async function combatHelp(
    gameID: string,
    credential: string,
    expectedVersion: number,
    actionID: string,
    options: GameCommandOptions = {},
  ) {
    const request = parseClientRequest(
      () => combatHelpRequestSchema.parse({
        expected_version: expectedVersion,
        action_id: actionID,
      }),
    );
    const commandID = options.commandID ?? crypto.randomUUID();
    return requestGameplay(
      () => fetcher(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/commands/combat-help`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": commandID,
          },
          body: request,
          ...(options.signal ? {signal: options.signal} : {}),
        },
      ),
      clientCommandResult,
    );
  }

  async function economyOffer(
    gameID: string,
    credential: string,
    expectedVersion: number,
    kind: "trade" | "gift",
    recipientPlayerID: string,
    offeredInstanceIDs: string[],
    requestedInstanceIDs: string[] = [],
    options: GameCommandOptions = {},
  ) {
    const request = parseClientRequest(
      () => economyOfferRequestSchema.parse({
        expected_version: expectedVersion,
        recipient_player_id: recipientPlayerID,
        offered_instance_ids: offeredInstanceIDs,
        ...(kind === "trade"
          ? {requested_instance_ids: requestedInstanceIDs}
          : {}),
      }),
    );
    return requestGameplay(
      () => fetcher(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/commands/propose-${kind}`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": options.commandID ?? crypto.randomUUID(),
          },
          body: request,
          ...(options.signal ? {signal: options.signal} : {}),
        },
      ),
      clientCommandResult,
    );
  }

  async function resolveCharity(
    gameID: string,
    credential: string,
    expectedVersion: number,
    allocations: CharityAllocation[] = [],
    options: GameCommandOptions = {},
  ) {
    const request = parseClientRequest(
      () => charityRequestSchema.parse({
        expected_version: expectedVersion,
        ...(allocations.length > 0 ? {allocations} : {}),
      }),
    );
    return requestGameplay(
      () => fetcher(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/commands/resolve-charity`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": options.commandID ?? crypto.randomUUID(),
          },
          body: request,
          ...(options.signal ? {signal: options.signal} : {}),
        },
      ),
      clientCommandResult,
    );
  }

  async function attemptTheft(
    gameID: string,
    credential: string,
    expectedVersion: number,
    sourceInstanceID: string,
    abilityIndex: number,
    costInstanceID: string,
    victimPlayerID: string,
    options: GameCommandOptions = {},
  ) {
    const request = parseClientRequest(
      () => theftRequestSchema.parse({
        expected_version: expectedVersion,
        source_instance_id: sourceInstanceID,
        ability_index: abilityIndex,
        cost_instance_ids: [costInstanceID],
        victim_player_id: victimPlayerID,
      }),
    );
    return requestGameplay(
      () => fetcher(
        `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/commands/attempt-theft`,
        {
          method: "POST",
          headers: {
            ...authorization(credential),
            "Idempotency-Key": options.commandID ?? crypto.randomUUID(),
          },
          body: request,
          ...(options.signal ? {signal: options.signal} : {}),
        },
      ),
      clientCommandResult,
    );
  }

  function stream(
    gameID: string,
    credential: string,
    onInvalidation: (event: Invalidation) => void,
    onDisconnect: (error: GameApiError) => void,
    onConnected?: () => void,
  ) {
    const controller = new AbortController();
    void consumeGameStream(
      `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/events`,
      credential,
      controller.signal,
      onInvalidation,
      onConnected,
    ).catch((error) => {
      if (!controller.signal.aborted) {
        onDisconnect(normalizeGameApiError(error));
      }
    });
    return () => controller.abort();
  }

  function contentAssetURL(setID: string, image: string) {
    return buildContentAssetURL(baseURL, setID, image);
  }

  return {
    createLobby,
    getLobby,
    joinLobby,
    getGame,
    command,
    interaction,
    requestCombatResolution,
    combatHelp,
    economyOffer,
    resolveCharity,
    attemptTheft,
    stream,
    contentAssetURL,
  };
}

function clientLobbyResult(response: unknown): LobbyResult {
  const parsed = lobbyResultSchema.parse(response);
  return {
    ...parsed,
    projection: clientProjection(parsed.projection),
  };
}

function clientCommandResult(response: unknown): CommandResult {
  const parsed = commandResultSchema.parse(response);
  return {
    ...parsed,
    projection: clientProjection(parsed.projection),
  };
}

function clientProjection(response: unknown): Projection {
  return projectionSchema.parse(response);
}

export function parseGameProjection(response: unknown): Projection {
  try {
    return clientProjection(response);
  } catch (error) {
    throw normalizeGameApiError(error);
  }
}

export function buildContentAssetURL(
  baseURL: string,
  setID: string,
  image: string,
) {
  const relativePath = image.startsWith("assets/")
    ? image.slice("assets/".length)
    : image;
  const safePath = relativePath.split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${baseURL.replace(/\/$/, "")}/api/v1/content/${encodeURIComponent(setID)}/assets/${safePath}`;
}

function authorization(credential: string) {
  return {Authorization: `Bearer ${credential}`};
}

function randomCredential() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function requestGameplay<T>(
  request: () => Promise<unknown>,
  parse: (response: unknown) => T,
): Promise<T> {
  try {
    return parse(await request());
  } catch (error) {
    throw normalizeGameApiError(error);
  }
}

function parseClientRequest<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    throw new GameApiError(
      "validation",
      safeGameApiMessage("validation"),
      {cause: error},
    );
  }
}
