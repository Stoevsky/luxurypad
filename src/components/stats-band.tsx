import { Container, Stat, Unavailable } from "@/components/ui";
import { formatAmount } from "@/lib/format";
import { DEFAULT_WINDOW } from "@/lib/indexer/launches";
import type { LaunchStats } from "@/lib/landing/stats";

/**
 * `stats` is null when the chain read failed. Every figure then renders
 * `Unavailable` rather than 0 — a zero here would read as "nothing has ever
 * launched", which is false and is exactly the fabrication this repo forbids.
 */
export function StatsBand({
  stats,
  launchFeeWei,
}: {
  stats: LaunchStats | null;
  launchFeeWei: bigint | null;
}) {
  const hint = "Chain data is temporarily unavailable";
  // Reading curve state costs two calls per launch, so only a sample of the
  // window is hydrated. The two counts below are therefore lower bounds, and
  // say so rather than passing themselves off as a census.
  const sampleNote =
    stats?.partial ? `of ${stats.sampled.toLocaleString()} sampled` : null;
  // The scan reaches back a fixed number of blocks, so this is a rolling window,
  // not an all-time total — it falls as old launches age out the back. Saying so
  // is the difference between a figure that looks wrong and one that is clear.
  const windowNote = `last ${Number(DEFAULT_WINDOW).toLocaleString()} blocks`;
  return (
    <section className="border-b border-line bg-card">
      <Container className="grid grid-cols-2 gap-x-8 gap-y-7 py-9 sm:py-11 lg:grid-cols-4">
        <Stat label="Launches indexed" note={stats ? windowNote : null}>
          {stats ? stats.total.toLocaleString() : <Unavailable hint={hint} />}
        </Stat>
        <Stat label="Graduated" note={sampleNote}>
          {stats ? stats.graduated.toLocaleString() : <Unavailable hint={hint} />}
        </Stat>
        <Stat label="Near graduation" note={sampleNote}>
          {stats ? stats.nearGraduation.toLocaleString() : <Unavailable hint={hint} />}
        </Stat>
        <Stat label="Launch fee">
          {launchFeeWei !== null ? (
            `${formatAmount(launchFeeWei, 18, 6)} ETH`
          ) : (
            <Unavailable hint={hint} />
          )}
        </Stat>
      </Container>
    </section>
  );
}
