import { describe, expect, it } from "vitest";
import { zeroAddress, type Address } from "viem";
import { preflightLaunch, encodeLaunch, launchSalt, launchValue } from "@/lib/pons/launch";
import { launchFee } from "@/lib/pons/pairs";
import { getStockTokenBySymbol } from "@/lib/registry/stock-tokens";
import { requireDeployment } from "@/lib/pons/deployment";

const PONS_V2 = requireDeployment();

/**
 * A real, funded Robinhood Chain address. Preflight checks the creator's actual
 * ETH balance, so an empty address would (correctly) fail the balance gate and
 * tell us nothing about the rest of the flow.
 */
const CREATOR = "0xfb59162e993c52f295c968382d3e8ea113985c06" as Address;
/** Deliberately empty — used to prove the balance gate bites. */
const BROKE = "0x1111111111111111111111111111111111111111" as Address;

const draft = (over: Partial<Parameters<typeof preflightLaunch>[0]> = {}) => ({
  name: "Maranello Club",
  symbol: "MARANELLO",
  imageUri: "ipfs://bafkreitestimage",
  description: "A LuxuryPad test launch.",
  creator: CREATOR,
  creatorTaxBps: 100,
  quoteAsset: zeroAddress as Address,
  initialBuy: 0n,
  minAmountOut: 0n,
  ...over,
});

describe("launch preflight", () => {
  it("passes every check and simulates against native ETH", async () => {
    const r = await preflightLaunch(draft());
    const failed = r.checks.filter((c) => c.status === "fail");
    expect(failed.map((c) => `${c.id}: ${c.detail}`)).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.transaction).toBeDefined();
    expect(r.transaction!.predictedToken).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(r.transaction!.predictedCurve).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(r.transaction!.predictedToken).not.toBe(zeroAddress);
    expect(r.transaction!.to.toLowerCase()).toBe(PONS_V2.launchFactory.toLowerCase());
  });

  it("simulates a launch paired with a real luxury Stock Token (GLD)", async () => {
    const gld = await getStockTokenBySymbol("GLD");
    expect(gld).not.toBeNull();
    const r = await preflightLaunch(draft({ quoteAsset: gld!.address, symbol: "AURUM" }));
    expect(r.checks.find((c) => c.id === "pair")!.status).toBe("pass");
    expect(r.ok).toBe(true);
  });

  it("refuses a pair the protocol does not approve", async () => {
    const elf = await getStockTokenBySymbol("ELF");
    expect(elf).not.toBeNull();
    const r = await preflightLaunch(draft({ quoteAsset: elf!.address, symbol: "ELFLUX" }));
    const pair = r.checks.find((c) => c.id === "pair")!;
    expect(pair.status).toBe("fail");
    expect(pair.detail).toContain("isn't currently available as a launch pair");
    expect(r.ok).toBe(false);
    expect(r.transaction).toBeUndefined();
  });

  it("routes through the router only when there is a first buy", () => {
    const salt = launchSalt(CREATOR, "X");
    expect(encodeLaunch(draft(), salt).to.toLowerCase()).toBe(PONS_V2.launchFactory.toLowerCase());
    expect(encodeLaunch(draft({ initialBuy: 10n ** 17n }), salt).to.toLowerCase()).toBe(
      PONS_V2.launchAndBuy!.toLowerCase(),
    );
  });

  it("carries the launch fee plus a native first buy in tx value", () => {
    const fee = 5n * 10n ** 14n;
    expect(launchValue(draft(), fee)).toBe(fee);
    expect(launchValue(draft({ initialBuy: 10n ** 18n }), fee)).toBe(fee + 10n ** 18n);
  });

  it("reads the launch fee from the factory rather than assuming it", async () => {
    expect(await launchFee()).toBe(5n * 10n ** 14n);
  });

  it("never returns a transaction when a blocking check failed", async () => {
    const r = await preflightLaunch(draft({ quoteAsset: "0x2222222222222222222222222222222222222222" }));
    expect(r.ok).toBe(false);
    expect(r.transaction).toBeUndefined();
  });

  it("blocks a creator who cannot cover the launch fee", async () => {
    const r = await preflightLaunch(draft({ creator: BROKE }));
    expect(r.checks.find((c) => c.id === "balance")!.status).toBe("fail");
    expect(r.ok).toBe(false);
    expect(r.transaction).toBeUndefined();
  });
});
