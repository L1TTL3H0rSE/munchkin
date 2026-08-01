import {describe, expect, it} from "vitest";

import {
  createInteractionCountdown,
  remainingMilliseconds,
  type InteractionCountdownScheduler,
} from "../app/composables/useInteractionCountdown";

class FakeInterval implements InteractionCountdownScheduler {
  callback: (() => void) | undefined;
  setCalls = 0;
  clearCalls = 0;

  setInterval(callback: () => void): unknown {
    this.callback = callback;
    this.setCalls++;
    return "interval";
  }

  clearInterval(): void {
    this.callback = undefined;
    this.clearCalls++;
  }

  tick(): void {
    this.callback?.();
  }
}

describe("interaction countdown", () => {
  it("derives a non-negative advisory duration from server timestamps", () => {
    expect(remainingMilliseconds(
      "2030-01-01T00:05:00.000Z",
      "2030-01-01T00:04:00.000Z",
    )).toBe(60_000);
    expect(remainingMilliseconds(
      "2030-01-01T00:03:00.000Z",
      "2030-01-01T00:04:00.000Z",
    )).toBe(0);
    expect(remainingMilliseconds("bad", "bad")).toBe(0);
  });

  it("uses monotonic elapsed time and clamps at zero", () => {
    let now = 10_000;
    const scheduler = new FakeInterval();
    const countdown = createInteractionCountdown({
      deadlineAt: "2030-01-01T00:05:00.000Z",
      serverTime: "2030-01-01T00:04:00.000Z",
      clock: () => now,
      scheduler,
    });
    countdown.start();

    now += 1_250;
    scheduler.tick();
    expect(countdown.remainingMs.value).toBe(58_750);
    expect(countdown.remainingSeconds.value).toBe(59);

    now += 60_000;
    scheduler.tick();
    expect(countdown.remainingMs.value).toBe(0);
    expect(countdown.expired.value).toBe(true);
  });

  it("atomically replaces a deadline without stacking timers", () => {
    let now = 2_000;
    const scheduler = new FakeInterval();
    const countdown = createInteractionCountdown({
      deadlineAt: "2030-01-01T00:05:00.000Z",
      serverTime: "2030-01-01T00:04:00.000Z",
      clock: () => now,
      scheduler,
    });
    countdown.start();
    countdown.start();
    expect(scheduler.setCalls).toBe(1);

    now += 100;
    countdown.update(
      "2030-01-01T00:10:00.000Z",
      "2030-01-01T00:09:00.000Z",
    );
    expect(countdown.remainingMs.value).toBe(60_000);
    expect(scheduler.setCalls).toBe(1);
    countdown.stop();
    expect(scheduler.clearCalls).toBe(1);
  });
});
