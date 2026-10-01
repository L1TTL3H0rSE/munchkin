import {afterEach} from "vitest";
import {commands} from "vitest/browser";
import {setProjectAnnotations} from "@storybook/vue3-vite";
import * as previewAnnotations from "../../.storybook/preview";

// Portable stories render with the same decorators, globals and styles as Storybook.
setProjectAnnotations([previewAnnotations]);

// A pointer left over a control would put the next screenshot into :hover.
afterEach(async () => {
  await commands.parkPointer();
});
