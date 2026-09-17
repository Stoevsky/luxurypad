import type { Address } from "viem";
import { PONS_V2_MAINNET, type PonsDeployment } from "./contracts";

/**
 * Which Pons deployment this instance launches against.
 *
 * The mainnet record in ./contracts.ts is pinned because it was verified on
 * chain. Any *other* deployment has to be supplied, and the rule here is that a
 * missing address disables launching rather than falling back to a guess: the
 * failure mode of guessing is a transaction sent to a contract that isn't Pons.
 *
 * Each env var is read as a literal `process.env.NEXT_PUBLIC_*` expression.
 * Next substitutes those textually at build time, so a computed lookup like
 * process.env[`NEXT_PUBLIC_${x}`] would work on the server and silently be
 * undefined in the browser — a launch page that renders then disables itself on
 * hydration. Spell each one out.
 */

export function parseAddress(raw: string | undefined): Address | null {
  const value = raw?.trim();
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : null;
}

function parseChainId(raw: string | undefined): number | null {
  const n = Number(raw?.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

const CONFIGURED_FACTORY = parseAddress(process.env.NEXT_PUBLIC_PONS_FACTORY);
const CONFIGURED_ROUTER = parseAddress(process.env.NEXT_PUBLIC_PONS_ROUTER);
const CONFIGURED_CHAIN_ID = parseChainId(process.env.NEXT_PUBLIC_CHAIN_ID);

/** The chain the app connects to. Defaults to Robinhood Chain. */
export const APP_CHAIN_ID = CONFIGURED_CHAIN_ID ?? PONS_V2_MAINNET.chainId;

/**
 * Resolves the deployment for a chain, or null when one cannot be established.
 *
 * Pure and exported so the rule is testable without mutating process.env.
 */
export function resolveDeployment(args: {
  chainId: number;
  factory: Address | null;
  router: Address | null;
}): PonsDeployment | null {
  if (args.factory) {
    return {
      protocolVersion: "pons-configured",
      chainId: args.chainId,
      launchFactory: args.factory,
      // Without a router, launch-and-buy is unavailable; `encodeLaunch` refuses
      // an initial buy rather than dropping it silently.
      launchAndBuy: args.router,
      provenance: "configured",
    };
  }
  // No override. Only the chain this repo actually verified may be assumed.
  if (args.chainId === PONS_V2_MAINNET.chainId) return PONS_V2_MAINNET;
  return null;
}

export const ACTIVE_DEPLOYMENT: PonsDeployment | null = resolveDeployment({
  chainId: APP_CHAIN_ID,
  factory: CONFIGURED_FACTORY,
  router: CONFIGURED_ROUTER,
});

/** Human-readable reason launching is unavailable, or null when it is available. */
export function launchUnavailableReason(
  deployment: PonsDeployment | null = ACTIVE_DEPLOYMENT,
): string | null {
  if (deployment) return null;
  return `No Pons deployment is configured for chain ${APP_CHAIN_ID}. Set NEXT_PUBLIC_PONS_FACTORY (and NEXT_PUBLIC_PONS_ROUTER for launch-and-buy).`;
}

/** Throwing accessor for paths that have already checked availability. */
export function requireDeployment(): PonsDeployment {
  if (!ACTIVE_DEPLOYMENT) throw new Error(launchUnavailableReason()!);
  return ACTIVE_DEPLOYMENT;
}
