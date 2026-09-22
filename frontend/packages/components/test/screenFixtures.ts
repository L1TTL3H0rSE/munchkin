import {fn} from "storybook/test";
import {buildRouteSystemState} from "../src/components/game/status/systemStateModel";
import {fixtureAdapter} from "./fixtures/fixtureAdapter";

export function gameScreenArgs(fixtureID: string) {
  if (!fixtureAdapter.list().some((fixture) => fixture.id === fixtureID)) {
    throw new Error(`Unknown screen fixture: ${fixtureID}`);
  }
  const fixture = fixtureAdapter.get(fixtureID);
  return {
    routeState: buildRouteSystemState({
      hydrated: true,
      loading: false,
      projection: fixture.projection,
      errorKind: null,
    }),
    connectionState: "connected" as const,
    errorKind: null,
    errorMessage: "",
    interactionError: "",
    actionBusy: false,
    isBusy: false,
    onRetry: fn(),
    onExecute: fn(),
    "onSubmit-interaction": fn(),
    "onSubmit-economy": fn(),
  };
}
