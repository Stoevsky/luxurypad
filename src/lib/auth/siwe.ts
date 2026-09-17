import { SiweMessage, generateNonce } from "siwe";
import { createPublicClient, http, type Address } from "viem";
import { appChain } from "@/lib/chain/robinhood";
import { APP_CHAIN_ID } from "@/lib/pons/deployment";
import { SIWE_STATEMENT } from "./siwe.shared";

export { generateNonce };

export type VerifyInput = {
  message: string;
  signature: string;
  expectedNonce: string;
  expectedDomains: readonly string[];
};

/**
 * Which host(s) a login message may claim to have been issued for.
 *
 * Domain binding is what stops a signature farmed on another site being
 * replayed here, so the accepted host cannot come from anything the caller
 * controls. `Host` is a request header, and in production we refuse to trust
 * it: the canonical URL must be configured, and only it is accepted. Failing
 * closed is deliberate — an unset variable should break sign-in loudly rather
 * than quietly degrade the one check that makes it worth anything.
 *
 * Development is the exception, and only there: the request host is also
 * accepted so sign-in keeps working on whichever port `next dev` picked.
 */
export function resolveExpectedDomains(args: {
  configuredUrl: string | undefined;
  requestOrigin: string;
  isProduction: boolean;
}): { ok: true; domains: string[] } | { ok: false; reason: string } {
  let canonical: string | null = null;
  if (args.configuredUrl?.trim()) {
    try {
      canonical = new URL(args.configuredUrl.trim()).host;
    } catch {
      return { ok: false, reason: "NEXT_PUBLIC_APP_URL is not a valid URL." };
    }
  }

  if (args.isProduction) {
    return canonical
      ? { ok: true, domains: [canonical] }
      : { ok: false, reason: "NEXT_PUBLIC_APP_URL must be set in production." };
  }

  let requestHost: string | null = null;
  try {
    requestHost = new URL(args.requestOrigin).host;
  } catch {
    requestHost = null;
  }

  const domains = [...new Set([canonical, requestHost].filter((d): d is string => !!d))];
  return domains.length
    ? { ok: true, domains }
    : { ok: false, reason: "No expected domain could be established." };
}

export type VerifyResult =
  | { ok: true; address: Address; chainId: number }
  | { ok: false; reason: string };

/**
 * Server-side EIP-4361 verification. Every check here is deliberate:
 *
 *  - domain binding      a signature farmed on another site cannot be replayed
 *  - nonce binding       must equal the single-use nonce this server issued
 *  - chain binding       must be Robinhood Chain
 *  - expiry / notBefore  enforced by siwe's own validation
 *  - signature           verified against the message, supporting EIP-1271
 *                        smart-contract wallets via viem's public client
 */
export async function verifySiwe({
  message,
  signature,
  expectedNonce,
  expectedDomains,
}: VerifyInput): Promise<VerifyResult> {
  let parsed: SiweMessage;
  try {
    parsed = new SiweMessage(message);
  } catch {
    return { ok: false, reason: "The login message was malformed." };
  }

  if (parsed.nonce !== expectedNonce) {
    return { ok: false, reason: "This login request has expired. Please try again." };
  }
  if (!expectedDomains.includes(parsed.domain)) {
    return { ok: false, reason: "The login message was issued for a different site." };
  }
  if (parsed.chainId !== APP_CHAIN_ID) {
    return { ok: false, reason: "Switch your wallet to Robinhood Chain to sign in." };
  }
  if (parsed.expirationTime && new Date(parsed.expirationTime).getTime() < Date.now()) {
    return { ok: false, reason: "This login request has expired. Please try again." };
  }
  if (parsed.notBefore && new Date(parsed.notBefore).getTime() > Date.now()) {
    return { ok: false, reason: "This login request is not valid yet." };
  }

  try {
    const client = createPublicClient({ chain: appChain, transport: http() });
    const valid = await client.verifyMessage({
      address: parsed.address as Address,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) return { ok: false, reason: "That signature could not be verified." };
  } catch {
    return { ok: false, reason: "We couldn't verify your signature right now. Please try again." };
  }

  return { ok: true, address: parsed.address as Address, chainId: parsed.chainId };
}

/** The exact statement users are asked to sign. Never mentions secrets. */
export { SIWE_STATEMENT } from "./siwe.shared";

export function buildSiweMessage(params: {
  domain: string;
  address: Address;
  uri: string;
  nonce: string;
}): string {
  const now = new Date();
  return new SiweMessage({
    domain: params.domain,
    address: params.address,
    statement: SIWE_STATEMENT,
    uri: params.uri,
    version: "1",
    chainId: APP_CHAIN_ID,
    nonce: params.nonce,
    issuedAt: now.toISOString(),
    expirationTime: new Date(now.getTime() + 5 * 60_000).toISOString(),
  }).prepareMessage();
}
