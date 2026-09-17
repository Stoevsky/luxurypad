import {
  encodeFunctionData,
  keccak256,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { ponsLaunchAbi, erc20Abi } from "./abi";
import { PONS_V2 } from "./contracts";
import { rpc } from "./client";
import { OBSERVED_LAUNCH_FEE_WEI, OPEN_ECONOMICS_COMMITMENT, verifyPairApproved } from "./pairs";
import { isNative } from "./curve";

export type LaunchDraft = {
  name: string;
  symbol: string;
  imageUri: string;
  description: string;
  website?: string;
  x?: string;
  telegram?: string;
  creator: Address;
  creatorTaxBps: number;
  quoteAsset: Address;
  /** Optional first buy, in quote-asset units. */
  initialBuy: bigint;
  minAmountOut: bigint;
};

export type PreflightCheck = {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  detail: string;
};

export type PreflightResult = {
  ok: boolean;
  checks: PreflightCheck[];
  /** Populated only when every blocking check passed. */
  transaction?: {
    to: Address;
    data: Hex;
    value: bigint;
    /** Predicted addresses returned by the simulation. */
    predictedToken: Address;
    predictedCurve: Address;
    gas?: bigint;
  };
  /** Set when an ERC-20 pair needs approving before the launch can be sent. */
  requiresApproval?: { token: Address; spender: Address; amount: bigint };
};

/** Deterministic-but-unique salt so two launches never collide in CREATE2. */
export function launchSalt(creator: Address, symbol: string): Hex {
  return keccak256(toHex(`luxurypad:${creator.toLowerCase()}:${symbol}:${Date.now()}:${Math.random()}`));
}

function buildParams(draft: LaunchDraft, salt: Hex) {
  return {
    name: draft.name,
    symbol: draft.symbol,
    imageUri: draft.imageUri,
    description: draft.description,
    socials: {
      website: draft.website ?? "",
      x: draft.x ?? "",
      telegram: draft.telegram ?? "",
      discord: "",
      extra: "",
    },
    creator: draft.creator,
    creatorTaxBps: draft.creatorTaxBps,
    buybackEnabled: false,
    // Zero commitment = accept the protocol's current economics. A non-zero
    // value pins the launch to one exact economics hash and reverts with
    // LaunchEconomicsMismatch if the protocol changed underneath us.
    salt: OPEN_ECONOMICS_COMMITMENT,
    originRef: salt,
  } as const;
}

export function encodeLaunch(draft: LaunchDraft, salt: Hex) {
  const params = buildParams(draft, salt);
  const useRouter = draft.initialBuy > 0n;

  if (useRouter) {
    return {
      to: PONS_V2.launchAndBuy,
      data: encodeFunctionData({
        abi: ponsLaunchAbi,
        functionName: "launchAndBuy",
        args: [params, 0n, draft.quoteAsset, draft.initialBuy, draft.minAmountOut, draft.creator, []],
      }),
    };
  }
  return {
    to: PONS_V2.launchFactory,
    data: encodeFunctionData({
      abi: ponsLaunchAbi,
      functionName: "launchToken",
      args: [params, 0n, draft.quoteAsset, []],
    }),
  };
}

/** Native value the transaction must carry: launch fee plus any native first buy. */
export function launchValue(draft: LaunchDraft): bigint {
  const nativeBuy = isNative(draft.quoteAsset) ? draft.initialBuy : 0n;
  return OBSERVED_LAUNCH_FEE_WEI + nativeBuy;
}

/**
 * Everything that must be true immediately before we ask for a signature.
 * The final check is a real `eth_call` of the exact transaction we are about to
 * send — if that fails, we never show the wallet prompt.
 */
export async function preflightLaunch(draft: LaunchDraft): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];
  const client = rpc();
  const push = (c: PreflightCheck) => checks.push(c);

  // 1. Chain identity — never silently act on the wrong network.
  let chainOk = false;
  try {
    const chainId = await client.getChainId();
    chainOk = chainId === PONS_V2.chainId;
    push({
      id: "chain",
      label: "Network",
      status: chainOk ? "pass" : "fail",
      detail: chainOk ? "Robinhood Chain (4663)" : `Connected to chain ${chainId}, expected 4663.`,
    });
  } catch {
    push({ id: "chain", label: "Network", status: "fail", detail: "Could not reach the network." });
  }

  // 2. The factory must actually be a contract at the pinned address.
  try {
    const code = await client.getCode({ address: PONS_V2.launchFactory });
    const deployed = Boolean(code && code !== "0x");
    push({
      id: "factory",
      label: "Launch contract",
      status: deployed ? "pass" : "fail",
      detail: deployed ? `Pons V2 factory verified at ${PONS_V2.launchFactory}` : "Factory bytecode missing.",
    });
  } catch {
    push({ id: "factory", label: "Launch contract", status: "fail", detail: "Could not verify the factory." });
  }

  // 3. Pair allowlist — the check that stops us lying about "Paired with".
  try {
    const pair = await verifyPairApproved(draft.quoteAsset);
    push({
      id: "pair",
      label: "Pair asset",
      status: pair.approved ? "pass" : "fail",
      detail: pair.approved
        ? isNative(draft.quoteAsset)
          ? "ETH is an approved Pons pair."
          : `${draft.quoteAsset} is an approved Pons pair.`
        : "This luxury market isn't currently available as a launch pair.",
    });
  } catch {
    push({ id: "pair", label: "Pair asset", status: "fail", detail: "Could not confirm pair support." });
  }

  // 4. Funds for the launch fee and any first buy.
  const requiredNative = launchValue(draft);
  let requiresApproval: PreflightResult["requiresApproval"];
  try {
    const balance = await client.getBalance({ address: draft.creator });
    const enough = balance >= requiredNative;
    push({
      id: "balance",
      label: "Balance",
      status: enough ? "pass" : "fail",
      detail: enough
        ? "Sufficient ETH for the launch fee and gas."
        : "Not enough ETH to cover the launch fee and gas.",
    });
  } catch {
    push({ id: "balance", label: "Balance", status: "warn", detail: "Balance unavailable." });
  }

  // 5. ERC-20 pair assets need both balance and allowance before launching.
  if (!isNative(draft.quoteAsset) && draft.initialBuy > 0n) {
    try {
      const [bal, allowance] = await Promise.all([
        client.readContract({
          address: draft.quoteAsset, abi: erc20Abi, functionName: "balanceOf", args: [draft.creator],
        }),
        client.readContract({
          address: draft.quoteAsset, abi: erc20Abi, functionName: "allowance",
          args: [draft.creator, PONS_V2.launchAndBuy],
        }),
      ]);
      const hasBalance = bal >= draft.initialBuy;
      push({
        id: "pair-balance",
        label: "Pair balance",
        status: hasBalance ? "pass" : "fail",
        detail: hasBalance ? "Sufficient pair-asset balance." : "Not enough of the pair asset for your first buy.",
      });
      const approved = allowance >= draft.initialBuy;
      push({
        id: "allowance",
        label: "Pair allowance",
        status: approved ? "pass" : "warn",
        detail: approved ? "Pons is approved to spend the pair asset." : "Approval required before launching.",
      });
      if (!approved) {
        requiresApproval = {
          token: draft.quoteAsset,
          spender: PONS_V2.launchAndBuy,
          amount: draft.initialBuy,
        };
      }
    } catch {
      push({ id: "allowance", label: "Pair allowance", status: "warn", detail: "Allowance unavailable." });
    }
  }

  // 6. Simulate the exact transaction. This is the real gate.
  const salt = launchSalt(draft.creator, draft.symbol);
  const { to, data } = encodeLaunch(draft, salt);
  let transaction: PreflightResult["transaction"];

  const blocking = checks.some((c) => c.status === "fail");
  if (!blocking && !requiresApproval) {
    try {
      const raw = await client.request({
        method: "eth_call",
        params: [{ from: draft.creator, to, data, value: toHex(requiredNative) }, "latest"] as never,
      });
      const hex = raw as Hex;
      const predictedToken = (`0x${hex.slice(26, 66)}`) as Address;
      const predictedCurve = (`0x${hex.slice(90, 130)}`) as Address;

      let gas: bigint | undefined;
      try {
        gas = await client.estimateGas({ account: draft.creator, to, data, value: requiredNative });
      } catch {
        /* gas estimate is advisory */
      }

      push({
        id: "simulation",
        label: "Transaction simulation",
        status: "pass",
        detail: `Simulated successfully. Token ${predictedToken.slice(0, 10)}…`,
      });
      transaction = { to, data, value: requiredNative, predictedToken, predictedCurve, gas };
    } catch (error) {
      push({
        id: "simulation",
        label: "Transaction simulation",
        status: "fail",
        detail: describeLaunchRevert(error),
      });
    }
  } else if (requiresApproval) {
    push({
      id: "simulation",
      label: "Transaction simulation",
      status: "warn",
      detail: "Approve the pair asset first, then the launch will be simulated.",
    });
  }

  return {
    ok: checks.every((c) => c.status !== "fail") && Boolean(transaction),
    checks,
    transaction,
    requiresApproval,
  };
}

/** Map protocol reverts to copy a person can act on. Never leak a stack trace. */
export function describeLaunchRevert(error: unknown): string {
  const err = error as { cause?: { data?: unknown }; data?: unknown; message?: string };
  const data = err?.cause?.data ?? err?.data;
  const selector = typeof data === "string" ? data.slice(0, 10) : "";
  switch (selector) {
    case "0x49285dfb":
      return "This luxury market isn't currently available as a launch pair.";
    case "0xecb27319":
      return "The launch configuration changed. Review the updated terms.";
    case "0xb06ebf3d":
      return "That ticker is already taken. Try a different one.";
    case "0xbc0ecfe3":
      return "Those launch economics were rejected. Check your creator tax.";
    case "0xd92e233d":
      return "A required address was empty.";
    case "0x1f2a2005":
      return "An amount was zero.";
    default:
      return "We couldn't simulate this launch. Please review your details and try again.";
  }
}

export const NATIVE_ASSET = zeroAddress as Address;
