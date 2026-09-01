import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CompatVirtualRows from "../src/components/CompatVirtualRows";

// react-virtualized renders nothing at the zero width jsdom reports. Only AutoSizer is replaced so the real
// List, CellMeasurer and cache still run.
vi.mock("react-virtualized", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-virtualized")>();
  return {
    ...actual,
    AutoSizer: ({ children }: { children: (size: { width: number; height: number }) => React.ReactNode }) =>
      children({ width: 800, height: 600 }),
  };
});

describe("CompatVirtualRows", () => {
  it("renders every row of a small section", () => {
    render(<CompatVirtualRows rowCount={3} renderRow={(index) => <span>row {index}</span>} />);

    expect(screen.getAllByText(/^row \d+$/)).toHaveLength(3);
  });

  it("draws only the rows in view for a large section", () => {
    const renderRow = vi.fn((index: number) => <span>row {index}</span>);
    render(<CompatVirtualRows rowCount={100_000} renderRow={renderRow} />);

    expect(screen.getByText("row 0")).toBeInTheDocument();
    expect(screen.queryByText("row 99999")).toBeNull();
    expect(screen.getAllByText(/^row \d+$/).length).toBeLessThan(200);
    expect(renderRow.mock.calls.length).toBeLessThan(1_000);
  });
});
