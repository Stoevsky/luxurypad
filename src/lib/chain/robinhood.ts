import { defineChain } from "viem";
import { APP_CHAIN_ID, parseAddress } from "@/lib/pons/deployment";

/**
 * The chain Robinhood Stock Tokens are deployed on — verified against the live
 * public RPC (`eth_chainId` -> 0x1237). This is fixed, and is used only to pick
 * the right deployment out of the asset registry. It is deliberately separate
 * from `APP_CHAIN_ID`: if this instance points at a Pons deployment on another
 * chain, Stock Tokens still live here.
 * Docs: https://docs.robinhood.com (Connecting to Robinhood Chain)
 */
export const ROBINHOOD_CHAIN_ID = 4663 as const;

/**
 * Multicall3 at its canonical cross-chain address. Verified deployed on
 * Robinhood Chain, and checked field-for-field against individual `eth_call`s
 * at a pinned block before being enabled.
 *
 * This is load-bearing, not an optimisation: `readCurveState` reads 19 views,
 * and without a multicall address viem silently cannot batch them. Hydrating
 * one Explore page then costs ~1,100 requests, which the public RPC rate-limits
 * into total failure — an empty page and a static build that times out.
 *
 * Only declared where it is known deployed. An address with no code would make
 * every batched read fail, so a different deployment must opt in explicitly.
 */
const MULTICALL3_CANONICAL = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;
const multicall3Address =
  parseAddress(process.env.NEXT_PUBLIC_MULTICALL3) ??
  (APP_CHAIN_ID === ROBINHOOD_CHAIN_ID ? MULTICALL3_CANONICAL : null);

export const appChain = defineChain({
  id: APP_CHAIN_ID,
  name: APP_CHAIN_ID === ROBINHOOD_CHAIN_ID ? "Robinhood Chain" : `Chain ${APP_CHAIN_ID}`,
  ...(multicall3Address ? { contracts: { multicall3: { address: multicall3Address } } } : {}),
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com",
        process.env.RPC_FALLBACK_URL ?? "https://rpc.mainnet.chain.robinhood.com",
      ].filter(Boolean) as string[],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://robinhoodchain.blockscout.com",
    },
  },
});

export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://robinhoodchain.blockscout.com";

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (address: string) => `${EXPLORER_URL}/address/${address}`;
