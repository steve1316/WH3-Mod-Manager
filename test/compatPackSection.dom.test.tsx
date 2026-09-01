import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CompatCollapsibleSection from "../src/components/CompatCollapsibleSection";

describe("CompatCollapsibleSection", () => {
  it("starts collapsed and can be opened", async () => {
    render(
      <CompatCollapsibleSection title="example.pack">
        <span>diagnostic result</span>
      </CompatCollapsibleSection>,
    );

    const details = screen.getByText("example.pack").closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(screen.queryByText("diagnostic result")).toBeNull();

    fireEvent.click(screen.getByText("example.pack"));

    expect(details.open).toBe(true);
    expect(await screen.findByText("diagnostic result")).toBeVisible();
  });

  it("does not build its content until it is opened", async () => {
    const renderContent = vi.fn(() => <span>lazy result</span>);
    render(<CompatCollapsibleSection title="lazy.pack">{renderContent}</CompatCollapsibleSection>);

    expect(renderContent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("lazy.pack"));

    expect(await screen.findByText("lazy result")).toBeVisible();
    expect(renderContent).toHaveBeenCalled();
  });
});
