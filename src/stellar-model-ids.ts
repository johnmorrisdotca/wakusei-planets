export const STELLAR_MODEL_IDS = {
  dwarf: "mesa-red-dwarf",
  massive: "mesa-massive-zams",
  giant: "mesa-giant-tip",
  whiteDwarf: "mesa-hot-white-dwarf",
} as const;

const ids: ReadonlySet<string> = new Set(Object.values(STELLAR_MODEL_IDS));

export function isStellarModelId(id: string | undefined): boolean {
  return id !== undefined && ids.has(id);
}
