import {readFileSync} from "node:fs";
import {afterEach, describe, expect, it, vi} from "vitest";
import {projectionSchema} from "@munchkin/contracts";
import {useGameApi} from "../app/composables/useGameApi";

const projection = projectionSchema.parse(
  JSON.parse(readFileSync(new URL(
    "../../../../backend/game/internal/transport/httpapi/testdata/"
      + "interaction-projection-v1.json",
    import.meta.url,
  ), "utf8")) as unknown,
);
if (!projection.interaction) {
  throw new Error("interaction fixture was not parsed");
}
const interaction = projection.interaction;
const passAction = interaction.actions.find((action) => action.type === "pass");
if (!passAction) {
  throw new Error("pass action was not parsed");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("interaction API adapter", () => {
  it("sends the closed pass intent to the dedicated route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      game_id: projection.game_id,
      command_id: "command_fixture",
      version: projection.version,
      replayed: false,
      projection,
    });
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {apiBase: "https://game.example.test"},
    }));
    vi.stubGlobal("$fetch", fetchMock);

    const result = await useGameApi().interaction(
      projection.game_id,
      "credential",
      projection.version,
      interaction.interaction_id,
      passAction.action_id,
      "pass",
    );

    expect(result.projection.interaction?.interaction_id)
      .toBe(interaction.interaction_id);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://game.example.test/api/v1/games/game_fixture/"
        + "commands/pass-interaction",
    );
    expect(options.body).toEqual({
      expected_version: 7,
      interaction_id: "interaction_0123456789abcdef",
      action_id: "act_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      intent: "pass",
    });
    expect(options.body).not.toHaveProperty("actor_id");
    expect(options.body).not.toHaveProperty("deadline_revision");
  });

  it("rejects an invalid action ID before transport", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {apiBase: "https://game.example.test"},
    }));
    vi.stubGlobal("$fetch", fetchMock);

    await expect(useGameApi().interaction(
      projection.game_id,
      "credential",
      projection.version,
      interaction.interaction_id,
      "forged",
      "respond",
    )).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
