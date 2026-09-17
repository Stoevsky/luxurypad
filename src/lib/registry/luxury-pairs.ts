import type { Address } from "viem";
import { erc20Abi } from "@/lib/pons/abi";
import { rpc } from "@/lib/pons/client";
import { APP_CHAIN_ID } from "@/lib/pons/deployment";
import { singleFlight } from "@/lib/cache";
import type { StockTokenAsset } from "./stock-tokens";

/**
 * Luxury pair assets that exist because this project deployed them, rather than
 * because Robinhood tokenised an equity.
 *
 * WHY THIS FILE EXISTS. `resolve.ts` used to grant a company a tradeable asset
 * only if its ticker appeared in the Robinhood Stock Token registry. That
 * registry contains no luxury house, so Ferrari, LVMH and Hermès could never be
 * anything but editorial. A token deployed for this launchpad is a real ERC-20
 * that Pons can pair against — it is simply not a Robinhood asset, so it needs
 * its own route in.
 *
 * WHAT IT IS NOT. An entry here is not a claim that a company endorsed anything,
 * and not a claim that the token tracks an equity price. It is a pair asset.
 *
 * Addresses are pinned per chain and per company id (matching `LUXURY_COMPANIES`
 * in ./luxury.ts) rather than read from the environment, for the same reason the
 * Pons addresses are: a wrong value here points a launch at the wrong token.
 * Every entry is still verified on chain before it is shown — an address that
 * does not answer as an ERC-20 is dropped rather than displayed.
 */
export const LUXURY_PAIR_ASSETS: Record<number, Partial<Record<string, Address>>> = {
  // 4663: { ferrari: "0x…", lvmh: "0x…" },
};

export function luxuryPairAddress(companyId: string): Address | null {
  return LUXURY_PAIR_ASSETS[APP_CHAIN_ID]?.[companyId] ?? null;
}

export function hasLuxuryPairAssets(): boolean {
  return Object.keys(LUXURY_PAIR_ASSETS[APP_CHAIN_ID] ?? {}).length > 0;
}

async function readLuxuryPairAsset(args: {
  companyId: string;
  address: Address;
}): Promise<StockTokenAsset | null> {
  const client = rpc();
  try {
    const [name, symbol, decimals] = await Promise.all([
      client.readContract({ address: args.address, abi: erc20Abi, functionName: "name" }),
      client.readContract({ address: args.address, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address: args.address, abi: erc20Abi, functionName: "decimals" }),
    ]);
    return {
      assetId: `luxury:${args.companyId}`,
      symbol,
      name,
      address: args.address,
      chainId: APP_CHAIN_ID,
      decimals,
      // Multipliers are a Robinhood equity concept and do not apply here.
      currentMultiplier: "1",
      pendingMultiplier: "",
    };
  } catch {
    // Not a live ERC-20 at that address. Do not invent one.
    return null;
  }
}

/** Concurrent resolutions of the same asset share one set of reads. */
export const resolveLuxuryPairAsset = singleFlight(
  readLuxuryPairAsset,
  5 * 60_000,
  (a) => `${a.companyId}:${a.address.toLowerCase()}`,
);
