import {describe, expect, it} from "vitest";

import {
  buildConnectionPresentation,
  buildRouteSystemState,
  buildSystemSurface,
} from "../app/components/game/status/systemStateModel";

const projection = {
  game_id: "fixture-system",
  version: 3,
  status: "active" as const,
  is_owner: true,
  you: {
    player_id: "player_hero",
    name: "Алиса",
    level: 2,
    combat_strength: 4,
    strength_breakdown: {
      base_strength: 2,
      equipment_bonus: 0,
      temporary_bonus: 2,
      total_strength: 4,
      hand_count: 0,
    },
    escape_bonus: 1,
    hand_limit: 5,
    character_tags: [],
    hand: [],
    carried: [],
    equipped: [],
    traits: [],
    attachments: [],
    persistent_curses: [],
    setup_done: true,
    dead: false,
    needs_redraw: false,
  },
  players: [{
    player_id: "player_other",
    name: "Борис",
    level: 2,
    hand_count: 2,
    carried: [],
    equipped: [],
    traits: [],
    attachments: [],
    persistent_curses: [],
    setup_done: true,
    dead: false,
  }],
  turn: {
    player_id: "player_other",
    phase: "preparation" as const,
    resolving: [],
    available_actions: [],
  },
  door_deck_count: 1,
  door_discard_count: 0,
  treasure_deck_count: 1,
  treasure_discard_count: 0,
  content_set_id: "demo-original",
  content_version: 2,
  rules_profile_id: "demo",
  rules_profile_version: 1,
};

describe("system state presentation", () => {
  it("keeps connected state silent and makes automatic recovery compact", () => {
    expect(buildConnectionPresentation("connected", null, true).visible)
      .toBe(false);
    expect(buildConnectionPresentation("offline", "offline", true))
      .toMatchObject({
        label: "Связь потеряна",
        canRetry: false,
        ariaBusy: true,
      });
    expect(buildConnectionPresentation("failed", "transient", true))
      .toMatchObject({
        label: "Не удалось восстановить связь",
        canRetry: true,
      });
  });

  it("maps terminal errors without exposing backend copy", () => {
    expect(buildRouteSystemState({
      hydrated: true,
      loading: false,
      projection: null,
      errorKind: "not_found",
    })).toEqual({kind: "not-found"});
    expect(buildSystemSurface("protocol").description)
      .not.toContain("Error");
  });

  it("keeps the last projection and renders a server-confirmed winner", () => {
    expect(buildRouteSystemState({
      hydrated: true,
      loading: false,
      projection,
      errorKind: "offline",
    })).toMatchObject({kind: "game", projection});

    const finished = {
      ...projection,
      status: "finished" as const,
      winner_player_id: "player_hero",
    };
    expect(buildRouteSystemState({
      hydrated: true,
      loading: false,
      projection: finished,
      errorKind: null,
    })).toMatchObject({kind: "victory"});
    expect(buildSystemSurface("victory", finished)).toMatchObject({
      title: "Победа подтверждена",
      winnerName: "Алиса",
      primaryAction: "lobby",
    });
  });
});
