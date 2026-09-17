import type { Address } from "viem";
import { LUXURY_COMPANIES, type LuxuryCompany, type LuxurySector } from "./luxury";
import { getStockTokenQuotes, getStockTokenRegistry, type QuoteSnapshot, type StockTokenAsset } from "./stock-tokens";
import { verifyPairsApproved } from "@/lib/pons/pairs";
import { luxuryPairAddress, resolveLuxuryPairAsset } from "./luxury-pairs";

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

/**
 * Where a market's pair asset came from. This drives the copy: a token this
 * project deployed is a real pair asset but is *not* a tokenised equity, and
 * must never be described as a Stock Token.
 */
export type AssetSource = "stock-token" | "luxury-pair";

export type LuxuryMarket = {
  company: LuxuryCompany;
  state: MarketState;
  asset: StockTokenAsset | null;
  assetSource: AssetSource | null;
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
    return market.assetSource === "stock-token"
      ? `Paired with ${market.company.companyName} Stock Token`
      : `Paired with ${market.asset.symbol}`;
  }
  return `Associated with ${market.company.companyName}`;
}

/**
 * The single place "Paired with …" copy is produced.
 *
 * It lived inline in four components, each repeating the assumption that a pair
 * asset is a Stock Token. That is no longer true — a token deployed for this
 * launchpad is a pair asset but not a tokenised equity — and four copies would
 * drift. Only a verified PAIR_AVAILABLE market may name a company.
 */
export function pairingLabel(
  market: LuxuryMarket | null | undefined,
  opts: { isNativeQuote?: boolean; fallbackSymbol?: string } = {},
): string {
  if (opts.isNativeQuote) return "Paired with ETH";
  if (market?.state === "PAIR_AVAILABLE") return relationshipLabel(market);
  return `Paired with ${opts.fallbackSymbol || "a pair asset"}`;
}

/** The noun for a market's pair asset. A launchpad token is not a Stock Token. */
export function assetKindLabel(market: LuxuryMarket | null | undefined): string {
  return market?.assetSource === "luxury-pair" ? "Pair token" : "Stock Token";
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

  // Resolve each company's pair asset. A token deployed for this launchpad wins
  // over a Robinhood Stock Token, because it was chosen deliberately for this
  // company; the Stock Token route stays as the fallback. Either way the
  // address has to answer on chain before it counts.
  const resolved = await Promise.all(
    companies.map(async (company) => {
      const pairAddress = luxuryPairAddress(company.id);
      if (pairAddress) {
        const asset = await resolveLuxuryPairAsset({ companyId: company.id, address: pairAddress });
        if (asset) return { company, asset, source: "luxury-pair" as AssetSource };
      }
      const stock = company.stockTicker
        ? bySymbol.get(company.stockTicker.toUpperCase()) ?? null
        : null;
      return {
        company,
        asset: stock,
        source: stock ? ("stock-token" as AssetSource) : null,
      };
    }),
  );

  const byCompanyId = new Map(resolved.map((r) => [r.company.id, r]));

  // Only companies that actually resolve to a deployed token are worth checking.
  const withAssets = resolved.flatMap((r) => (r.asset ? [{ company: r.company, asset: r.asset }] : []));

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

  // Only Robinhood Stock Tokens have an equity quote. A launchpad pair token
  // has a curve price, not a share price, so asking for one would be nonsense.
  const quotes = await getStockTokenQuotes(
    resolved.flatMap((r) => (r.source === "stock-token" && r.asset ? [r.asset.symbol] : [])),
  );

  const markets: LuxuryMarket[] = companies.map((company) => {
    const entry = byCompanyId.get(company.id);
    const asset = entry?.asset ?? null;

    if (!asset) {
      // Either the company has no tokenised asset at all, or the registry is down.
      return {
        company,
        state: "THEME_ONLY",
        asset: null,
        assetSource: null,
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
      assetSource: entry?.source ?? null,
      quote: entry?.source === "stock-token" ? quotes.get(asset.symbol.toUpperCase()) ?? null : null,
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
