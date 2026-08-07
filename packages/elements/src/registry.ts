import type { ElementDef } from "./types.js";
import { slashTearElement } from "./generators/slash-tear.js";
import { chevronArrowElement } from "./generators/chevron-arrow.js";
import { stripeJaggedElement } from "./generators/stripe-jagged.js";
import { bannerCurvedElement } from "./generators/banner-curved.js";
import { textBlockElement } from "./generators/text-block.js";
import { ribbonAwarenessElement } from "./generators/ribbon-awareness.js";

const ELEMENTS: ElementDef[] = [
  slashTearElement,
  chevronArrowElement,
  stripeJaggedElement,
  bannerCurvedElement,
  textBlockElement,
  ribbonAwarenessElement,
];

const REGISTRY = new Map<string, ElementDef>(ELEMENTS.map((el) => [el.id, el]));

export function getElement(id: string): ElementDef | undefined {
  return REGISTRY.get(id);
}

export function requireElement(id: string): ElementDef {
  const el = REGISTRY.get(id);
  if (!el) {
    const known = [...REGISTRY.keys()].join(", ");
    throw new Error(`Unknown element "${id}". Known elements: ${known}`);
  }
  return el;
}

export function listElements(): ElementDef[] {
  return [...ELEMENTS];
}
