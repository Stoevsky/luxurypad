import { formatUnits } from "viem";

/** Compact, tabular-safe number formatting. Never rounds a value to zero silently. */
export function formatAmount(value: bigint, decimals = 18, maxFractionDigits = 4): string {
  const n = Number(formatUnits(value, decimals));
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  if (n > 0 && n < 10 ** -maxFractionDigits) return `<0.${"0".repeat(maxFractionDigits - 1)}1`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

export function formatQuoteAmount(value: bigint, symbol: string, decimals = 18): string {
  const amount = formatAmount(value, decimals, 4);
  return symbol ? `${amount} ${symbol}` : amount;
}

export function relativeAge(unixSeconds: number): string {
  if (!unixSeconds) return "—";
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
