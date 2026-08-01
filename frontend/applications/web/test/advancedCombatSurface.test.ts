import {describe, expect, it} from "vitest";

import {
  advancedCombatActionDetails,
  advancedCombatActionLabel,
  advancedCombatActions,
  combatEffectLabel,
  combatEffectTarget,
  combatEffects,
  combatMonsters,
} from "../app/components/interaction/advancedCombatModel";
import {createFixtureAdapter} from "./fixtures/fixtureAdapter";

const fixtures = createFixtureAdapter();

describe("advanced combat projection surface", () => {
  it("maps only descriptor-backed capabilities and public targets", () => {
    const projection = fixtures.getProjection("advanced-combat");
    const interaction = projection.interaction;
    if (!interaction) {
      throw new Error("advanced combat fixture has no interaction");
    }

    const actions = advancedCombatActions(interaction.actions);
    expect(actions).toHaveLength(4);
    const enhance = actions.find((action) =>
      action.combat_capability === "enhance_monster",
    );
    const counter = actions.find((action) =>
      action.combat_capability === "counter_combat_effect",
    );
    if (!enhance || !counter) {
      throw new Error("advanced descriptors are missing");
    }

    expect(advancedCombatActionLabel(enhance)).toBe("Усилить монстра");
    expect(advancedCombatActionDetails(
      enhance,
      projection,
      projection.you.hand,
    ).join(" · ")).toContain("Гидра из справок");
    expect(advancedCombatActionDetails(
      counter,
      projection,
      projection.you.hand,
    ).join(" · ")).toContain("Усиление монстра 1");
    expect(advancedCombatActionDetails(
      counter,
      projection,
      projection.you.hand,
    ).join(" · ")).not.toContain(counter.target_effect_id ?? "");
  });

  it("keeps forced helper mandatory and free of invented reward terms", () => {
    const projection = fixtures.getProjection("advanced-forced-helper");
    const action = advancedCombatActions(projection.interaction?.actions ?? [])[0];
    if (!action) {
      throw new Error("forced helper descriptor is missing");
    }

    expect(advancedCombatActionLabel(action)).toBe("Принудительная помощь");
    const details = advancedCombatActionDetails(action, projection, projection.you.hand);
    expect(details.join(" · ")).toContain("Борис");
    expect(details.join(" · ")).not.toContain("Наград");
    expect(projection.interaction?.actions).toHaveLength(1);
    expect(projection.interaction?.actions.some((candidate) =>
      candidate.type === "decline",
    )).toBe(false);
  });

  it("renders multi-monster and active effect state from the projection", () => {
    const projection = fixtures.getProjection("advanced-observer");
    const effects = combatEffects(projection);

    expect(combatMonsters(projection)).toHaveLength(2);
    expect(effects).toHaveLength(1);
    expect(combatEffectLabel(projection, effects[0]?.effect_id))
      .toBe("Усиление монстра 1");
    expect(effects[0] && combatEffectTarget(projection, effects[0]))
      .toBe("Гидра из справок");
    expect(projection.interaction?.actions).toEqual([]);
  });
});
