import {
  computed,
  onBeforeUnmount,
  readonly,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

export interface InteractionCountdownScheduler {
  setInterval: (callback: () => void, delayMs: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

export interface InteractionCountdownOptions {
  deadlineAt?: string;
  serverTime?: string;
  clock?: () => number;
  scheduler?: InteractionCountdownScheduler;
  tickMs?: number;
}

const defaultScheduler: InteractionCountdownScheduler = {
  setInterval: (callback, delayMs) => setInterval(callback, delayMs),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

function defaultClock(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export function remainingMilliseconds(
  deadlineAt: string | undefined,
  serverTime: string | undefined,
): number {
  if (!deadlineAt || !serverTime) {
    return 0;
  }
  const deadline = Date.parse(deadlineAt);
  const server = Date.parse(serverTime);
  if (!Number.isFinite(deadline) || !Number.isFinite(server)) {
    return 0;
  }
  return Math.max(0, deadline - server);
}

export function createInteractionCountdown(
  options: InteractionCountdownOptions = {},
) {
  const scheduler = options.scheduler ?? defaultScheduler;
  const clock = options.clock ?? defaultClock;
  const tickMs = Math.max(100, options.tickMs ?? 250);
  const remainingMs = ref(remainingMilliseconds(
    options.deadlineAt,
    options.serverTime,
  ));

  let initialRemainingMs = remainingMs.value;
  let startedAt = clock();
  let intervalHandle: unknown;

  function tick(): void {
    remainingMs.value = Math.max(
      0,
      initialRemainingMs - Math.max(0, clock() - startedAt),
    );
  }

  function update(deadlineAt?: string, serverTime?: string): void {
    initialRemainingMs = remainingMilliseconds(deadlineAt, serverTime);
    startedAt = clock();
    tick();
  }

  function start(): void {
    if (intervalHandle !== undefined) {
      return;
    }
    tick();
    intervalHandle = scheduler.setInterval(tick, tickMs);
  }

  function stop(): void {
    if (intervalHandle === undefined) {
      return;
    }
    scheduler.clearInterval(intervalHandle);
    intervalHandle = undefined;
  }

  function dispose(): void {
    stop();
  }

  return {
    remainingMs: readonly(remainingMs),
    remainingSeconds: computed(() => Math.ceil(remainingMs.value / 1000)),
    expired: computed(() => remainingMs.value <= 0),
    update,
    start,
    stop,
    dispose,
  };
}

export function useInteractionCountdown(
  deadlineAt: MaybeRefOrGetter<string | undefined>,
  serverTime: MaybeRefOrGetter<string | undefined>,
  options: Omit<InteractionCountdownOptions, "deadlineAt" | "serverTime"> = {},
) {
  const countdown = createInteractionCountdown(options);

  watch(
    [
      () => toValue(deadlineAt),
      () => toValue(serverTime),
    ],
    ([nextDeadline, nextServerTime]) => {
      countdown.update(nextDeadline, nextServerTime);
      if (nextDeadline && nextServerTime) {
        countdown.start();
      } else {
        countdown.stop();
      }
    },
    {immediate: true},
  );

  onBeforeUnmount(countdown.dispose);
  return countdown;
}
