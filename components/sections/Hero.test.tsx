import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { site } from "@/lib/config/content";
import { Hero } from "./Hero";

describe("Hero", () => {
  it("renders the app name as the top-level heading", () => {
    render(<Hero />);
    expect(
      screen.getByRole("heading", { level: 1, name: site.appName }),
    ).toBeInTheDocument();
  });

  it("renders the subheading and intro body copy from config", () => {
    render(<Hero />);
    expect(screen.getByText(site.subheading)).toBeInTheDocument();
    expect(screen.getByText(site.heroBody)).toBeInTheDocument();
  });
});
