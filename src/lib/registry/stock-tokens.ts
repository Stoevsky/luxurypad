import { z } from "zod";
import type { Address } from "viem";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chain/robinhood";
import { singleFlight } from "@/lib/cache";

/**
 * The official Robinhood Stock Token registry.
 *
 * This is the single source of truth for which tokenized equities exist. We
 * never hardcode a ticker, contract address or price — everything is read from
 * the live endpoint and validated. If the endpoint is unreachable the caller
 * gets `null` and the UI renders an explicit "Unavailable" state.
 */
const ASSET_API_BASE = process.env.ASSET_API_BASE ?? "https://api.robinhood.com/rhj";

const DeploymentSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.number(),
  networkName: z.string().optional(),
});

const AssetSchema = z.object({
  id: z.string(),
  tokenSymbol: z.string(),
  tokenName: z.string(),
  deployments: z.array(DeploymentSchema).min(1),
  currentMultiplier: z.string().optional().default("1"),
  pendingMultiplier: z.string().optional().default(""),
  status: z.string(),
  logoUrl: z.string().url().optional(),
  tokenDecimals: z.number().optional().default(18),
  isin: z.string().optional(),
});

const AssetsResponseSchema = z.object({ assets: z.array(AssetSchema) });

export type StockTokenAsset = {
  assetId: string;
  symbol: string;
  /** Display name with the " • Robinhood Token" suffix removed. */
  name: string;
  address: Address;
  chainId: number;
  decimals: number;
  logoUrl?: string;
  currentMultiplier: string;
  pendingMultiplier: string;
  isin?: string;
};

export type QuoteSnapshot = {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  currency: string;
  dailyHigh?: number;
  dailyLow?: number;
  dailyTradingVolume?: number;
  isTradingHalt: boolean;
  generatedAt: string;
};

const stripSuffix = (name: string) => name.replace(/\s*•\s*Robinhood Token\s*$/i, "").trim();

let lastGood: StockTokenAsset[] | null = null;
const TTL_MS = 5 * 60_000;

async function fetchStockTokenRegistry(): Promise<StockTokenAsset[] | null> {
  try {
    const res = await fetch(`${ASSET_API_BASE}/assets`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return lastGood;
    const parsed = AssetsResponseSchema.safeParse(await res.json());
    if (!parsed.success) return lastGood;

    const value = parsed.data.assets
      .filter((a) => a.status === "ASSET_STATUS_ACTIVE")
      .flatMap((a) => {
        const dep = a.deployments.find((d) => d.chainId === ROBINHOOD_CHAIN_ID);
        if (!dep) return [];
        return [
          {
            assetId: a.id,
            symbol: a.tokenSymbol,
            name: stripSuffix(a.tokenName),
            address: dep.contractAddress as Address,
            chainId: dep.chainId,
            decimals: a.tokenDecimals ?? 18,
            logoUrl: a.logoUrl,
            currentMultiplier: a.currentMultiplier || "1",
            pendingMultiplier: a.pendingMultiplier || "",
            isin: a.isin,
          } satisfies StockTokenAsset,
        ];
      });
    lastGood = value;
    return value;
  } catch {
    // Stale-while-unavailable: better an explicitly old snapshot than a lie.
    return lastGood;
  }
}

/**
 * Live Stock Token registry, filtered to assets deployed on Robinhood Chain.
 * Concurrent callers share one in-flight request.
 */
export const getStockTokenRegistry = singleFlight(fetchStockTokenRegistry, TTL_MS);

export async function getStockTokenBySymbol(symbol: string) {
  const all = await getStockTokenRegistry();
  return all?.find((a) => a.symbol.toUpperCase() === symbol.toUpperCase()) ?? null;
}

const QuotesSchema = z.object({
  quotes: z.array(
    z.object({
      tokenSymbol: z.string(),
      bid: z.string(),
      ask: z.string(),
      currency: z.string().default("USD"),
      dailyHigh: z.string().optional(),
      dailyLow: z.string().optional(),
      dailyTradingVolume: z.string().optional(),
      isTradingHalt: z.boolean().default(false),
      generatedAt: z.string(),
    }),
  ),
});

/**
 * Reference price for Stock Tokens. The upstream endpoint is per-symbol
 * (`/prices/{symbol}`, 15s cache, 60 req/s), so we fan out and tolerate
 * partial failure — a symbol that doesn't resolve is simply absent from the
 * map and renders as "Unavailable" rather than as a fabricated number.
 *
 * NOTE: these are raw underlying-equity bid/ask values and are NOT
 * multiplier-adjusted. Apply `currentMultiplier` before comparing them to any
 * on-chain oracle value.
 */
export async function getStockTokenQuotes(symbols: string[]): Promise<Map<string, QuoteSnapshot>> {
  const out = new Map<string, QuoteSnapshot>();
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  if (unique.length === 0) return out;

  await Promise.all(
    unique.map(async (symbol) => {
      try {
        const res = await fetch(`${ASSET_API_BASE}/prices/${encodeURIComponent(symbol)}`, {
          headers: { accept: "application/json" },
          next: { revalidate: 15 },
          signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) return;
        const parsed = QuotesSchema.safeParse(await res.json());
        if (!parsed.success) return;
        for (const q of parsed.data.quotes) {
          const bid = Number(q.bid);
          const ask = Number(q.ask);
          if (!Number.isFinite(bid) || !Number.isFinite(ask) || ask <= 0) continue;
          out.set(q.tokenSymbol.toUpperCase(), {
            symbol: q.tokenSymbol.toUpperCase(),
            bid,
            ask,
            mid: (bid + ask) / 2,
            currency: q.currency,
            dailyHigh: q.dailyHigh ? Number(q.dailyHigh) : undefined,
            dailyLow: q.dailyLow ? Number(q.dailyLow) : undefined,
            dailyTradingVolume: q.dailyTradingVolume ? Number(q.dailyTradingVolume) : undefined,
            isTradingHalt: q.isTradingHalt,
            generatedAt: q.generatedAt,
          });
        }
      } catch {
        /* omit — caller renders "Unavailable" */
      }
    }),
  );
  return out;
}
