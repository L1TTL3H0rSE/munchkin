declare module "vitest/browser" {
  interface BrowserCommands {
    /** Moves the pointer outside the frame; declared in vitest.config.ts. */
    parkPointer: () => Promise<void>;
  }
}

export {};
