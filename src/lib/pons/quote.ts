import { parseEther, type Address } from "viem";
import { ponsCurveAbi } from "./abi";
import { rpc } from "./client";
import { isNative, type CurveState } from "./curve";

const SIM_ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
const BPS = 10_000n;

export type TradeSide = "buy" | "sell";

export type Quote = {
  side: TradeSide;
  /** What the user pays, in the input asset's smallest unit. */
  amountIn: bigint;
  /** What the user receives, in the output asset's smallest unit. */
  amountOut: bigint;
  /** Protocol fee taken from the input, in input units. */
  protocolFee: bigint;
  /** Creator tax taken from the input, in input units. */
  creatorTax: bigint;
  /** Price impact in basis points against the pre-trade spot price. */
  priceImpactBps: number;
  /** Output floor enforced on-chain after slippage tolerance. */
  minAmountOut: bigint;
  /** True when amountOut came from an `eth_call` against the real curve. */
  simulated: boolean;
};

/**
 * Constant-product output with the curve's own fee split applied to the input.
 *
 * This mirrors the deployed contract: the protocol fee (`feeBps`) and the
 * creator tax (`creatorTaxBps`) are taken off the input, and the remainder is
 * swapped against (quoteReserve, tokenReserve) — reserves that already include
 * the curve's phantom quote liquidity.
 *
 * `tests/quote.live.test.ts` pins this formula against real `eth_call`
 * simulations of `buy()`, so a protocol change that invalidates it fails CI
 * rather than silently mispricing the UI.
 */
export function constantProductOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: bigint,
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInAfterFee = (amountIn * (BPS - feeBps)) / BPS;
  const k = reserveIn * reserveOut;
  const newReserveIn = reserveIn + amountInAfterFee;
  const newReserveOut = k / newReserveIn;
  const out = reserveOut - newReserveOut;
  return out > 0n ? out : 0n;
}

function impactBps(amountIn: bigint, amountOut: bigint, reserveIn: bigint, reserveOut: bigint): number {
  if (amountIn === 0n || reserveIn === 0n || amountOut === 0n) return 0;
  // Spot output for the same input with no slippage and no fees.
  const spotOut = (amountIn * reserveOut) / reserveIn;
  if (spotOut === 0n) return 0;
  const ratio = Number((amountOut * BPS) / spotOut);
  return Math.max(0, Math.round(10_000 - ratio));
}

export function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.min(5_000, Math.round(slippageBps))));
  return (amountOut * (BPS - bps)) / BPS;
}

/**
 * Quote a buy. Primary path is a real `eth_call` of `buy()` against the live
 * curve with a balance state-override, so the number shown is the number the
 * contract would actually produce. Falls back to the pinned formula only if the
 * node rejects state overrides.
 */
export async function quoteBuy(
  state: CurveState,
  amountIn: bigint,
  slippageBps: number,
  account: Address = SIM_ACCOUNT,
): Promise<Quote> {
  const totalFeeBps = BigInt(state.feeBps + state.creatorTaxBps);
  const protocolFee = (amountIn * BigInt(state.feeBps)) / BPS;
  const creatorTax = (amountIn * BigInt(state.creatorTaxBps)) / BPS;

  let amountOut = constantProductOut(amountIn, state.quoteReserve, state.tokenReserve, totalFeeBps);
  let simulated = false;

  if (isNative(state.quoteAsset)) {
    try {
      const { result } = await rpc().simulateContract({
        address: state.curve,
        abi: ponsCurveAbi,
        functionName: "buy",
        args: [amountIn, 0n, account],
        value: amountIn,
        account,
        stateOverride: [{ address: account, balance: amountIn + parseEther("1") }],
      });
      amountOut = result;
      simulated = true;
    } catch {
      /* keep formula result */
    }
  }

  return {
    side: "buy",
    amountIn,
    amountOut,
    protocolFee,
    creatorTax,
    priceImpactBps: impactBps(amountIn, amountOut, state.quoteReserve, state.tokenReserve),
    minAmountOut: applySlippage(amountOut, slippageBps),
    simulated,
  };
}

/**
 * Quote a sell. When the seller actually holds the token we simulate `sell()`
 * from their own address, which is exact. Otherwise we fall back to the pinned
 * formula — the on-chain `minAmountOut` still protects the trade either way.
 */
export async function quoteSell(
  state: CurveState,
  amountIn: bigint,
  slippageBps: number,
  account?: Address,
): Promise<Quote> {
  const totalFeeBps = BigInt(state.feeBps + state.creatorTaxBps);
  let amountOut = constantProductOut(amountIn, state.tokenReserve, state.quoteReserve, totalFeeBps);
  let simulated = false;

  if (account) {
    try {
      const { result } = await rpc().simulateContract({
        address: state.curve,
        abi: ponsCurveAbi,
        functionName: "sell",
        args: [amountIn, 0n, account],
        account,
      });
      amountOut = result;
      simulated = true;
    } catch {
      /* seller may not hold the tokens yet — formula stands */
    }
  }

  return {
    side: "sell",
    amountIn,
    amountOut,
    protocolFee: (amountOut * BigInt(state.feeBps)) / BPS,
    creatorTax: (amountOut * BigInt(state.creatorTaxBps)) / BPS,
    priceImpactBps: impactBps(amountIn, amountOut, state.tokenReserve, state.quoteReserve),
    minAmountOut: applySlippage(amountOut, slippageBps),
    simulated,
  };
}

export const SLIPPAGE_PRESETS_BPS = [50, 100, 200] as const;
