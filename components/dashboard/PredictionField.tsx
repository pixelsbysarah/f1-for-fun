import { fieldClassName } from "@/lib/dashboard/field-styles";
import type { FieldView } from "@/lib/dashboard/types";

/**
 * Renders one prediction (or actual-result) field with its state-driven
 * styling: correct → full team color + CSS green checkmark; incorrect →
 * greyscale; missing → a faint dash; pending → plain text.
 *
 * The team color comes from the `teamColors` config via `field.teamColor`
 * (never a literal here), applied as an inline style because the value is
 * dynamic and unknown to Tailwind at build time. `data-state` exposes the
 * decision for tests.
 */
export function PredictionField({ field }: { field: FieldView }) {
  return (
    <span
      data-state={field.state}
      className={fieldClassName(field.state)}
      style={field.teamColor ? { color: field.teamColor } : undefined}
    >
      {field.value}
      {field.state === "correct" && (
        <span
          className="correct-check"
          role="img"
          aria-label="correct"
          data-testid="correct-check"
        />
      )}
    </span>
  );
}
