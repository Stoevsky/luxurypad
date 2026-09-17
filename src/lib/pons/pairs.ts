import { encodeFunctionData, keccak256, parseEther, toHex, zeroAddress, type Address, type Hex } from "viem";
import { ponsFactoryViewsAbi, ponsLaunchAbi } from "./abi";
import { ACTIVE_DEPLOYMENT } from "./deployment";
import { rpc } from "./client";
import { isNative } from "./curve";
import { singleFlight } from "@/lib/cache";

/**
 * Is `quoteAsset` actually accepted by Pons as a launch pair?
 *
 * There is no public view function for the allowlist, so we ask the protocol
 * the only way that cannot be wrong: we simulate a real `launchToken` against
 * the live factory with `eth_call` and a balance state-override, and read the
 * revert selector.
 *
 *   0x49285dfb  PairTokenNotApproved()          -> definitively NOT a pair
 *   0xecb27319  LaunchEconomicsMismatch(b32,b32) -> pair IS approved, economics
 *                                                   commitment needs refreshing
 *   success                                      -> pair approved, economics ok
 *
 * This is also why the launch flow can promise "verify pair support" honestly:
 * it is the same call path the real transaction takes.
 */
export const PAIR_NOT_APPROVED_SELECTOR = "0x49285dfb";
export const ECONOMICS_MISMATCH_SELECTOR = "0xecb27319";

/** A zero commitment means "accept the protocol's current economics". */
export const OPEN_ECONOMICS_COMMITMENT =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

/**
 * Launch fee observed on every sampled mainnet launch, and confirmed by reading
 * `launchFee()` off the factory (5e14 wei). Used only as a fallback when that
 * read fails — a *different* deployment may well charge something else, so
 * `launchFee()` below is what the transaction is actually built from.
 */
export const OBSERVED_LAUNCH_FEE_WEI = parseEther("0.0005");

const FEE_TTL_MS = 5 * 60_000;
let feeCache: { value: bigint; at: number } | null = null;

/** The fee this deployment charges right now, read from chain. */
export async function launchFee(): Promise<bigint> {
  if (feeCache && Date.now() - feeCache.at < FEE_TTL_MS) return feeCache.value;
  if (!ACTIVE_DEPLOYMENT) return OBSERVED_LAUNCH_FEE_WEI;
  try {
    const value = await rpc().readContract({
      address: ACTIVE_DEPLOYMENT.launchFactory,
      abi: ponsFactoryViewsAbi,
      functionName: "launchFee",
    });
    feeCache = { value, at: Date.now() };
    return value;
  } catch {
    return OBSERVED_LAUNCH_FEE_WEI;
  }
}

/** Whether the factory is currently accepting launches at all. */
export async function launchEnabled(): Promise<boolean | null> {
  if (!ACTIVE_DEPLOYMENT) return null;
  try {
    return await rpc().readContract({
      address: ACTIVE_DEPLOYMENT.launchFactory,
      abi: ponsFactoryViewsAbi,
      functionName: "launchEnabled",
    });
  } catch {
    return null;
  }
}

const SIM_ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;

export type PairCheck = {
  quoteAsset: Address;
  approved: boolean;
  /** Raw revert selector when not approved, for diagnostics. */
  selector?: string;
  checkedAt: number;
};

const TTL_MS = 10 * 60_000;

function simulationCalldata(quoteAsset: Address, nonce: string) {
  return encodeFunctionData({
    abi: ponsLaunchAbi,
    functionName: "launchToken",
    args: [
      {
        name: "LuxuryPad Pair Check",
        symbol: "LPCHECK",
        imageUri: "",
        description: "",
        socials: { website: "", x: "", telegram: "", discord: "", extra: "" },
        creator: SIM_ACCOUNT,
        creatorTaxBps: 0,
        buybackEnabled: false,
        salt: OPEN_ECONOMICS_COMMITMENT,
        originRef: keccak256(toHex(`luxurypad-paircheck-${nonce}`)),
      },
      0n,
      quoteAsset,
      [],
    ],
  });
}

function revertSelector(error: unknown): string | undefined {
  const err = error as { cause?: { data?: unknown }; data?: unknown };
  const data = err?.cause?.data ?? err?.data;
  return typeof data === "string" && data.startsWith("0x") ? data.slice(0, 10) : undefined;
}

/**
 * The original check: simulate a real launch and read the revert selector.
 * Kept as the fallback because it works against any deployment, including one
 * that exposes no allowlist view.
 */
async function simulatePairApproved(quoteAsset: Address): Promise<PairCheck> {
  const factory = ACTIVE_DEPLOYMENT!.launchFactory;
  const key = quoteAsset.toLowerCase();
  const data = simulationCalldata(quoteAsset, `${key}-${Date.now()}`);
  const fee = await launchFee();
  try {
    await rpc().request({
      method: "eth_call",
      params: [
        { from: SIM_ACCOUNT, to: factory, data, value: toHex(fee) },
        "latest",
        { [SIM_ACCOUNT]: { balance: toHex(parseEther("100")) } },
      ] as never,
    });
    return { quoteAsset, approved: true, checkedAt: Date.now() };
  } catch (error) {
    const selector = revertSelector(error);
    if (selector === PAIR_NOT_APPROVED_SELECTOR) {
      return { quoteAsset, approved: false, selector, checkedAt: Date.now() };
    }
    if (selector === ECONOMICS_MISMATCH_SELECTOR) {
      // Pair is allowlisted; only the economics commitment was stale.
      return { quoteAsset, approved: true, selector, checkedAt: Date.now() };
    }
    // Unknown failure (RPC problem, new protocol error). Do not claim support.
    throw error;
  }
}

async function checkPairApproved(quoteAsset: Address): Promise<PairCheck> {
  if (!ACTIVE_DEPLOYMENT) {
    throw new Error("No Pons deployment configured; cannot verify pair support.");
  }

  // Native ETH is accepted directly and is deliberately absent from the ERC-20
  // allowlist: on mainnet `approvedPairTokens(0x0)` answers false while a real
  // launch simulated with the zero address succeeds. Reading the allowlist
  // without this branch would block every ETH launch.
  if (isNative(quoteAsset)) {
    return { quoteAsset, approved: true, checkedAt: Date.now() };
  }

  try {
    const approved = await rpc().readContract({
      address: ACTIVE_DEPLOYMENT.launchFactory,
      abi: ponsFactoryViewsAbi,
      functionName: "approvedPairTokens",
      args: [quoteAsset],
    });
    return { quoteAsset, approved, checkedAt: Date.now() };
  } catch {
    return simulatePairApproved(quoteAsset);
  }
}

/** Concurrent checks for the same asset share one simulation. */
export const verifyPairApproved = singleFlight(checkPairApproved, TTL_MS, (a) => a.toLowerCase());

/** Native ETH is always a Pons quote asset; still verified like any other. */
export const NATIVE_PAIR = zeroAddress as Address;

export async function verifyPairsApproved(assets: Address[]): Promise<Map<string, PairCheck>> {
  const out = new Map<string, PairCheck>();
  const results = await Promise.allSettled(assets.map((a) => verifyPairApproved(a)));
  results.forEach((r, i) => {
    if (r.status === "fulfilled") out.set(assets[i].toLowerCase(), r.value);
  });
  return out;
}
