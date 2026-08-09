import {
  invalidationSchema,
  type Invalidation,
} from "@munchkin/contracts";

import {
  GameApiError,
  GameTransportError,
  safeGameApiMessage,
} from "./apiErrors";

export function createVersionedResync(options: {
  getVersion: () => number | undefined;
  refresh: () => Promise<void>;
  maxDrainPasses?: number;
}) {
  let pendingVersion: number | undefined;
  let requestedRefreshGeneration = 0;
  let completedRefreshGeneration = 0;
  let inFlight: Promise<void> | undefined;

  async function drain() {
    let passes = 0;
    for (;;) {
      passes++;
      const targetGeneration = requestedRefreshGeneration;
      await options.refresh();
      completedRefreshGeneration = Math.max(
        completedRefreshGeneration,
        targetGeneration,
      );
      const currentVersion = options.getVersion();
      const versionSatisfied = pendingVersion === undefined ||
        (currentVersion !== undefined && currentVersion >= pendingVersion);
      if (
        versionSatisfied &&
        completedRefreshGeneration >= requestedRefreshGeneration
      ) {
        return;
      }
      if (passes >= (options.maxDrainPasses ?? 3)) {
        throw new GameApiError(
          "transient",
          safeGameApiMessage("transient"),
        );
      }
    }
  }

  function request(requiredVersion?: number) {
    if (requiredVersion === undefined) {
      requestedRefreshGeneration++;
    } else {
      pendingVersion = Math.max(
        pendingVersion ?? requiredVersion,
        requiredVersion,
      );
    }
    if (!inFlight) {
      inFlight = drain().finally(() => {
        inFlight = undefined;
      });
    }
    return inFlight;
  }

  return {request};
}

export async function consumeGameStream(
  url: string,
  credential: string,
  signal: AbortSignal,
  onInvalidation: (event: Invalidation) => void,
  onConnected?: () => void,
) {
  const response = await fetch(url, {
    headers: {Authorization: `Bearer ${credential}`},
    signal,
  });
  if (!response.ok || !response.body) {
    throw new GameTransportError(response.status);
  }
  onConnected?.();
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", {fatal: true});
  let buffer = "";
  for (;;) {
    const {done, value} = await reader.read();
    if (done) {
      break;
    }
    try {
      buffer += decoder.decode(value, {stream: true});
    } catch (error) {
      throw new GameApiError(
        "protocol",
        safeGameApiMessage("protocol"),
        {cause: error},
      );
    }
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
      let event: Invalidation;
      try {
        const payload: unknown = JSON.parse(data);
        event = invalidationSchema.parse(payload);
      } catch (error) {
        throw new GameApiError(
          "protocol",
          safeGameApiMessage("protocol"),
          {cause: error},
        );
      }
      onInvalidation(event);
    }
  }
  try {
    decoder.decode();
  } catch (error) {
    throw new GameApiError(
      "protocol",
      safeGameApiMessage("protocol"),
      {cause: error},
    );
  }
  throw new GameApiError("offline", safeGameApiMessage("offline"));
}
