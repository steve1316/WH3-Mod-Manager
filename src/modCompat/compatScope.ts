import * as nodePath from "path";

/**
 * The packs a compatibility check should actually look at.
 *
 * The loaded set is not the answer. `appData.packsData` accumulates every pack read at any point in
 * the session - a mod browsed in the viewer, a mod enabled and later disabled, a pack opened for some
 * unrelated reason - and none of that should turn up in a report about the mods the user asked about.
 *
 * Scanning everything loaded had three consequences: conflicts reported between packs the user had not
 * selected, a result that depended on session history rather than only on the mods, and a compat cache
 * whose key covered the requested mods while its answer depended on whatever else happened to be in
 * memory.
 *
 * Vanilla packs belong in the requested list: reference resolution needs their keys to decide whether
 * a mod's reference is missing.
 */
export const selectPacksToCheck = <TPack extends { path: string }>(
  loadedPacks: readonly TPack[],
  requestedPackPaths: readonly string[],
): TPack[] => {
  const wanted = new Set(requestedPackPaths.map((packPath) => nodePath.resolve(packPath)));
  return loadedPacks.filter((pack) => wanted.has(nodePath.resolve(pack.path)));
};

/**
 * The loaded packs, with each pack read just for the compat check standing in for the loaded copy of its file.
 *
 * Packs read for the check share identical cells, so they are kept out of `appData.packsData`, where an edit
 * to one cell would change every copy of it.
 * @param loadedPacks - The packs already loaded, usually `appData.packsData`.
 * @param compatReadPacks - The packs read for this check.
 * @returns The combined list, in the loaded order, with packs not loaded at all at the end.
 */
export const preferCompatReadPacks = <TPack extends { path: string }>(
  loadedPacks: readonly TPack[],
  compatReadPacks: readonly TPack[],
): TPack[] => {
  const compatReadByPath = new Map(compatReadPacks.map((pack) => [nodePath.resolve(pack.path), pack]));
  const packs = loadedPacks.map((pack) => {
    const resolvedPath = nodePath.resolve(pack.path);
    const compatRead = compatReadByPath.get(resolvedPath);
    if (!compatRead) return pack;
    compatReadByPath.delete(resolvedPath);
    return compatRead;
  });
  return [...packs, ...compatReadByPath.values()];
};
