import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { resolveLuxuryMarkets, relationshipLabel } from "@/lib/registry/resolve";
import { getStockTokenBySymbol, getStockTokenRegistry } from "@/lib/registry/stock-tokens";
import { verifyPairApproved, NATIVE_PAIR } from "@/lib/pons/pairs";
import { LUXURY_COMPANIES } from "@/lib/registry/luxury";
import { luxuryPairAddress } from "@/lib/registry/luxury-pairs";

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
    // `selector` is diagnostic and only set when the simulation fallback ran.
    // The primary path reads `approvedPairTokens()`, which answers false
    // without reverting, so absence of a selector is expected here.
    if (check.selector) expect(check.selector).toBe("0x49285dfb");
  });

  it("agrees with the launch simulation about what is pairable", async () => {
    // The cheap allowlist read replaced a full launch simulation. If the two
    // ever diverge, the read is lying and the product would promise pairings
    // that revert at signature time.
    const gld = await getStockTokenBySymbol("GLD");
    const elf = await getStockTokenBySymbol("ELF");
    expect(gld && (await verifyPairApproved(gld.address)).approved).toBe(true);
    expect(elf && (await verifyPairApproved(elf.address)).approved).toBe(false);
  });
});

describe("luxury market resolution", () => {
  it("never marks a company with no resolvable asset as launchable", async () => {
    const { markets } = await resolveLuxuryMarkets();
    for (const m of markets) {
      // A luxury pair token configured for a company is a real asset even
      // though that company has no Robinhood ticker, so the ticker alone no
      // longer decides this. Absence of *both* sources is what forces THEME_ONLY.
      if (!m.company.stockTicker && !luxuryPairAddress(m.company.id)) {
        expect(m.state).toBe("THEME_ONLY");
        expect(m.launchable).toBe(false);
        expect(m.asset).toBeNull();
      }
    }
  });

  it("only presents a market as launchable if the factory approves its pair", async () => {
    // The end-to-end honesty guard, and the one that must keep holding once
    // luxury pair tokens replace Stock Tokens as the asset behind a company.
    const { markets } = await resolveLuxuryMarkets();
    for (const m of markets.filter((x) => x.launchable)) {
      expect(m.asset, `${m.company.companyName} is launchable with no asset`).not.toBeNull();
      expect(m.assetSource).not.toBeNull();
      const check = await verifyPairApproved(m.asset!.address as Address);
      expect(
        check.approved,
        `${m.company.companyName} is presented as launchable but the factory rejects its pair`,
      ).toBe(true);
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
    // Label by the resolved asset, not the ticker: a luxury pair token has a
    // symbol but no Robinhood ticker, and would otherwise print "(undefined)".
    const tag = (m: (typeof markets)[number]) =>
      `${m.company.companyName} (${m.asset?.symbol ?? m.company.stockTicker ?? "—"})`;
    process.stdout.write(
      `\n  PAIR AVAILABLE : ${launchable.map(tag).join(", ")}\n` +
      `  DISCOVERY ONLY : ${markets.filter((m) => m.state === "DISCOVERY_ONLY").map(tag).join(", ")}\n` +
      `  THEME ONLY     : ${markets.filter((m) => m.state === "THEME_ONLY").map((m) => m.company.companyName).join(", ")}\n\n`,
    );
    expect(launchable.length).toBeGreaterThan(0);
  });
});
