import {createHash} from "node:crypto";
import type {StudioArtBrief} from "@munchkin/contracts";
import {StudioError} from "./errors";

const MIMIC_REQUEST = /(?:in\s+the\s+style\s+of|в\s+стиле|скопир\w*|munchkin|манчкин|trade\s*dress|как\s+у\s+художника)/iu;

const CARD_ART_MASTER_PROMPT = [
  "Create one original portrait illustration for an independent humorous fantasy card project.",
  "Master visual language: hand-inked humorous fantasy cartoon with lively imperfect linework, bold readable silhouettes and flat limited colors with sparse shading.",
  "Give the main subject an expressive pose and facial expression, build one clear readable visual joke, and keep the background simple and uncluttered.",
].join("\n");

export function compileCardArtPrompt(
  cardName: string,
  brief: StudioArtBrief,
) {
  assertBriefPolicy(brief);
  const fields = {
    card: normalized(cardName),
    subject: normalized(brief.subject),
    setting: normalized(brief.setting),
    action: normalized(brief.action),
    composition: normalized(brief.composition),
    palette: normalized(brief.palette),
    mood: normalized(brief.mood),
    exclusions: normalized(brief.exclusions),
  };
  const prompt = [
    CARD_ART_MASTER_PROMPT,
    "The raster is illustration only, never a finished card.",
    "Composition boundary: opaque 1024x1536 portrait; one clear focal subject; keep generous crop-safe margins around the subject and important props.",
    `Original card name for subject context only: ${fields.card}. Do not render this name.`,
    `Subject: ${fields.subject}.`,
    `Setting: ${fields.setting}.`,
    `Action: ${fields.action}.`,
    `Composition: ${fields.composition}.`,
    `Palette: ${fields.palette}.`,
    `Mood: ${fields.mood}.`,
    `Additional exclusions: ${fields.exclusions}.`,
    "Hard exclusions: no text, no words, no letters, numbers or captions; no logos, trademarks, signatures or watermarks; no card border, frame, stats, stat boxes, UI, typography or finished-card layout; do not imitate or reproduce a named artist, existing tabletop product, published illustration or commercial trade dress.",
    "Use original characters, creatures, props and city details only.",
  ].join("\n");
  return {
    prompt,
    prompt_hash: sha256(prompt),
  };
}

export function assertBriefPolicy(brief: StudioArtBrief) {
  for (const value of Object.values(brief)) {
    if (MIMIC_REQUEST.test(value)) {
      throw new StudioError(
        "INVALID_REQUEST",
        "Brief не должен копировать художника, продукт, рамку или trade dress.",
        400,
      );
    }
  }
}

export function sha256(value: string | Buffer) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function normalized(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}
