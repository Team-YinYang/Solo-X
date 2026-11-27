export function parseAmount(value: string): bigint {
  if (!/^\d{1,20}(\.\d{1,6})?$/.test(value)) throw new Error("Enter a positive amount with at most six decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  if (units === 0n || units > 18446744073709551615n) throw new Error("Amount is outside the supported range.");
  return units;
}

export function formatAmount(units: bigint): string {
  return (units / 1000000n).toString() + "." + (units % 1000000n).toString().padStart(6, "0");
}
