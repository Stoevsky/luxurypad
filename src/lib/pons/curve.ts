import type { Address } from "viem";
import { ponsCurveAbi, erc20Abi } from "./abi";
import { rpc, withRpc } from "./client";
import { NATIVE_QUOTE } from "./contracts";

export type CurveState = {
  curve: Address;
  token: Address;
  creator: Address;
  quoteAsset: Address;
  isNativeQuote: boolean;
  /** Includes the phantom (virtual) reserve the curve is seeded with. */
  quoteReserve: bigint;
  tokenReserve: bigint;
  /** Actual quote asset taken in so far — this is what graduation measures. */
  realQuoteReserve: bigint;
  phantomQuote: bigint;
  graduationThreshold: bigint;
  readyToGraduate: boolean;
  graduated: boolean;
  launchedAt: number;
  launchSupply: bigint;
  sellableTokens: bigint;
  creatorTaxBps: number;
  creatorTaxBalance: bigint;
  feeBps: number;
  feeEscrow: Address;
  snipeTaxStartBps: number;
  snipeTaxSeconds: number;
};

export type TokenMeta = {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
};

/** Phase drives which execution path trading must use. Never guess it. */
export type LaunchPhase = "curve" | "ready_to_graduate" | "graduated";

export function phaseOf(state: CurveState): LaunchPhase {
  if (state.graduated) return "graduated";
  if (state.readyToGraduate) return "ready_to_graduate";
  return "curve";
}

/** Fraction of the graduation threshold already taken in, clamped to [0,1]. */
export function graduationProgress(state: CurveState): number {
  if (state.graduationThreshold === 0n) return 0;
  if (state.graduated) return 1;
  const pct = Number((state.realQuoteReserve * 10_000n) / state.graduationThreshold) / 10_000;
  return Math.max(0, Math.min(1, pct));
}

/** Spot price of one whole token, denominated in the quote asset (as a bigint ratio). */
export function spotPriceQuotePerToken(state: CurveState, tokenDecimals = 18): bigint {
  if (state.tokenReserve === 0n) return 0n;
  return (state.quoteReserve * 10n ** BigInt(tokenDecimals)) / state.tokenReserve;
}

type CurveViewFn = Extract<
  (typeof ponsCurveAbi)[number],
  { type: "function"; stateMutability: "view" }
>["name"];

export async function readCurveState(curve: Address): Promise<CurveState> {
  const client = rpc();
  const call = <T>(functionName: CurveViewFn) =>
    client.readContract({ address: curve, abi: ponsCurveAbi, functionName }) as Promise<T>;

  return withRpc(async () => {
    const [
      token,
      creator,
      quoteAsset,
      isNativeQuote,
      reserves,
      realQuoteReserve,
      phantomQuote,
      graduationThreshold,
      readyToGraduate,
      graduated,
      launchedAt,
      launchSupply,
      sellableTokens,
      creatorTaxBps,
      creatorTaxBalance,
      feeBps,
      feeEscrow,
      snipeTaxStartBps,
      snipeTaxSeconds,
    ] = await Promise.all([
      call<Address>("token"),
      call<Address>("deployer"),
      call<Address>("pairToken"),
      call<boolean>("isNativeQuote"),
      call<readonly [bigint, bigint]>("getReserves"),
      call<bigint>("realQuoteReserve"),
      call<bigint>("phantomQuote"),
      call<bigint>("graduationThreshold"),
      call<boolean>("readyToGraduate"),
      call<boolean>("graduated"),
      call<bigint>("launchedAt"),
      call<bigint>("launchSupply"),
      call<bigint>("sellableTokens"),
      call<number>("creatorTaxBps"),
      call<bigint>("creatorTaxBalance"),
      call<number>("feeBps"),
      call<Address>("feeEscrow"),
      call<number>("snipeTaxStartBps"),
      call<bigint>("snipeTaxSeconds"),
    ]);

    return {
      curve,
      token,
      creator,
      quoteAsset,
      isNativeQuote,
      quoteReserve: reserves[0],
      tokenReserve: reserves[1],
      realQuoteReserve,
      phantomQuote,
      graduationThreshold,
      readyToGraduate,
      graduated,
      launchedAt: Number(launchedAt),
      launchSupply,
      sellableTokens,
      creatorTaxBps: Number(creatorTaxBps),
      creatorTaxBalance,
      feeBps: Number(feeBps),
      feeEscrow,
      snipeTaxStartBps: Number(snipeTaxStartBps),
      snipeTaxSeconds: Number(snipeTaxSeconds),
    } satisfies CurveState;
  });
}

export async function readTokenMeta(token: Address): Promise<TokenMeta> {
  const client = rpc();
  return withRpc(async () => {
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      client.readContract({ address: token, abi: erc20Abi, functionName: "name" }),
      client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
      client.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply" }),
    ]);
    return { address: token, name, symbol, decimals: Number(decimals), totalSupply } as TokenMeta;
  });
}

export const isNative = (asset: Address) => asset.toLowerCase() === NATIVE_QUOTE.toLowerCase();
