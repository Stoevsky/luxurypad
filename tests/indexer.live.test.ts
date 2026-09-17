import { describe, expect, it } from "vitest";
import { listLaunches, scanLaunches, findLaunchByToken, sectionOf } from "@/lib/indexer/launches";
import { requireDeployment } from "@/lib/pons/deployment";

const PONS_V2 = requireDeployment();

describe("launch indexer", () => {
  it("reads real TokenLaunched events from the Pons factory", async () => {
    const launches = await scanLaunches();
    expect(launches.length).toBeGreaterThan(0);
    for (const l of launches) {
      expect(l.token).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(l.curve).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(l.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      // Provenance is recorded on every row.
      expect(l.factory.toLowerCase()).toBe(PONS_V2.launchFactory.toLowerCase());
      expect(l.protocolVersion).toBe("pons-v2");
      expect(l.graduationThreshold).toBeGreaterThan(0n);
    }
  });

  it("bounds the default scan window instead of scanning from genesis", async () => {
    // Regression: losing the default window made this query start at block 0,
    // which the node rejects once it matches more than 10,000 logs.
    //
    // Asserted as the span of the returned blocks rather than the distance from
    // a freshly-read head: `scanLaunches` is singleFlight-cached for 30s, so a
    // head read here can be newer than the head the cached scan actually used,
    // which made the head-relative form fail intermittently by a few blocks.
    const launches = await scanLaunches();
    expect(launches.length).toBeGreaterThan(0);
    const blocks = launches.map((l) => l.blockNumber);
    const span = blocks.reduce((a, b) => (b > a ? b : a)) - blocks.reduce((a, b) => (b < a ? b : a));
    expect(span).toBeLessThanOrEqual(20_000n);
  });

  it("returns newest first", async () => {
    const launches = await scanLaunches();
    for (let i = 1; i < launches.length; i++) {
      expect(launches[i - 1].blockNumber >= launches[i].blockNumber).toBe(true);
    }
  });

  it("hydrates launches with real token metadata and curve state", async () => {
    const list = await listLaunches(6);
    expect(list.length).toBeGreaterThan(0);
    for (const l of list) {
      expect(l.symbol.length).toBeGreaterThan(0);
      expect(l.progress).toBeGreaterThanOrEqual(0);
      expect(l.progress).toBeLessThanOrEqual(1);
      expect(["curve", "ready_to_graduate", "graduated"]).toContain(l.phase);
      expect(["new", "trending", "near_graduation", "graduated"]).toContain(sectionOf(l));
    }
  });

  it("resolves a launch from its token address only", async () => {
    const [first] = await scanLaunches();
    const found = await findLaunchByToken(first.token);
    expect(found).not.toBeNull();
    expect(found!.curve.toLowerCase()).toBe(first.curve.toLowerCase());
  });

  it("does not invent a launch for an unknown token", async () => {
    const found = await findLaunchByToken("0x2222222222222222222222222222222222222222");
    expect(found).toBeNull();
  });
});
