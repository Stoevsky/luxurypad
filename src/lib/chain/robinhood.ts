import { defineChain } from "viem";

/**
 * Robinhood Chain — verified against the live public RPC:
 *   eth_chainId -> 0x1237 (4663)
 * Docs: https://docs.robinhood.com (Connecting to Robinhood Chain)
 */
export const ROBINHOOD_CHAIN_ID = 4663 as const;

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
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
