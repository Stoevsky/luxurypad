import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { summarizeLaunches } from "@/lib/landing/stats";
import { SECTOR_TEXTURES, sectorTexture } from "@/lib/registry/sector-art";
import { LUXURY_COMPANIES } from "@/lib/registry/luxury";
import type { LaunchSummary } from "@/lib/indexer/launches";
import type { LaunchPhase } from "@/lib/pons/curve";

/**
 * Pure unit suite. Unlike the *.live.test.ts files it makes no network calls,
 * so it must stay fast and must never be made to depend on the RPC.
 */

/** Only the two fields `summarizeLaunches` reads. */
function launch(phase: LaunchPhase, progress: number): LaunchSummary {
  return { phase, progress } as LaunchSummary;
}

describe("summarizeLaunches", () => {
  it("returns zeros for an empty list", () => {
    expect(summarizeLaunches([])).toEqual({ total: 0, graduated: 0, nearGraduation: 0 });
  });

  it("counts every launch in total", () => {
    const stats = summarizeLaunches([launch("curve", 0.1), launch("curve", 0.2)]);
    expect(stats.total).toBe(2);
  });

  it("counts graduated launches", () => {
    const stats = summarizeLaunches([launch("graduated", 1), launch("curve", 0.1)]);
    expect(stats.graduated).toBe(1);
  });

  it("counts a launch at exactly 60% as near graduation", () => {
    expect(summarizeLaunches([launch("curve", 0.6)]).nearGraduation).toBe(1);
  });

  it("does not count a launch below 60% as near graduation", () => {
    expect(summarizeLaunches([launch("curve", 0.59)]).nearGraduation).toBe(0);
  });

  it("never counts a graduated launch as also near graduation", () => {
    // Mirrors sectionOf() in launches.ts, where graduated wins outright.
    const stats = summarizeLaunches([launch("graduated", 1)]);
    expect(stats.graduated).toBe(1);
    expect(stats.nearGraduation).toBe(0);
  });

  it("counts a ready_to_graduate launch as near graduation, not graduated", () => {
    // The curve is full but the pool is not seeded yet. Calling that
    // "graduated" would overstate what actually happened on chain.
    const stats = summarizeLaunches([launch("ready_to_graduate", 1)]);
    expect(stats.graduated).toBe(0);
    expect(stats.nearGraduation).toBe(1);
  });
});

describe("sectorTexture", () => {
  it("has a texture for every sector that has an enabled company", () => {
    // The invariant that matters: adding a company in a new sector must not
    // silently render a blank tile on the landing page.
    const represented = new Set(LUXURY_COMPANIES.filter((c) => c.enabled).map((c) => c.sector));
    expect(represented.size).toBeGreaterThan(0);
    for (const sector of represented) {
      expect(
        sectorTexture(sector),
        `sector "${sector}" has companies but no texture`,
      ).not.toBeNull();
    }
  });

  it("returns null for a sector with no artwork", () => {
    expect(sectorTexture("other")).toBeNull();
  });

  it("returns a path under /textures", () => {
    expect(sectorTexture("fashion")).toMatch(/^\/textures\/.+\.webp$/);
  });

  it("points every mapped sector at a file that is actually on disk", () => {
    // The mapping being well-formed is not the same as the artwork existing.
    // Without this, deleting a texture still passes every other test here and
    // the failure surfaces as a broken image on the live landing page.
    for (const [sector, href] of Object.entries(SECTOR_TEXTURES)) {
      const file = join(process.cwd(), "public", href!.replace(/^\//, ""));
      expect(existsSync(file), `${sector} maps to ${href}, which is missing`).toBe(true);
    }
  });

  it("has the hero image the page and closing CTA both reference", () => {
    expect(existsSync(join(process.cwd(), "public", "textures", "hero.webp"))).toBe(true);
  });
});
