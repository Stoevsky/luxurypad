import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatsBand } from "@/components/stats-band";
import type { LaunchStats } from "@/lib/landing/stats";

/**
 * The band's whole job is to be honest about numbers it may not have.
 *
 * Rendering to static markup needs no DOM, so these run in the same node
 * environment as the rest of the suite. What they protect is the degraded
 * path — the one nobody looks at, because the happy path is what you see while
 * developing and the RPC is usually up.
 */

const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const stats = (over: Partial<LaunchStats> = {}): LaunchStats => ({
  total: 394,
  sampled: 120,
  partial: true,
  graduated: 3,
  nearGraduation: 7,
  ...over,
});

describe("StatsBand", () => {
  it("renders Unavailable, never a zero, when the chain read failed", () => {
    // A 0 here would read as "nothing has ever launched on this protocol",
    // which is false. Unavailable is the only honest thing to show.
    const out = text(renderToStaticMarkup(<StatsBand stats={null} launchFeeWei={null} />));
    expect(out).not.toMatch(/\b0\b/);
    expect(out.match(/Unavailable/g)).toHaveLength(4);
  });

  it("still labels all four figures when they are unavailable", () => {
    const out = text(renderToStaticMarkup(<StatsBand stats={null} launchFeeWei={null} />));
    for (const label of ["Launches indexed", "Graduated", "Near graduation", "Launch fee"]) {
      expect(out).toContain(label);
    }
  });

  it("degrades each figure independently", () => {
    // A live launch fee alongside a failed log scan is the common case: the fee
    // is one eth_call, the scan is an eth_getLogs, and only the latter is
    // rate-limited. One failing must not blank the other.
    const out = text(renderToStaticMarkup(<StatsBand stats={null} launchFeeWei={500_000_000_000_000n} />));
    expect(out).toContain("0.0005 ETH");
    expect(out.match(/Unavailable/g)).toHaveLength(3);
  });

  it("publishes the scan total rather than the sample size", () => {
    const out = text(renderToStaticMarkup(<StatsBand stats={stats()} launchFeeWei={null} />));
    expect(out).toContain("394");
  });

  it("says which sample the graduated counts were taken over", () => {
    // Without this the two counts look like a census of all 394.
    const out = text(renderToStaticMarkup(<StatsBand stats={stats()} launchFeeWei={null} />));
    expect(out.match(/of 120 sampled/g)).toHaveLength(2);
  });

  it("drops the sample note once hydration covered the whole window", () => {
    const full = stats({ total: 120, sampled: 120, partial: false });
    const out = text(renderToStaticMarkup(<StatsBand stats={full} launchFeeWei={null} />));
    expect(out).not.toContain("sampled");
  });

  it("qualifies the launch count as a rolling block window", () => {
    // The figure falls as old launches age out the back of the scan. Presented
    // bare it looks like an all-time total that mysteriously shrinks.
    const out = text(renderToStaticMarkup(<StatsBand stats={stats()} launchFeeWei={null} />));
    expect(out).toContain("last 20,000 blocks");
  });
});
