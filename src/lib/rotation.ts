// Rotation position within a subgroup for a given TP round, computed from a
// trainer-editable base order rather than a stored per-TP array. Verified
// against the spec's worked example: base A,B,C (slots 0,1,2) -> TP1 A,B,C;
// TP2 C,A,B; TP3 B,C,A.
export function rotationPosition(baseSlot: number, subgroupSize: number, tpNumber: number): number {
  return (baseSlot + (tpNumber - 1)) % subgroupSize;
}
