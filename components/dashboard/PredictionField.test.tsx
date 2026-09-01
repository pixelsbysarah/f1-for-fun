import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { FieldView } from "@/lib/dashboard/types";

import { PredictionField } from "./PredictionField";

function renderField(field: FieldView) {
  const { container } = render(<PredictionField field={field} />);
  return container.querySelector("span[data-state]") as HTMLElement;
}

describe("PredictionField", () => {
  it("styles a correct field with team color and a CSS checkmark", () => {
    const el = renderField({ value: "VER", state: "correct", teamColor: "#3671c6" });
    expect(el.dataset.state).toBe("correct");
    // Full team color applied inline (driven from config, not a literal class).
    expect(el.style.color).toBe("rgb(54, 113, 198)");
    expect(screen.getByTestId("correct-check")).toBeInTheDocument();
  });

  it("styles an incorrect field greyscale with no checkmark or color", () => {
    const el = renderField({ value: "HAM", state: "incorrect", teamColor: null });
    expect(el.dataset.state).toBe("incorrect");
    expect(el.className).toContain("grayscale");
    expect(el.style.color).toBe("");
    expect(screen.queryByTestId("correct-check")).not.toBeInTheDocument();
  });

  it("renders a missing field as a dash", () => {
    const el = renderField({ value: "-", state: "missing", teamColor: null });
    expect(el.dataset.state).toBe("missing");
    expect(el.textContent).toBe("-");
    expect(screen.queryByTestId("correct-check")).not.toBeInTheDocument();
  });

  it("renders a pending field as plain text without a checkmark", () => {
    const el = renderField({ value: "5", state: "pending", teamColor: null });
    expect(el.dataset.state).toBe("pending");
    expect(el.textContent).toBe("5");
    expect(screen.queryByTestId("correct-check")).not.toBeInTheDocument();
  });
});
