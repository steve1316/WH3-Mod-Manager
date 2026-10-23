import { PackCollisions, Pack } from "../packFileTypes";

import { emptyPackFileToFileReferences, findMissingFileReferences } from "./fileToFileReferences";
import { emptyPackFileAnalysisErrors, packFileAnalysisErrors } from "./fileSyntaxChecks";
import { findPackTableReferencesOptimized, refSorting } from "./missingDBTableReferences";
import { emptyPackToScriptFilesWithListeners, processPackToScriptFilesWithListeners } from "./scriptFileListenerNames";
import { emptyPackToTablesWithUniqueIds, processPackToTablesWithUniqueIds } from "./uniqueDBTableIndices";
import { findPackFileCollisions } from "./packFileCollisions";
import { findPackTableCollisions } from "./packTableCollisions";

export async function getCompatData(
  packsData: Pack[],
  onPackChecked?: (
    currentIndex: number,
    maxIndex: number,
    firstPackName: string,
    secondPackName: string,
    type: PackCollisionCheckType,
  ) => void,
  isCanceled?: () => boolean,
): Promise<PackCollisions | undefined> {
  const { missingRefs, uniqueIdsCollisions, scriptListenerCollisions, packFileAnalysisErrors } =
    await findPackTableMissingReferencesAndRunAnalysis(packsData, onPackChecked, isCanceled);
  // A check canceled during the scan skips the remaining stages.
  if (isCanceled?.()) return undefined;

  const missingFileRefs = findMissingFileReferences(packsData);

  // fs.writeFileSync("dumps/missingRefs.json", JSON.stringify(missingRefs));
  // fs.writeFileSync(
  //   "dumps/allVanillaPackNames.json",
  //   JSON.stringify(
  //     appData.allVanillaPackNames.filter(
  //       (packName) =>
  //         packName.startsWith("local_en") ||
  //         (!packName.startsWith("audio_") && !packName.startsWith("local_"))
  //     )
  //   )
  // );

  return {
    packFileCollisions: findPackFileCollisions(packsData, onPackChecked),
    packTableCollisions: findPackTableCollisions(packsData, onPackChecked),
    missingTableReferences: missingRefs,
    uniqueIdsCollisions,
    scriptListenerCollisions,
    packFileAnalysisErrors,
    missingFileRefs,
  };
}

export const emptyAllCompatDataCollections = () => {
  emptyPackToTablesWithUniqueIds();
  emptyPackToScriptFilesWithListeners();
  emptyPackFileAnalysisErrors();
  emptyPackFileToFileReferences();
};

export async function findPackTableMissingReferencesAndRunAnalysis(
  packsData: Pack[],
  onPackChecked?: OnPackChecked,
  isCanceled?: () => boolean,
) {
  // keep this at top, these are populated inside findPackTableReferencesOptimized
  emptyAllCompatDataCollections();

  const missingRefs = await findPackTableReferencesOptimized(packsData, onPackChecked, isCanceled);

  Object.values(missingRefs).forEach((refs) => refs.sort(refSorting));

  // fs.writeFileSync("dumps/packToTablesWithUniqueIds.json", JSON.stringify(packToTablesWithUniqueIds));
  const uniqueIdsCollisions = processPackToTablesWithUniqueIds();
  const scriptListenerCollisions = processPackToScriptFilesWithListeners();
  // fs.writeFileSync("dumps/uniqueIdsCollisions.json", JSON.stringify(uniqueIdsCollisions));
  // fs.writeFileSync(
  //   "dumps/packToScriptFilesWithListeners.json",
  //   JSON.stringify(packToScriptFilesWithListeners)
  // );
  // fs.writeFileSync("dumps/scriptListenerCollisions.json", JSON.stringify(scriptListenerCollisions));

  return {
    missingRefs,
    uniqueIdsCollisions,
    scriptListenerCollisions,
    packFileAnalysisErrors,
  } as PacksAnalysisData;
}
