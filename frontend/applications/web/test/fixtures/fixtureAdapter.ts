import type {Projection} from "@munchkin/contracts";

import {
  parseFixtureProjection,
  parsedFixtureCatalog,
  type UiFixtureConnectionState,
  type UiFixtureDefinition,
} from "./fixtureData.ts";

export interface UiFixtureAdapter {
  list: () => readonly UiFixtureDefinition[];
  get: (fixtureID: string) => UiFixtureDefinition;
  getProjection: (fixtureID: string) => Projection;
}

const fixtureMap = new Map(
  parsedFixtureCatalog.map((fixture) => [fixture.id, fixture]),
);

function cloneProjection(projection: Projection): Projection {
  return parseFixtureProjection(structuredClone(projection));
}

export function createFixtureAdapter(
  defaultFixtureID = "single-combat",
): UiFixtureAdapter {
  const get = (fixtureID: string): UiFixtureDefinition => {
    const fixture = fixtureMap.get(fixtureID) ?? fixtureMap.get(defaultFixtureID);
    if (!fixture) {
      throw new Error(`Unknown UI fixture: ${fixtureID}`);
    }
    return {
      ...fixture,
      projection: cloneProjection(fixture.projection),
    };
  };

  return {
    list: () => parsedFixtureCatalog.map((fixture) => ({
      ...fixture,
      projection: cloneProjection(fixture.projection),
    })),
    get,
    getProjection: (fixtureID) => cloneProjection(get(fixtureID).projection),
  };
}

export type {UiFixtureConnectionState, UiFixtureDefinition};

export const fixtureAdapter = createFixtureAdapter();
