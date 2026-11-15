export type TileStats = { loaded: number; failed: number };

const minFailuresWithoutAnyTile = 4;
const minFailuresForMajority = 8;

export function isBasemapFailing({ loaded, failed }: TileStats): boolean {
  if (loaded === 0) return failed >= minFailuresWithoutAnyTile;
  return failed >= minFailuresForMajority && failed > loaded;
}
