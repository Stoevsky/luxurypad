import type { LaunchSummary } from "@/lib/indexer/launches";

export type LaunchStats = {
  total: number;
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
 */
export function summarizeLaunches(launches: LaunchSummary[]): LaunchStats {
  let graduated = 0;
  let nearGraduation = 0;
  for (const l of launches) {
    if (l.phase === "graduated") graduated += 1;
    else if (l.progress >= 0.6) nearGraduation += 1;
  }
  return { total: launches.length, graduated, nearGraduation };
}
