import type {Preview} from "@storybook/vue3-vite";
import "../src/assets/scss/main.scss";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    viewport: {
      options: {
        wide: {name: "1440 × 900", styles: {width: "1440px", height: "900px"}},
        compact: {name: "360 × 640", styles: {width: "360px", height: "640px"}},
      },
    },
  },
  decorators: [(_story, context) => ({
    template: '<div class="app-shell" :class="{\'app-shell--lobby\': isLobby}"><main id="main-content" class="app-main"><story /></main></div>',
    setup() {
      return {isLobby: context.parameters.lobby === true};
    },
  })],
};
export default preview;
