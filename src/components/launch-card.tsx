import Link from "next/link";
import { Card, Progress, StatePill } from "@/components/ui";
import { pairingLabel, type LuxuryMarket } from "@/lib/registry/resolve";
import { formatQuoteAmount, relativeAge } from "@/lib/format";
import type { LaunchSummary } from "@/lib/indexer/launches";

/** Pons uses the zero address to mean the chain's native asset. */
const NATIVE = "0x0000000000000000000000000000000000000000";

/**
 * One launch, as it stands on the curve.
 *
 * Shared by `/explore` and the landing page's featured strip. It lives here
 * rather than in either page because the two must not drift: a card that showed
 * a different taken-in figure, or hedged its pairing language differently,
 * depending on which page you arrived from would be the kind of inconsistency
 * users are right to read as carelessness about the numbers.
 */
export function LaunchCard({
  launch,
  market,
  quoteSymbol: registrySymbol,
}: {
  launch: LaunchSummary;
  market?: LuxuryMarket;
  quoteSymbol?: string;
}) {
  const isNativeQuote = launch.quoteAsset === NATIVE;
  // Name the unit whenever it is known. An unlabelled "13.993" reads as ETH to
  // anyone skimming, which is exactly the wrong thing for a Stock Token pair.
  const quoteSymbol = isNativeQuote ? "ETH" : market?.asset?.symbol ?? registrySymbol ?? "";
  return (
    <Link href={`/token/${launch.token}`} className="block">
      <Card interactive className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="display truncate text-[19px] leading-tight">{launch.name}</p>
            <p className="tabular text-[11px] uppercase tracking-[0.12em] text-muted">
              ${launch.symbol}
            </p>
          </div>
          {market ? <StatePill state={market.state} /> : null}
        </div>

        <dl className="grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="eyebrow">Taken in</dt>
            <dd className="tabular">{formatQuoteAmount(launch.realQuoteReserve, quoteSymbol)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Creator tax</dt>
            <dd className="tabular">{(launch.creatorTaxBps / 100).toFixed(2)}%</dd>
          </div>
        </dl>

        <div className="mt-auto space-y-3">
          <Progress
            value={launch.progress}
            label={`${Math.round(launch.progress * 100)}% to graduation`}
          />
          <p className="text-[11px] text-muted">
            {/* Pairing language is guarded: only a verified market may say "Paired with". */}
            {pairingLabel(market, { isNativeQuote })}
            {" · "}
            {relativeAge(launch.launchedAt)}
          </p>
        </div>
      </Card>
    </Link>
  );
}
