import { describe, expect, it } from "vitest";
import { resolveLuxuryMarkets, relationshipLabel } from "@/lib/registry/resolve";
import { getStockTokenRegistry } from "@/lib/registry/stock-tokens";
import { verifyPairApproved, NATIVE_PAIR } from "@/lib/pons/pairs";
import { LUXURY_COMPANIES } from "@/lib/registry/luxury";

/**
 * These tests hit the live Robinhood registry and the live Pons factory on
 * Robinhood Chain. They are the guard against the single worst failure mode of
 * this product: presenting a company as launchable when it is not.
 */
describe("stock token registry", () => {
  it("returns active Robinhood Chain assets with checksummed addresses", async () => {
    const assets = await getStockTokenRegistry();
    expect(assets, "registry unreachable").not.toBeNull();
    expect(assets!.length).toBeGreaterThan(50);
    for (const a of assets!) {
      expect(a.chainId).toBe(4663);
      expect(a.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    }
  });

  it("contains none of the iconic luxury houses (documents the real gap)", async () => {
    const assets = await getStockTokenRegistry();
    const symbols = new Set(assets!.map((a) => a.symbol.toUpperCase()));
    for (const absent of ["RACE", "MC", "RMS", "KER", "CFR", "MONC", "P911", "BRBY", "EL"]) {
      expect(symbols.has(absent), `${absent} unexpectedly present — re-run the luxury audit`).toBe(false);
    }
  });
});

describe("pons pair allowlist", () => {
  it("approves native ETH", async () => {
    const check = await verifyPairApproved(NATIVE_PAIR);
    expect(check.approved).toBe(true);
  });

  it("rejects an address that is not a token at all", async () => {
    const check = await verifyPairApproved("0x2222222222222222222222222222222222222222");
    expect(check.approved).toBe(false);
    expect(check.selector).toBe("0x49285dfb");
  });
});

describe("luxury market resolution", () => {
  it("never marks a company without a ticker as launchable", async () => {
    const { markets } = await resolveLuxuryMarkets();
    for (const m of markets) {
      if (!m.company.stockTicker) {
        expect(m.state).toBe("THEME_ONLY");
        expect(m.launchable).toBe(false);
        expect(m.asset).toBeNull();
      }
    }
  });

  it("only ever says 'Paired with' for a verified pair", async () => {
    const { markets } = await resolveLuxuryMarkets();
    for (const m of markets) {
      const label = relationshipLabel(m);
      if (label.includes("Paired with")) {
        expect(m.state).toBe("PAIR_AVAILABLE");
        expect(m.asset).not.toBeNull();
        expect(m.launchable).toBe(true);
      } else {
        expect(label.startsWith("Associated with")).toBe(true);
      }
    }
  });

  it("classifies every enabled curated company into exactly one state", async () => {
    const { markets } = await resolveLuxuryMarkets();
    expect(markets.length).toBe(LUXURY_COMPANIES.filter((c) => c.enabled).length);
    for (const m of markets) {
      expect(["PAIR_AVAILABLE", "DISCOVERY_ONLY", "THEME_ONLY"]).toContain(m.state);
      expect(m.launchable).toBe(m.state === "PAIR_AVAILABLE");
    }
  });

  it("finds at least one genuinely launchable luxury pair", async () => {
    const { markets } = await resolveLuxuryMarkets();
    const launchable = markets.filter((m) => m.launchable);
    process.stdout.write(
      `\n  PAIR AVAILABLE : ${launchable.map((m) => `${m.company.companyName} (${m.company.stockTicker})`).join(", ")}\n` +
      `  DISCOVERY ONLY : ${markets.filter((m) => m.state === "DISCOVERY_ONLY").map((m) => `${m.company.companyName} (${m.company.stockTicker})`).join(", ")}\n` +
      `  THEME ONLY     : ${markets.filter((m) => m.state === "THEME_ONLY").map((m) => m.company.companyName).join(", ")}\n\n`,
    );
    expect(launchable.length).toBeGreaterThan(0);
  });
});
