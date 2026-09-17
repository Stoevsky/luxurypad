import { parseAbiItem, type Address, type Hex } from "viem";
import { PONS_V2 } from "@/lib/pons/contracts";
import { rpc, withRpc } from "@/lib/pons/client";
import { singleFlight } from "@/lib/cache";
import { readCurveState, readTokenMeta, graduationProgress, phaseOf, type LaunchPhase } from "@/lib/pons/curve";

/**
 * Launch indexing.
 *
 * Reads real `TokenLaunched` logs from the Pons factory. Every record stores
 * the exact factory and protocol version it was observed under, so a future
 * Pons deployment does not retroactively rewrite the history of older launches.
 *
 * This implementation is chain-backed with an in-memory window cache. The
 * Postgres schema in `supabase/migrations` mirrors these types exactly; moving
 * to durable storage means swapping the body of `listLaunches`, not the shape.
 */

export const TOKEN_LAUNCHED_EVENT = parseAbiItem(
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address quoteAsset, uint256 reserved, uint256 graduationThreshold)",
);

export type IndexedLaunch = {
  token: Address;
  curve: Address;
  creator: Address;
  quoteAsset: Address;
  graduationThreshold: bigint;
  blockNumber: bigint;
  txHash: Hex;
  /** Provenance — never assume today's contracts applied to an old launch. */
  factory: Address;
  protocolVersion: string;
};

export type LaunchSummary = IndexedLaunch & {
  name: string;
  symbol: string;
  decimals: number;
  phase: LaunchPhase;
  progress: number;
  realQuoteReserve: bigint;
  quoteReserve: bigint;
  tokenReserve: bigint;
  creatorTaxBps: number;
  launchedAt: number;
};

/** How far back a single scan reaches. The chain produces sub-second blocks. */
const DEFAULT_WINDOW = 20_000n;
const CACHE_TTL_MS = 30_000;

async function scanLaunchesUncached(window: bigint = DEFAULT_WINDOW): Promise<IndexedLaunch[]> {
  // Guard the default explicitly: an undefined window here would scan from
  // genesis and blow past the node's 10,000-log ceiling.
  const span = window > 0n ? window : DEFAULT_WINDOW;
  return withRpc(async () => {
    const client = rpc();
    const head = await client.getBlockNumber();
    const fromBlock = head > span ? head - span : 0n;
    const logs = await client.getLogs({
      address: PONS_V2.launchFactory,
      event: TOKEN_LAUNCHED_EVENT,
      fromBlock,
      toBlock: head,
    });

    return logs
      .filter((l) => l.args.token && l.args.curve && l.args.deployer)
      .map(
        (l): IndexedLaunch => ({
          token: l.args.token as Address,
          curve: l.args.curve as Address,
          creator: l.args.deployer as Address,
          quoteAsset: l.args.quoteAsset as Address,
          graduationThreshold: l.args.graduationThreshold as bigint,
          blockNumber: l.blockNumber,
          txHash: l.transactionHash,
          factory: PONS_V2.launchFactory,
          protocolVersion: PONS_V2.protocolVersion,
        }),
      )
      .reverse(); // newest first
  });
}

/** Concurrent scans of the same window share one `eth_getLogs` round trip. */
export const scanLaunches = singleFlight(
  (window?: bigint) => scanLaunchesUncached(window ?? DEFAULT_WINDOW),
  CACHE_TTL_MS,
  (window?: bigint) => String(window ?? DEFAULT_WINDOW),
);

/** Hydrate a page of launches with live token metadata and curve state. */
export async function listLaunches(limit = 24, window = DEFAULT_WINDOW): Promise<LaunchSummary[]> {
  const launches = await scanLaunches(window);
  const slice = launches.slice(0, limit);

  const hydrated = await Promise.allSettled(
    slice.map(async (l): Promise<LaunchSummary> => {
      const [meta, state] = await Promise.all([readTokenMeta(l.token), readCurveState(l.curve)]);
      return {
        ...l,
        name: meta.name,
        symbol: meta.symbol,
        decimals: meta.decimals,
        phase: phaseOf(state),
        progress: graduationProgress(state),
        realQuoteReserve: state.realQuoteReserve,
        quoteReserve: state.quoteReserve,
        tokenReserve: state.tokenReserve,
        creatorTaxBps: state.creatorTaxBps,
        launchedAt: state.launchedAt,
      };
    }),
  );

  return hydrated.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
}

/** Resolve a launch by its token address. Never trust a user-supplied curve. */
export async function findLaunchByToken(token: Address): Promise<IndexedLaunch | null> {
  const all = await scanLaunches();
  const hit = all.find((l) => l.token.toLowerCase() === token.toLowerCase());
  if (hit) return hit;

  // Fall back to a wider scan before giving up — the token may be older.
  const wide = await scanLaunches(120_000n);
  return wide.find((l) => l.token.toLowerCase() === token.toLowerCase()) ?? null;
}

export type ExploreSection = "new" | "trending" | "near_graduation" | "graduated";

export function sectionOf(launch: LaunchSummary): ExploreSection {
  if (launch.phase === "graduated") return "graduated";
  if (launch.progress >= 0.6) return "near_graduation";
  const ageHours = (Date.now() / 1000 - launch.launchedAt) / 3600;
  if (ageHours < 6) return "new";
  return "trending";
}
