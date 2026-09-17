import { Card, Progress, Rule, Unavailable } from "@/components/ui";
import type { LaunchSummary } from "@/lib/indexer/launches";

const PHASE_LABEL: Record<LaunchSummary["phase"], string> = {
  curve: "On the curve",
  ready_to_graduate: "Ready to graduate",
  graduated: "Graduated",
};

/**
 * A still of the real trade panel, shown in the hero so the landing page can
 * say what the product actually looks like.
 *
 * Every figure here comes from a launch that exists on chain — the name, the
 * ticker, the phase, the curve progress and the creator tax are all read from
 * `LaunchSummary`. Nothing is invented. That constraint is the reason the
 * amount field is rendered empty rather than pre-filled with a flattering
 * number: an amount implies a quote, a quote implies a price, and this
 * component has neither. Empty is the panel's genuine state before you type,
 * so it is the only state that can be shown without making something up.
 *
 * For the same reason the protocol fee row is absent. `feeBps` lives in
 * per-curve state that the landing page does not fetch, and a plausible-looking
 * "0.30%" would be a guess wearing the costume of a fact.
 *
 * Deliberately not interactive, and marked `inert` plus `aria-hidden` so the
 * controls are not reachable by keyboard or screen reader. It is a photograph
 * of a UI, and it should not pretend to be the UI.
 */
export function HeroPreview({
  launch,
  quoteSymbol,
}: {
  launch: LaunchSummary | null;
  quoteSymbol: string | null;
}) {
  const pct = launch ? Math.round(launch.progress * 100) : null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <p className="eyebrow">Product preview</p>
        <p className="text-[11px] text-muted">{launch ? "Live launch" : "Chain data unavailable"}</p>
      </div>

      <div inert aria-hidden="true" className="select-none p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[17px]">{launch ? launch.name : <Unavailable />}</p>
            <p className="tabular text-[11px] uppercase tracking-[0.12em] text-muted">
              {launch ? `$${launch.symbol}` : "—"}
            </p>
          </div>
          <span className="shrink-0 border border-line px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted">
            {launch ? PHASE_LABEL[launch.phase] : "—"}
          </span>
        </div>

        <div className="mt-4">
          <Progress
            value={launch ? launch.progress : 0}
            label={pct === null ? "Graduation progress unavailable" : `${pct}% to graduation`}
          />
        </div>

        <Rule className="my-5" />

        <div className="grid grid-cols-2 gap-px border border-line bg-line">
          <span className="bg-ink py-2 text-center text-[13px] text-ground">Buy</span>
          <span className="bg-card py-2 text-center text-[13px] text-muted">Sell</span>
        </div>

        <div className="mt-4 space-y-2">
          <p className="eyebrow">You pay</p>
          <div className="flex items-center border border-line bg-card">
            <span className="tabular w-full px-4 py-3 text-[17px] text-muted">0.0</span>
            <span className="tabular shrink-0 px-4 text-[13px] text-muted">{quoteSymbol ?? "—"}</span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <p className="eyebrow">Slippage</p>
          <div className="flex gap-2">
            {["0.5%", "1.0%", "2.0%"].map((s) => (
              <span
                key={s}
                className={`tabular border px-3 py-1 text-[12px] ${
                  s === "1.0%" ? "border-ink bg-ink text-ground" : "border-line bg-card text-muted"
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <Rule className="my-5" />

        <div className="flex items-baseline justify-between gap-4 text-[13px]">
          <span className="text-muted">Creator tax</span>
          <span className="tabular">
            {launch ? `${(launch.creatorTaxBps / 100).toFixed(2)}%` : <Unavailable />}
          </span>
        </div>

        <div className="mt-5 border border-ink bg-ink py-3 text-center text-[14px] text-ground">
          Connect a wallet
        </div>
      </div>
    </Card>
  );
}
