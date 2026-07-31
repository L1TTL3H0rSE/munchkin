import {createFixtureAdapter} from "../../test/fixtures/fixtureAdapter.ts";

export default defineNuxtPlugin(() => {
  const fixtureAdapter = import.meta.dev
    ? createFixtureAdapter()
    : null;
  return {
    provide: {
      uiFixture: fixtureAdapter,
    },
  };
});
