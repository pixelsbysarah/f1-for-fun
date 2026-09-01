/**
 * Pure mapping from a field's `FieldState` to its Tailwind class string.
 *
 * Extracted from the component so the correct/incorrect/missing styling
 * *decision* is unit-testable without rendering (the issue asks for exactly
 * this: "test that the right class/state is applied given correct vs incorrect
 * input"). Correct fields additionally receive a team color inline (driven from
 * the `teamColors` config) plus a CSS checkmark; those are applied in the
 * component, keyed off the same state.
 */
import type { FieldState } from "./types";

const STYLES: Record<FieldState, string> = {
  // Full weight; team color is layered on via inline style in the component.
  correct: "font-semibold text-off-white",
  // Greyscale: muted, desaturated — the design's "incorrect" treatment.
  incorrect: "text-off-white/35 grayscale",
  // No value predicted: faint dash.
  missing: "text-off-white/25",
  // No judgement yet (upcoming race / unscoreable category): plain body text.
  pending: "text-off-white/80",
};

/** Tailwind classes for a prediction field in the given state. */
export function fieldClassName(state: FieldState): string {
  return STYLES[state];
}
