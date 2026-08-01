import {describe, expect, it} from "vitest";

import {
  deathLootOptions,
  deathLootParticipants,
  deathLootPassAction,
  deathLootTerminalMessage,
  isDeathLootInteraction,
} from "../app/components/interaction/deathLootModel";
import {fixtureAdapter} from "./fixtures/fixtureAdapter";

describe("death loot surface model", () => {
  it("maps only actor-visible cards to current server descriptors", () => {
    const projection = fixtureAdapter.getProjection("death-loot");
    const interaction = projection.interaction;
    if (!interaction || !isDeathLootInteraction(interaction)) {
      throw new Error("actor fixture must expose death loot interaction");
    }

    const options = deathLootOptions(interaction);

    expect(options.map(({card}) => card.name)).toEqual([
      "Добыча из комнаты",
      "Старый фонарь",
    ]);
    expect(options.map(({action}) => action.choice_ids)).toEqual([
      ["loot-option-1"],
      ["loot-option-2"],
    ]);
    expect(deathLootPassAction(interaction)?.type).toBe("pass");
    expect(deathLootParticipants(projection, interaction)).toHaveLength(5);
    expect(deathLootParticipants(projection, interaction)).not.toContainEqual(
      expect.objectContaining({playerID: "player_2"}),
    );
  });

  it("drops a card when the projection has no matching choice descriptor", () => {
    const projection = fixtureAdapter.getProjection("death-loot");
    const interaction = projection.interaction;
    if (!interaction || !isDeathLootInteraction(interaction)) {
      throw new Error("actor fixture must expose death loot interaction");
    }

    const incomplete = structuredClone(interaction);
    incomplete.death_loot.options.push({
      ...incomplete.death_loot.options[0],
      instance_id: "unbound-loot-option",
      name: "Неизвестная карта",
    });

    expect(deathLootOptions(incomplete).map(({card}) => card.instance_id))
      .toEqual(["loot-option-1", "loot-option-2"]);
  });

  it("keeps observer options and pass opaque while retaining public counts", () => {
    const projection = fixtureAdapter.getProjection("death-loot-observer");
    const interaction = projection.interaction;
    if (!interaction || !isDeathLootInteraction(interaction)) {
      throw new Error("observer fixture must expose death loot interaction");
    }

    expect(interaction.response_required_for_you).toBe(false);
    expect(interaction.death_loot.remaining_count).toBe(2);
    expect(interaction.death_loot.options).toEqual([]);
    expect(deathLootOptions(interaction)).toEqual([]);
    expect(deathLootPassAction(interaction)).toBeUndefined();
  });

  it("does not trust private options if an observer projection is malformed", () => {
    const projection = fixtureAdapter.getProjection("death-loot-observer");
    const interaction = projection.interaction;
    if (!interaction || !isDeathLootInteraction(interaction)) {
      throw new Error("observer fixture must expose death loot interaction");
    }

    const malformed = structuredClone(interaction);
    const actorProjection = fixtureAdapter.getProjection("death-loot");
    const actorInteraction = actorProjection.interaction;
    if (!actorInteraction || !isDeathLootInteraction(actorInteraction)) {
      throw new Error("actor fixture must expose death loot interaction");
    }
    malformed.death_loot.options = [
      actorInteraction.death_loot.options[0]!,
    ];
    malformed.actions = actorInteraction.actions;

    expect(deathLootOptions(malformed)).toEqual([]);
  });

  it("describes an all-pass terminal result without inventing a client transition", () => {
    const projection = fixtureAdapter.getProjection("death-loot-all-pass");
    const interaction = projection.interaction;
    if (!interaction || !isDeathLootInteraction(interaction)) {
      throw new Error("terminal fixture must expose death loot interaction");
    }

    expect(deathLootTerminalMessage(interaction)).toContain("пропустили");
    expect(interaction.death_loot.remaining_count).toBe(0);
    expect(interaction.death_loot.discarded_count).toBe(3);
  });
});
