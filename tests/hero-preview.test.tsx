import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroPreview } from "@/components/hero-preview";
import type { LaunchSummary } from "@/lib/indexer/launches";

/**
 * The hero preview is a still of the trade panel, so its risk is the opposite
 * of the trade panel's: it cannot execute anything, but it CAN mislead. These
 * cover the two ways it could — inventing a figure, or presenting itself as a
 * working control.
 */

const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Only the fields `HeroPreview` reads. */
const launch = (over: Partial<LaunchSummary> = {}): LaunchSummary =>
  ({
    name: "Hood vs Arc",
    symbol: "HVA",
    phase: "curve",
    progress: 0.42,
    creatorTaxBps: 200,
    ...over,
  }) as LaunchSummary;

describe("HeroPreview", () => {
  it("renders the launch's real name, ticker and creator tax", () => {
    const out = text(renderToStaticMarkup(<HeroPreview launch={launch()} quoteSymbol="ETH" />));
    expect(out).toContain("Hood vs Arc");
    expect(out).toContain("$HVA");
    expect(out).toContain("2.00%");
  });

  it("shows the curve progress as a rounded percentage", () => {
    const out = text(renderToStaticMarkup(<HeroPreview launch={launch()} quoteSymbol="ETH" />));
    expect(out).toContain("42% to graduation");
  });

  it("leaves the amount field empty rather than pre-filling a flattering number", () => {
    // An amount implies a quote and a quote implies a price. The component has
    // neither, so the only honest amount is the one the panel really starts at.
    const out = text(renderToStaticMarkup(<HeroPreview launch={launch()} quoteSymbol="ETH" />));
    expect(out).toContain("0.0");
    expect(out).not.toMatch(/You receive/);
  });

  it("degrades to Unavailable instead of collapsing when the chain read failed", () => {
    // The RPC rate-limits often enough that this is a routine state, not an
    // edge case. The shell has to survive it or the hero empties at random.
    const out = text(renderToStaticMarkup(<HeroPreview launch={null} quoteSymbol={null} />));
    expect(out).toContain("Unavailable");
    expect(out).toContain("Chain data unavailable");
  });

  it("invents no percentage when there is no launch to read one from", () => {
    const out = text(renderToStaticMarkup(<HeroPreview launch={null} quoteSymbol={null} />));
    expect(out).not.toMatch(/\d+% to graduation/);
    expect(out).toContain("Graduation progress unavailable");
  });

  it("still renders the panel's own furniture when degraded", () => {
    // Buy/Sell and the connect prompt are true regardless of chain state, so
    // they should survive — that is what keeps the hero from looking broken.
    const out = text(renderToStaticMarkup(<HeroPreview launch={null} quoteSymbol={null} />));
    for (const label of ["Buy", "Sell", "Slippage", "Connect a wallet"]) {
      expect(out).toContain(label);
    }
  });

  it("is inert and hidden from assistive tech, so it cannot pose as a real control", () => {
    const markup = renderToStaticMarkup(<HeroPreview launch={launch()} quoteSymbol="ETH" />);
    expect(markup).toMatch(/inert/);
    expect(markup).toMatch(/aria-hidden="true"/);
  });
});
