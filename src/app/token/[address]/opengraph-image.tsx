import { ImageResponse } from "next/og";
import { isAddress, type Address } from "viem";
import { findLaunchByToken } from "@/lib/indexer/launches";
import { readCurveState, readTokenMeta, graduationProgress } from "@/lib/pons/curve";
import { resolveLuxuryMarkets, pairingLabel } from "@/lib/registry/resolve";

export const alt = "LuxuryPad launch";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Share card. Deliberately states the pairing and the disclosure rather than
 * performance — no price, no multiples, nothing that reads as a return
 * advertisement.
 */
export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;

  let name = "LuxuryPad";
  let symbol = "";
  let pairing = "Luxury, launched onchain.";
  let progress = 0;

  if (isAddress(address)) {
    try {
      const launch = await findLaunchByToken(address as Address);
      if (launch) {
        const [meta, state, registry] = await Promise.all([
          readTokenMeta(launch.token),
          readCurveState(launch.curve),
          resolveLuxuryMarkets().catch(() => ({ markets: [] as never[] })),
        ]);
        name = meta.name;
        symbol = meta.symbol;
        progress = graduationProgress(state);
        const market = registry.markets.find(
          (m) => m.asset?.address.toLowerCase() === state.quoteAsset.toLowerCase(),
        );
        pairing = pairingLabel(market, { isNativeQuote: state.isNativeQuote });
      }
    } catch {
      /* fall back to the brand card rather than render a wrong claim */
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F4F0E8",
          color: "#11100F",
          padding: 72,
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 26, letterSpacing: -0.5 }}>LuxuryPad</div>
          <div style={{ fontSize: 15, letterSpacing: 3, color: "#817A70", textTransform: "uppercase" }}>
            Pons V2 · Robinhood Chain
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 88, lineHeight: 1, letterSpacing: -2 }}>{name}</div>
          {symbol ? (
            <div style={{ fontSize: 30, color: "#817A70", fontFamily: "monospace" }}>{`$${symbol}`}</div>
          ) : null}
          <div style={{ fontSize: 26, color: "#642B35" }}>{pairing}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", width: "100%", height: 3, background: "#DDD6C8" }}>
            <div style={{ width: `${Math.round(progress * 100)}%`, height: 3, background: "#B99A62" }} />
          </div>
          <div style={{ fontSize: 17, color: "#817A70", maxWidth: 940, lineHeight: 1.45 }}>
            LuxuryPad launches are independent user-created crypto tokens. They do not represent
            ownership, voting rights, dividends, or claims on the referenced companies.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
