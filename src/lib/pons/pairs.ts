import { encodeFunctionData, keccak256, parseEther, toHex, zeroAddress, type Address, type Hex } from "viem";
import { ponsLaunchAbi } from "./abi";
import { PONS_V2 } from "./contracts";
import { rpc } from "./client";
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

/** Launch fee observed on every sampled mainnet launch. Re-read, never assumed. */
export const OBSERVED_LAUNCH_FEE_WEI = parseEther("0.0005");

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

async function checkPairApproved(quoteAsset: Address): Promise<PairCheck> {
  const key = quoteAsset.toLowerCase();
  const client = rpc();
  const data = simulationCalldata(quoteAsset, `${key}-${Date.now()}`);
  let result: PairCheck;
  try {
    await client.request({
      method: "eth_call",
      params: [
        { from: SIM_ACCOUNT, to: PONS_V2.launchFactory, data, value: toHex(OBSERVED_LAUNCH_FEE_WEI) },
        "latest",
        { [SIM_ACCOUNT]: { balance: toHex(parseEther("100")) } },
      ] as never,
    });
    result = { quoteAsset, approved: true, checkedAt: Date.now() };
  } catch (error) {
    const selector = revertSelector(error);
    if (selector === PAIR_NOT_APPROVED_SELECTOR) {
      result = { quoteAsset, approved: false, selector, checkedAt: Date.now() };
    } else if (selector === ECONOMICS_MISMATCH_SELECTOR) {
      // Pair is allowlisted; only the economics commitment was stale.
      result = { quoteAsset, approved: true, selector, checkedAt: Date.now() };
    } else {
      // Unknown failure (RPC problem, new protocol error). Do not claim support.
      throw error;
    }
  }
  return result;
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
