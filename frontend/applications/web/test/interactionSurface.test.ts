import {describe, expect, it} from "vitest";

import {
  actionIsSelectable,
  interactionActionDescription,
  interactionActionIntent,
  interactionCanDismiss,
  interactionIsTerminal,
  interactionResponseMessage,
  interactionRevisionKey,
  interactionTitle,
} from "../app/components/interaction/interactionModel";
import {createFixtureAdapter} from "./fixtures/fixtureAdapter";

const fixtures = createFixtureAdapter();

describe("generic interaction surface model", () => {
  it("keeps a required pass-only interaction visible and non-dismissible", () => {
    const projection = fixtures.getProjection("interaction-pass-only");
    const interaction = projection.interaction;
    if (!interaction) {
      throw new Error("pass-only fixture has no interaction");
    }
    const action = interaction.actions[0];

    expect(interactionTitle(interaction)).toBe("Открытое решение");
    expect(interactionCanDismiss(interaction)).toBe(false);
    expect(action && actionIsSelectable(action)).toBe(true);
    expect(action && interactionActionIntent(action)).toBe("pass");
  });

  it("keeps mandatory material response non-dismissible without inventing options", () => {
    const projection = fixtures.getProjection("interaction-material");
    const interaction = projection.interaction;
    if (!interaction) {
      throw new Error("material fixture has no interaction");
    }
    const mandatory = {
      ...interaction,
      actions: interaction.actions.filter((action) => action.type !== "pass"),
      response_required_for_you: true,
    };
    const response = mandatory.actions[0];
    if (!response) {
      throw new Error("material response action is missing");
    }

    expect(interactionCanDismiss(mandatory)).toBe(false);
    expect(actionIsSelectable(response)).toBe(true);
    expect(interactionActionDescription(response, projection.you.hand))
      .toContain("Источник: Запасной план");
  });

  it("keeps an opaque no-action window visible without exposing foreign state", () => {
    const projection = fixtures.getProjection("interaction-opaque");
    const interaction = projection.interaction;
    if (!interaction) {
      throw new Error("opaque fixture has no interaction");
    }

    expect(interaction.actions).toHaveLength(0);
    expect(interactionCanDismiss(interaction)).toBe(true);
    expect(interactionIsTerminal(interaction)).toBe(false);
    expect(interactionResponseMessage(undefined)).toBe("");
  });

  it("reconciles selection by interaction revision and response state", () => {
    const projection = fixtures.getProjection("interaction-pass-only");
    const interaction = projection.interaction;
    if (!interaction) {
      throw new Error("pass-only fixture has no interaction");
    }

    const initialKey = interactionRevisionKey(interaction);
    const passedKey = interactionRevisionKey({
      ...interaction,
      my_response_state: "passed",
    });

    expect(passedKey).not.toBe(initialKey);
    expect(interactionIsTerminal({
      ...interaction,
      my_response_state: "passed",
    })).toBe(true);
    expect(interactionResponseMessage("passed"))
      .toBe("Ваш пас принят текущей версией окна.");
  });

  it("does not submit specialized helper descriptors through generic intents", () => {
    const projection = fixtures.getProjection("helper-offer");
    const interaction = projection.interaction;
    if (!interaction) {
      throw new Error("helper fixture has no interaction");
    }
    const offer = interaction.actions[0];
    if (!offer) {
      throw new Error("helper action is missing");
    }

    expect(offer.type).toBe("offer_help");
    expect(actionIsSelectable(offer)).toBe(false);
    expect(interactionActionIntent(offer)).toBeUndefined();
  });
});
