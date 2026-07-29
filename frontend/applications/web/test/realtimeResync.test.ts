import {describe, expect, it} from "vitest";
import {createVersionedResync} from "../app/composables/useGameApi";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return {promise, resolve};
}

describe("versioned realtime resync", () => {
  it("drains an invalidation that arrives during an older refresh", async () => {
    let version = 1;
    const refreshes: ReturnType<typeof deferred>[] = [];
    const controller = createVersionedResync({
      getVersion: () => version,
      refresh: () => {
        const next = deferred();
        refreshes.push(next);
        return next.promise;
      },
    });

    const first = controller.request(2);
    expect(refreshes).toHaveLength(1);
    const second = controller.request(3);

    version = 2;
    refreshes[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(refreshes).toHaveLength(2);

    version = 3;
    refreshes[1].resolve();
    await Promise.all([first, second]);
    expect(refreshes).toHaveLength(2);
    expect(version).toBe(3);
  });

  it("runs another pass for a forced resync requested in flight", async () => {
    const refreshes: ReturnType<typeof deferred>[] = [];
    const controller = createVersionedResync({
      getVersion: () => 7,
      refresh: () => {
        const next = deferred();
        refreshes.push(next);
        return next.promise;
      },
    });

    const first = controller.request();
    const second = controller.request();
    refreshes[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(refreshes).toHaveLength(2);

    refreshes[1].resolve();
    await Promise.all([first, second]);
    expect(refreshes).toHaveLength(2);
  });

  it("clears a failed pass so a later recovery request can retry", async () => {
    let version = 1;
    let calls = 0;
    const controller = createVersionedResync({
      getVersion: () => version,
      refresh: async () => {
        calls++;
        if (calls === 1) {
          throw new Error("temporary GET failure");
        }
        version = 2;
      },
    });

    await expect(controller.request(2)).rejects.toThrow("temporary GET failure");
    await controller.request();
    expect(calls).toBe(2);
    expect(version).toBe(2);
  });
});
