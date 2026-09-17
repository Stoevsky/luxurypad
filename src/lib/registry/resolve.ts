import type { Address } from "viem";
import { LUXURY_COMPANIES, type LuxuryCompany, type LuxurySector } from "./luxury";
import { getStockTokenQuotes, getStockTokenRegistry, type QuoteSnapshot, type StockTokenAsset } from "./stock-tokens";
import { verifyPairsApproved } from "@/lib/pons/pairs";

/**
 * The three states a luxury market can be in. Keeping these distinct is the
 * core honesty guarantee of the product:
 *
 *  PAIR_AVAILABLE    A tokenized equity exists AND Pons accepts it as a launch
 *                    pair (verified by simulation). Only this state may say
 *                    "Paired with".
 *  DISCOVERY_ONLY    A tokenized equity exists, but Pons does not accept it as
 *                    a pair. Browsable; not launchable.
 *  THEME_ONLY        No tokenized equity exists at all. Editorial content only.
 *                    Always "Associated with", never "Paired with".
 */
export type MarketState = "PAIR_AVAILABLE" | "DISCOVERY_ONLY" | "THEME_ONLY";

export type LuxuryMarket = {
  company: LuxuryCompany;
  state: MarketState;
  asset: StockTokenAsset | null;
  quote: QuoteSnapshot | null;
  /** True only when `state === "PAIR_AVAILABLE"`. */
  launchable: boolean;
  /** Set when the registry itself could not be reached. */
  degraded: boolean;
};

export type ResolvedRegistry = {
  markets: LuxuryMarket[];
  /** Registry unreachable — the UI must say so rather than imply emptiness. */
  registryUnavailable: boolean;
  /** Pair verification unreachable — pair states are unknown, not "false". */
  pairCheckUnavailable: boolean;
  resolvedAt: string;
};

export function relationshipLabel(market: LuxuryMarket): string {
  if (market.state === "PAIR_AVAILABLE" && market.asset) {
    return `Paired with ${market.company.companyName} Stock Token`;
  }
  return `Associated with ${market.company.companyName}`;
}

export function stateLabel(state: MarketState): string {
  switch (state) {
    case "PAIR_AVAILABLE":
      return "Pair available";
    case "DISCOVERY_ONLY":
      return "Discovery only";
    case "THEME_ONLY":
      return "Theme";
  }
}

/**
 * Curated luxury companies ∩ live Stock Token registry ∩ Pons pair allowlist.
 * Nothing is presented as launchable unless all three agree.
 */
export async function resolveLuxuryMarkets(): Promise<ResolvedRegistry> {
  const registry = await getStockTokenRegistry();
  const registryUnavailable = registry === null;
  const bySymbol = new Map((registry ?? []).map((a) => [a.symbol.toUpperCase(), a]));

  const companies = LUXURY_COMPANIES.filter((c) => c.enabled);

  // Only companies that actually resolve to a deployed token are worth checking.
  const withAssets = companies.flatMap((company) => {
    if (!company.stockTicker) return [];
    const asset = bySymbol.get(company.stockTicker.toUpperCase());
    return asset ? [{ company, asset }] : [];
  });

  let pairChecks = new Map<string, { approved: boolean }>();
  let pairCheckUnavailable = false;
  if (withAssets.length > 0) {
    try {
      pairChecks = await verifyPairsApproved(withAssets.map((w) => w.asset.address as Address));
      if (pairChecks.size === 0) pairCheckUnavailable = true;
    } catch {
      pairCheckUnavailable = true;
    }
  }

  const quotes = await getStockTokenQuotes(withAssets.map((w) => w.asset.symbol));

  const markets: LuxuryMarket[] = companies.map((company) => {
    const asset = company.stockTicker ? bySymbol.get(company.stockTicker.toUpperCase()) ?? null : null;

    if (!asset) {
      // Either the company has no ticker at all, or the registry is down.
      return {
        company,
        state: "THEME_ONLY",
        asset: null,
        quote: null,
        launchable: false,
        degraded: registryUnavailable && Boolean(company.stockTicker),
      };
    }

    const check = pairChecks.get(asset.address.toLowerCase());
    const approved = check?.approved === true;
    return {
      company,
      state: approved ? "PAIR_AVAILABLE" : "DISCOVERY_ONLY",
      asset,
      quote: quotes.get(asset.symbol.toUpperCase()) ?? null,
      launchable: approved,
      degraded: pairCheckUnavailable,
    };
  });

  const rank: Record<MarketState, number> = { PAIR_AVAILABLE: 0, DISCOVERY_ONLY: 1, THEME_ONLY: 2 };
  markets.sort(
    (a, b) => rank[a.state] - rank[b.state] || a.company.companyName.localeCompare(b.company.companyName),
  );

  return {
    markets,
    registryUnavailable,
    pairCheckUnavailable,
    resolvedAt: new Date().toISOString(),
  };
}

export async function getLaunchableMarkets(): Promise<LuxuryMarket[]> {
  const { markets } = await resolveLuxuryMarkets();
  return markets.filter((m) => m.launchable);
}

export function groupBySector(markets: LuxuryMarket[]): Map<LuxurySector, LuxuryMarket[]> {
  const out = new Map<LuxurySector, LuxuryMarket[]>();
  for (const m of markets) {
    const list = out.get(m.company.sector) ?? [];
    list.push(m);
    out.set(m.company.sector, list);
  }
  return out;
}
