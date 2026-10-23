import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mongodb-js/zstd", () => ({
  decompress: vi.fn(async (input: Uint8Array) => input),
}));
vi.mock("electron-is-dev", () => ({ default: false }));

import { findPackTableReferencesOptimized } from "../src/modCompat/missingDBTableReferences";
import { emptyAllCompatDataCollections, getCompatData } from "../src/modCompat/packFileCompatManager";
import type { Pack, PackedFile } from "../src/packFileTypes";

const file = (name: string): PackedFile => ({ name, file_size: 1, start_pos: 0 }) as PackedFile;
const pack = (name: string, packedFiles: PackedFile[]): Pack =>
  ({ name, path: `/mods/${name}`, packedFiles, readTables: "all" }) as Pack;
const packs = () => [pack("a.pack", [file("a1"), file("a2")]), pack("b.pack", [file("b1")])];

/** Makes every time check see the pause as due, so the scan pauses before each file. */
const makeEveryPauseDue = () => {
  let now = 0;
  vi.spyOn(Date, "now").mockImplementation(() => (now += 1_000));
};

afterEach(() => {
  vi.restoreAllMocks();
  emptyAllCompatDataCollections();
});

describe("compat check cancel", () => {
  it("pauses for the event loop during the reference scan", async () => {
    makeEveryPauseDue();
    const setImmediateSpy = vi.spyOn(global, "setImmediate");

    await findPackTableReferencesOptimized(packs());

    expect(setImmediateSpy).toHaveBeenCalled();
  });

  it("stops the reference scan at the first pause after a cancel", async () => {
    makeEveryPauseDue();
    const onPackChecked = vi.fn();

    const refs = await findPackTableReferencesOptimized(packs(), onPackChecked, () => true);

    expect(onPackChecked).toHaveBeenCalledTimes(1);
    expect(refs).toEqual({});
  });

  it("returns no result for a canceled check", async () => {
    expect(await getCompatData(packs(), undefined, () => true)).toBeUndefined();
  });

  it("returns the result when the check is not canceled", async () => {
    const result = await getCompatData(packs(), undefined, () => false);

    expect(result?.packFileCollisions).toEqual([]);
  });
});
