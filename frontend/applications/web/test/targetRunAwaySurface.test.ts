import {describe, expect, it} from "vitest";

import {
  buildCommandPayload,
  selectionIsValid,
} from "../app/components/actionModel";
import {
  interactionCanDismiss,
} from "../app/components/interaction/interactionModel";
import {
  runAwayAttemptMonsterName,
  runAwayAttemptPlayerName,
  runAwayAttemptResult,
  runAwayAttemptRoll,
  runAwayCurrentPlayerName,
  runAwayEffectLabel,
  runAwayMonsterName,
  targetRunAwayActionDetails,
  targetRunAwayActionLabel,
} from "../app/components/interaction/targetRunAwayModel";
import {createFixtureAdapter} from "./fixtures/fixtureAdapter";

const fixtures = createFixtureAdapter();

describe("target and Run Away projection surface", () => {
  it("accepts only the initiator target IDs from the action descriptor", () => {
    const projection = fixtures.getProjection("target-initiator");
    const action = projection.turn.available_actions[0];
    if (!action) {
      throw new Error("target initiator descriptor is missing");
    }

    expect(action.type).toBe("play_target_effect");
    expect(action.target_player_ids).toEqual(["player_1"]);
    expect(selectionIsValid(action, [], "player_1")).toBe(true);
    expect(selectionIsValid(action, [], "forged-player")).toBe(false);
    expect(buildCommandPayload(action, [], "player_1")).toEqual({
      instance_id: "target-effect-card",
      target_player_id: "player_1",
    });
  });

  it("keeps target counters opaque while exposing a public target and pass", () => {
    const projection = fixtures.getProjection("target-response");
    const interaction = projection.interaction;
    if (!interaction) {
      throw new Error("target response interaction is missing");
    }
    const counter = interaction.actions.find((action) => action.target_effect_id);
    if (!counter) {
      throw new Error("target counter descriptor is missing");
    }

    const details = targetRunAwayActionDetails(
      counter,
      projection,
      projection.you.hand,
      interaction,
    ).join(" · ");
    expect(targetRunAwayActionLabel(counter, 1, projection.you.hand))
      .toBe("Контрдействие на эффект");
    expect(details).toContain("Борис");
    expect(details).toContain("Запасной план");
    expect(details).not.toContain(counter.target_effect_id ?? "");
    expect(interaction.actions.some((action) => action.type === "pass")).toBe(true);
    expect(interaction.actions).not.toContainEqual(expect.objectContaining({
      source_instance_id: "foreign-hidden-card",
    }));
  });

  it("maps private choices to own cards and keeps a mandatory window open", () => {
    const projection = fixtures.getProjection("target-private-choice");
    const interaction = projection.interaction;
    if (!interaction) {
      throw new Error("private choice interaction is missing");
    }
    const choice = interaction.actions[0];
    if (!choice) {
      throw new Error("private choice descriptor is missing");
    }

    expect(targetRunAwayActionLabel(choice, 0, projection.you.hand))
      .toContain("Карта с длинным названием");
    expect(targetRunAwayActionDetails(
      choice,
      projection,
      projection.you.hand,
      interaction,
    ).join(" · ")).toContain("Карта с длинным названием");
    expect(interactionCanDismiss(interaction)).toBe(false);
    expect(interaction.actions).not.toContainEqual(expect.objectContaining({
      choice_ids: ["foreign-hidden-choice"],
    }));
  });

  it("renders Run Away attempts and effects only from confirmed projection data", () => {
    const projection = fixtures.getProjection("run-away-response");
    const interaction = projection.interaction;
    const runAway = projection.turn.run_away;
    if (!interaction || !runAway) {
      throw new Error("Run Away fixture is incomplete");
    }
    const modifier = interaction.actions.find((action) => action.escape_delta);
    const attempt = runAway.attempts[0];
    const effect = runAway.effects[0];
    if (!modifier || !attempt || !effect) {
      throw new Error("Run Away descriptors are incomplete");
    }

    expect(runAwayCurrentPlayerName(projection)).toBe("Борис");
    expect(runAwayMonsterName(projection, runAway.current_monster_instance_id))
      .toBe("Городской монстр с длинным русским описанием");
    expect(runAwayAttemptPlayerName(projection, attempt)).toBe("Алиса");
    expect(runAwayAttemptMonsterName(projection, attempt))
      .toBe("Городской монстр с длинным русским описанием");
    expect(runAwayAttemptRoll(attempt)).toBe("D6 2 +0 = 2");
    expect(runAwayAttemptResult(attempt)).toContain("Bad Stuff");
    expect(runAwayEffectLabel(effect)).toBe("Модификатор побега +2");
    expect(runAwayEffectLabel(effect)).not.toContain(effect.effect_id);

    const details = targetRunAwayActionDetails(
      modifier,
      projection,
      projection.you.hand,
      interaction,
    ).join(" · ");
    expect(details).toContain("бросок D6 выполняет сервер");
    expect(details).not.toContain("roll");
  });

  it("preserves ordered multi-monster results and observer privacy", () => {
    const resultProjection = fixtures.getProjection("run-away-result");
    const attempts = resultProjection.turn.run_away?.attempts ?? [];
    expect(attempts).toHaveLength(2);
    expect(attempts[0] && runAwayAttemptResult(attempts[0])).toContain("Bad Stuff");
    expect(attempts[1] && runAwayAttemptResult(attempts[1])).toContain("Побег подтверждён");
    expect(attempts[1] && runAwayAttemptMonsterName(resultProjection, attempts[1]))
      .toBe("Гидра из справок");

    expect(fixtures.getProjection("target-observer").interaction?.actions).toEqual([]);
    expect(fixtures.getProjection("run-away-observer").interaction?.actions).toEqual([]);
  });
});
