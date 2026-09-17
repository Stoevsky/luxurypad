import { describe, expect, it, beforeAll } from "vitest";
import { parseEther, type Address } from "viem";
import { readCurveState, graduationProgress, phaseOf, type CurveState } from "@/lib/pons/curve";
import { quoteBuy, constantProductOut, applySlippage } from "@/lib/pons/quote";

/** A real Pons curve on Robinhood Chain (native-ETH quoted). */
const CURVE = "0x808c9d234079005de019f4a3d5befb49a117a53b" as Address;

describe("curve state", () => {
  let state: CurveState;
  beforeAll(async () => {
    state = await readCurveState(CURVE);
  });

  it("reads a coherent live curve", () => {
    expect(state.token).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(state.launchSupply).toBe(1_000_000_000n * 10n ** 18n);
    expect(state.quoteReserve).toBeGreaterThan(0n);
    expect(state.tokenReserve).toBeGreaterThan(0n);
    expect(state.graduationThreshold).toBeGreaterThan(0n);
  });

  it("sells exactly 5/7 of supply on the curve", () => {
    const expected = (state.launchSupply * 5n) / 7n;
    const delta = state.sellableTokens > expected ? state.sellableTokens - expected : expected - state.sellableTokens;
    expect(delta).toBeLessThan(state.launchSupply / 1_000_000n);
  });

  it("derives progress from real quote taken in, not phantom liquidity", () => {
    const p = graduationProgress(state);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
    expect(state.quoteReserve).toBe(state.phantomQuote + state.realQuoteReserve);
    expect(["curve", "ready_to_graduate", "graduated"]).toContain(phaseOf(state));
  });
});

describe("quote engine", () => {
  let state: CurveState;
  beforeAll(async () => {
    state = await readCurveState(CURVE);
  });

  it("matches the deployed contract across order sizes", async () => {
    for (const size of ["0.001", "0.01", "0.1", "1"]) {
      const amountIn = parseEther(size);
      const q = await quoteBuy(state, amountIn, 100);
      expect(q.simulated, `buy ${size} ETH did not simulate`).toBe(true);

      const formula = constantProductOut(
        amountIn,
        state.quoteReserve,
        state.tokenReserve,
        BigInt(state.feeBps + state.creatorTaxBps),
      );
      // The pinned formula must track the contract within 0.5%.
      const diff = q.amountOut > formula ? q.amountOut - formula : formula - q.amountOut;
      const tolerance = q.amountOut / 200n;
      expect(diff, `size ${size}: contract ${q.amountOut} vs formula ${formula}`).toBeLessThanOrEqual(tolerance);
    }
  });

  it("produces monotonically larger output for larger input", async () => {
    const small = await quoteBuy(state, parseEther("0.01"), 100);
    const large = await quoteBuy(state, parseEther("0.5"), 100);
    expect(large.amountOut).toBeGreaterThan(small.amountOut);
  });

  it("charges more price impact for larger orders", async () => {
    const small = await quoteBuy(state, parseEther("0.001"), 100);
    const large = await quoteBuy(state, parseEther("2"), 100);
    expect(large.priceImpactBps).toBeGreaterThan(small.priceImpactBps);
  });

  it("enforces a slippage floor below the quote", async () => {
    const q = await quoteBuy(state, parseEther("0.05"), 100);
    expect(q.minAmountOut).toBeLessThan(q.amountOut);
    expect(applySlippage(1000n, 100)).toBe(990n);
    expect(applySlippage(1000n, 0)).toBe(1000n);
  });
});
