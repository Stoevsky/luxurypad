import type { Address } from "viem";

/**
 * Pons V2 — token launch protocol on Robinhood Chain (chainId 4663).
 *
 * PROVENANCE. Every address below was verified in two independent ways before
 * being committed here:
 *   1. `eth_getCode` against https://rpc.mainnet.chain.robinhood.com returned
 *      non-empty bytecode for each address.
 *   2. Each address appears as the emitter / entry point of real `TokenLaunched`
 *      transactions observed in a live `eth_getLogs` scan of recent blocks.
 *
 * Do NOT edit these by hand. If Pons redeploys, re-verify and record a new
 * `protocolVersion` so historical launches keep resolving against the contracts
 * they were actually created with (see `launch_protocol_deployments`).
 */
export type PonsDeployment = {
  protocolVersion: string;
  chainId: number;
  launchFactory: Address;
  /** Null when no launch-and-buy router is known; initial buys are then refused. */
  launchAndBuy: Address | null;
  memeHook?: Address;
  launchLocker?: Address;
  graduationExecutor?: Address;
  uniswapV4PoolManager?: Address;
  /**
   * `verified-onchain` means the addresses were confirmed against the live
   * chain from this repo. `configured` means they were supplied by the operator
   * and carry only that assurance.
   */
  provenance: "verified-onchain" | "configured";
};

export const PONS_V2_MAINNET: PonsDeployment = {
  protocolVersion: "pons-v2",
  chainId: 4663,
  /** Emits TokenLaunched / LaunchSwept / PoolGraduated. */
  launchFactory: "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e" as Address,
  /** Router used by most launches: launch + optional first buy in one tx. */
  launchAndBuy: "0xe33e9e479df8802cb0866d5d05258bec4cf62948" as Address,
  /** Uniswap V4 hook that takes the post-graduation fee. */
  memeHook: "0xe5e702641ea86f4ae6cc3cdaed2b886f976be044" as Address,
  /** Holds the permanently locked graduation liquidity. */
  launchLocker: "0x267444d099b10fb5ed7c3cc7b7c767adca574952" as Address,
  graduationExecutor: "0xc7819b64a1daecd7ec19856d026cb14efbd89046" as Address,
  uniswapV4PoolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951" as Address,
  provenance: "verified-onchain",
};

/** Native ETH is represented as the zero address in Pons quote-asset fields. */
export const NATIVE_QUOTE = "0x0000000000000000000000000000000000000000" as Address;

/**
 * Non-stock quote assets Pons accepts. Stock-token quotes are resolved at
 * runtime from the Robinhood asset registry — never hardcoded.
 */
export const STABLE_QUOTES = {
  USDG: "0x5fc5360d0400a0fd4f2af552add042d716f1d168" as Address,
  cbBTC: "0xcec185eb182c47d1ba1efc84e6959e18cd620be4" as Address,
} as const;

/** Fixed supply minted into every curve at launch. */
export const PONS_TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;
