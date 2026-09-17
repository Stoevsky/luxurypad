import { describe, expect, it } from "vitest";
import { zeroAddress } from "viem";
import { NATIVE_MARKET, sectorFilters } from "@/components/launch-wizard";
import type { LuxurySector } from "@/lib/registry/luxury";

/**
 * The launch wizard used to render a fixed list of six sector tabs. Only three
 * of them can hold a verified pair on this deployment, so the other three were
 * guaranteed dead ends — you clicked "Watches" and got an empty panel that read
 * as a broken page. A tab must not exist unless something is behind it.
 */

const market = (sector: LuxurySector) => ({ company: { sector } });

describe("sectorFilters", () => {
  it("offers no tab for a sector with nothing launchable", () => {
    const filters = sectorFilters([market("fashion"), market("automotive")]);
    expect(filters.map((f) => f.id)).not.toContain("watches");
    expect(filters.map((f) => f.id)).not.toContain("beauty");
    expect(filters.map((f) => f.id)).not.toContain("hospitality");
  });

  it("every tab it does offer has at least one pair behind it", () => {
    const filters = sectorFilters([
      market("materials"),
      market("materials"),
      market("automotive"),
    ]);
    expect(filters.every((f) => f.count > 0)).toBe(true);
  });

  it("counts each sector and totals them under All", () => {
    const filters = sectorFilters([
      market("automotive"),
      market("automotive"),
      market("materials"),
      market("materials"),
      market("fashion"),
    ]);
    expect(filters[0]).toEqual({ id: "all", label: "All", count: 5 });
    expect(filters.find((f) => f.id === "automotive")?.count).toBe(2);
    expect(filters.find((f) => f.id === "materials")?.count).toBe(2);
    expect(filters.find((f) => f.id === "fashion")?.count).toBe(1);
  });

  it("orders the busiest sector first, then alphabetically", () => {
    const filters = sectorFilters([
      market("fashion"),
      market("automotive"),
      market("automotive"),
      market("materials"),
    ]);
    expect(filters.map((f) => f.id)).toEqual(["all", "automotive", "fashion", "materials"]);
  });

  it("leaves only All when the chain check verified nothing", () => {
    expect(sectorFilters([])).toEqual([{ id: "all", label: "All", count: 0 }]);
  });

  it("gives native ETH no sector tab of its own", () => {
    const filters = sectorFilters([NATIVE_MARKET, market("automotive")]);
    expect(filters.map((f) => f.id)).toEqual(["all", "automotive"]);
    // It is still selectable — it just lives under All.
    expect(filters[0].count).toBe(2);
  });
});

describe("NATIVE_MARKET", () => {
  it("quotes against the zero address so no ERC-20 approval is needed", () => {
    // launch.ts skips both the balance and allowance checks for a native quote
    // and folds the initial buy into the transaction value instead.
    expect(NATIVE_MARKET.asset?.address).toBe(zeroAddress);
    expect(NATIVE_MARKET.asset?.decimals).toBe(18);
  });

  it("is launchable, because Pons always accepts native ETH as a pair", () => {
    expect(NATIVE_MARKET.launchable).toBe(true);
    expect(NATIVE_MARKET.state).toBe("PAIR_AVAILABLE");
  });

  it("is not presented as a tokenised equity", () => {
    expect(NATIVE_MARKET.assetSource).toBeNull();
    expect(NATIVE_MARKET.quote).toBeNull();
  });
});
