declare module "vitest/browser" {
  interface BrowserCommands {
    /** Moves the pointer outside the frame; declared in vitest.config.ts. */
    parkPointer: () => Promise<void>;
    /** Playwright media emulation for the test page (reduced motion, forced colors). */
    emulateMedia: (options: {reducedMotion?: "reduce" | "no-preference"; forcedColors?: "active" | "none"}) => Promise<void>;
  }
}

export {};
