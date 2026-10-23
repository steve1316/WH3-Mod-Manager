import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mongodb-js/zstd", () => ({
  compress: async (value: Uint8Array) => value,
  decompress: async (value: Uint8Array) => value,
}));

import appData from "../src/appData";
import { readPack, writePack } from "../src/packFileSerializer";
import type { DBVersion, Pack, SchemaField } from "../src/packFileTypes";
import { DBNameToDBVersions } from "../src/schema";
import { buildImportedPackedFile } from "../src/utility/packImportStaging";

const temporaryFolders: string[] = [];
let previousGame: typeof appData.currentGame;
let previousSchemas: DBVersion[] | undefined;

const field = (name: string, field_type: DBVersion["fields"][number]["field_type"], is_key = false) => ({
  name,
  field_type,
  default_value: "",
  is_key,
  is_filename: false,
  is_reference: [],
  description: "",
  ca_order: 0,
  is_bitwise: 0,
  enum_values: {},
});

const schema: DBVersion = {
  version: 3,
  fields: [
    field("key", "StringU8", true),
    field("parent", "StringU8"),
    field("amount", "I32"),
    field("enabled", "Boolean"),
    field("note", "OptionalStringU8"),
  ],
};

beforeEach(() => {
  previousGame = appData.currentGame;
  appData.currentGame = "wh3";
  previousSchemas = DBNameToDBVersions.wh3.example_tables;
  DBNameToDBVersions.wh3.example_tables = [schema];
});

afterEach(async () => {
  appData.currentGame = previousGame;
  if (previousSchemas) DBNameToDBVersions.wh3.example_tables = previousSchemas;
  else delete DBNameToDBVersions.wh3.example_tables;
  await Promise.all(temporaryFolders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })));
});

const stageTable = (packFilePath: string, rows: string[]) => {
  const tsv = ["key\tparent\tamount\tenabled\tnote", `#example_tables;3;${packFilePath}`, ...rows].join("\n");
  const staged = buildImportedPackedFile(
    { diskPath: "data.tsv", packFilePath, isRpfmTsv: true },
    Buffer.from(tsv, "utf8"),
    { example_tables: [schema] },
    () => undefined,
  );
  const buffer = staged.buffer || Buffer.from(staged.text || "");
  return { name: staged.name, buffer, file_size: buffer.length };
};

const writeExamplePack = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "whmm-shared-cells-"));
  temporaryFolders.push(root);
  const packPath = path.join(root, "Shared.pack");
  await writePack(
    [
      stageTable("db/example_tables/first", ["unit_a\tunit_b\t17\ttrue\t", "unit_b\tunit_a\t17\ttrue\thello"]),
      stageTable("db/example_tables/second", ["unit_c\tunit_a\t17\tfalse\thello"]),
    ],
    packPath,
  );
  return packPath;
};

const cellsOf = (pack: Pack, tableName: string) => {
  const table = pack.packedFiles.find((packedFile) => packedFile.name === `db\\example_tables\\${tableName}`);
  return table?.schemaFields as SchemaField[];
};

describe("reading a pack with shareIdenticalCells", () => {
  it("returns the same values as a normal read", async () => {
    const packPath = await writeExamplePack();

    const plain = await readPack(packPath, { tablesToRead: ["db\\example_tables"] });
    const shared = await readPack(packPath, { tablesToRead: ["db\\example_tables"], shareIdenticalCells: true });

    expect(cellsOf(shared, "first")).toEqual(cellsOf(plain, "first"));
    expect(cellsOf(shared, "second")).toEqual(cellsOf(plain, "second"));
  });

  it("reuses one cell object for identical cells, across rows and tables", async () => {
    const packPath = await writeExamplePack();

    const shared = await readPack(packPath, { tablesToRead: ["db\\example_tables"], shareIdenticalCells: true });
    const first = cellsOf(shared, "first");
    const second = cellsOf(shared, "second");

    // amount 17 in every row, enabled true in both rows of "first", note "hello" in both tables.
    expect(first[7]).toBe(first[2]);
    expect(second[2]).toBe(first[2]);
    expect(first[8]).toBe(first[3]);
    expect(second[4]).toBe(first[9]);
    expect(first[4]).not.toBe(first[9]);
  });

  it("keeps key cells apart from non-key cells with the same value", async () => {
    const packPath = await writeExamplePack();

    const shared = await readPack(packPath, { tablesToRead: ["db\\example_tables"], shareIdenticalCells: true });
    const first = cellsOf(shared, "first");

    // Row one's key "unit_a" and row two's parent "unit_a".
    expect(first[0].isKey).toBe(true);
    expect(first[6].isKey).toBeUndefined();
    expect(first[6]).not.toBe(first[0]);
    expect(first[6]).toEqual({ ...first[0], isKey: undefined });
  });

  it("gives every cell its own object without the option", async () => {
    const packPath = await writeExamplePack();

    const plain = await readPack(packPath, { tablesToRead: ["db\\example_tables"] });
    const first = cellsOf(plain, "first");

    expect(first[7]).toEqual(first[2]);
    expect(first[7]).not.toBe(first[2]);
  });
});

describe("reading a pack's tables", () => {
  it("pauses for the event loop between tables once a pause is due", async () => {
    const packPath = await writeExamplePack();
    // Every time check sees the pause as due.
    let now = 0;
    const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => (now += 1_000));
    const setImmediateSpy = vi.spyOn(global, "setImmediate");

    try {
      const pack = await readPack(packPath, { tablesToRead: ["db\\example_tables"] });

      expect(setImmediateSpy).toHaveBeenCalled();
      expect(cellsOf(pack, "second")).toHaveLength(5);
    } finally {
      dateNowSpy.mockRestore();
      setImmediateSpy.mockRestore();
    }
  });

  it("stops parsing tables at the next pause once the read is canceled", async () => {
    const packPath = await writeExamplePack();
    let now = 0;
    const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => (now += 1_000));

    try {
      const pack = await readPack(packPath, { tablesToRead: ["db\\example_tables"], isCanceled: () => true });

      expect(cellsOf(pack, "first")).toBeUndefined();
      expect(pack.packedFiles).toHaveLength(2);
    } finally {
      dateNowSpy.mockRestore();
    }
  });
});
