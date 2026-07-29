import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the application shell, record route, and accessible progress", () => {
    window.history.replaceState({}, "", "/record");

    render(<App />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Tell us what’s on your mind",
      }),
    ).toBeInTheDocument();

    const progress = screen.getByRole("navigation", {
      name: "Intake progress",
    });

    expect(within(progress).getAllByRole("listitem")).toHaveLength(3);

    const recordStep = within(progress).getByRole("link", {
      name: "Step 1 of 3: Record",
    });

    expect(recordStep).toHaveAttribute("aria-current", "step");
    expect(
      within(progress).getByRole("link", {
        name: "Step 2 of 3: Topics",
      }),
    ).not.toHaveAttribute("aria-current");
  });

  it("updates the current step and page content after navigation", () => {
    window.history.replaceState({}, "", "/record");

    render(<App />);

    const progress = screen.getByRole("navigation", {
      name: "Intake progress",
    });
    const topicsStep = within(progress).getByRole("link", {
      name: "Step 2 of 3: Topics",
    });

    fireEvent.click(topicsStep);

    expect(
      screen.getByRole("heading", { level: 1, name: "Review your topics" }),
    ).toBeInTheDocument();
    expect(topicsStep).toHaveAttribute("aria-current", "step");
    expect(document.title).toBe("Aepsy | Review your topics");
  });
});
