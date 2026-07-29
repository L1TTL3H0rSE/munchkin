import {
  commandResultSchema,
  invalidationSchema,
  lobbyResultSchema,
  lobbySummarySchema,
  projectionSchema,
  type Invalidation,
  type Projection,
} from "@munchkin/contracts";

type CommandName = "start" | "open-door" | "fight" | "run-away" | "loot" | "end-turn";

export function useGameApi() {
  const config = useRuntimeConfig();
  const baseURL = String(config.public.apiBase).replace(/\/$/, "");

  async function createLobby(displayName: string) {
    const response = await $fetch(`${baseURL}/api/v1/lobbies`, {
      method: "POST",
      body: {display_name: displayName},
    });
    return lobbyResultSchema.parse(response);
  }

  async function getLobby(gameID: string) {
    const response = await $fetch(
      `${baseURL}/api/v1/lobbies/${encodeURIComponent(gameID)}`,
    );
    return lobbySummarySchema.parse(response);
  }

  async function joinLobby(gameID: string, displayName: string, expectedVersion: number) {
    const credential = randomCredential();
    const commandID = crypto.randomUUID();
    const request = () => $fetch(
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
    );
    let response;
    try {
      response = await request();
    } catch (error) {
      const status = (error as {response?: {status?: number}}).response?.status;
      if (status && status < 500) {
        throw error;
      }
      response = await request();
    }
    return lobbyResultSchema.parse(response);
  }

  async function getGame(gameID: string, credential: string) {
    const response = await $fetch(`${baseURL}/api/v1/games/${encodeURIComponent(gameID)}`, {
      headers: authorization(credential),
    });
    return projectionSchema.parse(response);
  }

  async function command(
    gameID: string,
    credential: string,
    name: CommandName,
    expectedVersion: number,
  ) {
    const path = name === "start" ? "start" : `commands/${name}`;
    const commandID = crypto.randomUUID();
    const response = await $fetch(`${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/${path}`, {
      method: "POST",
      headers: {
        ...authorization(credential),
        "Idempotency-Key": commandID,
      },
      body: {expected_version: expectedVersion},
    });
    return commandResultSchema.parse(response);
  }

  function stream(
    gameID: string,
    credential: string,
    onInvalidation: (event: Invalidation) => void,
    onDisconnect: (error?: unknown) => void,
  ) {
    const controller = new AbortController();
    void consumeStream(
      `${baseURL}/api/v1/games/${encodeURIComponent(gameID)}/events`,
      credential,
      controller.signal,
      onInvalidation,
    ).catch((error) => {
      if (!controller.signal.aborted) {
        onDisconnect(error);
      }
    });
    return () => controller.abort();
  }

  function contentAssetURL(setID: string, image: string) {
    const safePath = image.split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${baseURL}/api/v1/content/${encodeURIComponent(setID)}/${safePath}`;
  }

  return {createLobby, getLobby, joinLobby, getGame, command, stream, contentAssetURL};
}

async function consumeStream(
  url: string,
  credential: string,
  signal: AbortSignal,
  onInvalidation: (event: Invalidation) => void,
) {
  const response = await fetch(url, {
    headers: authorization(credential),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`realtime request failed: ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", {fatal: true});
  let buffer = "";
  for (;;) {
    const {done, value} = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, {stream: true});
    for (;;) {
      const boundary = buffer.indexOf("\n\n");
      if (boundary < 0) {
        break;
      }
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = frame.split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6);
      if (!data) {
        continue;
      }
      onInvalidation(invalidationSchema.parse(JSON.parse(data)));
    }
  }
  decoder.decode();
  throw new Error("realtime stream ended");
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

export function isMyTurn(projection: Projection) {
  return projection.status === "active" && projection.turn.player_id === projection.you.player_id;
}
