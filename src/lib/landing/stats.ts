import type { LaunchSummary } from "@/lib/indexer/launches";

export type LaunchStats = {
  /** Launches in the scan window. Exact — taken from the logs, not the sample. */
  total: number;
  /** How many of those were hydrated with curve state. */
  sampled: number;
  /** True when `sampled < total`, making the two counts below lower bounds. */
  partial: boolean;
  graduated: number;
  nearGraduation: number;
};

/**
 * Counts only, and deliberately so.
 *
 * `realQuoteReserve` is NOT summed here. Quote assets differ per launch — ETH,
 * TSLA, GLD, SLV — so adding them produces a figure in no unit at all, true of
 * nothing. Any future total must be scoped to a single quote asset and labelled
 * with it.
 *
 * The graduated / near-graduation split mirrors `sectionOf` in
 * ../indexer/launches.ts: graduated wins outright, so a launch is never counted
 * in both buckets. A `ready_to_graduate` curve is full but its pool is not
 * seeded yet, so it counts as near graduation — calling it graduated would
 * overstate what happened on chain.
 *
 * `scanTotal` is the number of launches the log scan actually found, and the
 * caller should always pass it. `launches.length` is NOT that number: it is the
 * size of the hydrated sample, which is smaller for two independent reasons.
 * The caller caps how many it hydrates to bound RPC fan-out, and `listLaunches`
 * drops any launch whose curve read rejected (`Promise.allSettled` + `flatMap`),
 * so the sample silently shrinks whenever the node is flaky. Publishing that
 * number as "Launches indexed" would understate the protocol and look precise
 * doing it — measured at 120 shown against 410 real on the first live run.
 *
 * `graduated` and `nearGraduation` can only be computed from hydrated launches,
 * so when `partial` is true they are lower bounds and must be presented as such.
 */
export function summarizeLaunches(launches: LaunchSummary[], scanTotal?: number): LaunchStats {
  let graduated = 0;
  let nearGraduation = 0;
  for (const l of launches) {
    if (l.phase === "graduated") graduated += 1;
    else if (l.progress >= 0.6) nearGraduation += 1;
  }
  const sampled = launches.length;
  const total = scanTotal ?? sampled;
  return { total, sampled, partial: sampled < total, graduated, nearGraduation };
}
