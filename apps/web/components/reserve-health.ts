export type HealthWarning = "reserve-shortfall" | "rpc-stale" | "rpc-time-unavailable" | "unverified";
export interface ReserveSample {
  supply: bigint; reserves: bigint; sampleSlot: number; latestSlot: number;
  blockTimeSeconds: number | null; nowMs: number; identityVerified: boolean;
}
export function evaluateReserveHealth(s: ReserveSample) {
  const warnings: HealthWarning[] = [];
  const valid = s.identityVerified && s.supply >= 0n && s.reserves >= 0n &&
    Number.isSafeInteger(s.sampleSlot) && s.sampleSlot >= 0 &&
    Number.isSafeInteger(s.latestSlot) && s.latestSlot >= s.sampleSlot &&
    Number.isFinite(s.nowMs) && s.nowMs >= 0;
  if (!valid) warnings.push("unverified");
  if (s.supply >= 0n && s.reserves >= 0n && s.reserves < s.supply) warnings.push("reserve-shortfall");
  const timeValid = s.blockTimeSeconds !== null && Number.isSafeInteger(s.blockTimeSeconds) &&
    s.blockTimeSeconds >= 0 && s.blockTimeSeconds * 1000 <= s.nowMs + 5000;
  if (!timeValid) warnings.push("rpc-time-unavailable");
  const ageSeconds = timeValid ? Math.max(0, Math.floor(s.nowMs / 1000 - s.blockTimeSeconds!)) : null;
  const slotLag = Number.isSafeInteger(s.latestSlot) && Number.isSafeInteger(s.sampleSlot) &&
    s.latestSlot >= s.sampleSlot ? s.latestSlot - s.sampleSlot : null;
  if ((slotLag !== null && slotLag > 32) || (ageSeconds !== null && ageSeconds > 90)) warnings.push("rpc-stale");
  const status = warnings.includes("unverified") || warnings.includes("rpc-time-unavailable") ? "unverified" :
    warnings.includes("rpc-stale") ? "stale" : warnings.includes("reserve-shortfall") ? "shortfall" : "healthy";
  return {
    status, warnings, slotLag, ageSeconds,
    deficit: s.supply >= 0n && s.reserves >= 0n && s.reserves < s.supply ? s.supply - s.reserves : 0n,
    ratioBasisPoints: s.supply > 0n && s.reserves >= 0n ? s.reserves * 10000n / s.supply : null,
  };
}
