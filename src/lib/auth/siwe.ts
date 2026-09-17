import { SiweMessage, generateNonce } from "siwe";
import { createPublicClient, http, type Address } from "viem";
import { robinhoodChain, ROBINHOOD_CHAIN_ID } from "@/lib/chain/robinhood";
import { SIWE_STATEMENT } from "./siwe.shared";

export { generateNonce };

export type VerifyInput = {
  message: string;
  signature: string;
  expectedNonce: string;
  expectedDomain: string;
};

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
  expectedDomain,
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
  if (parsed.domain !== expectedDomain) {
    return { ok: false, reason: "The login message was issued for a different site." };
  }
  if (parsed.chainId !== ROBINHOOD_CHAIN_ID) {
    return { ok: false, reason: "Switch your wallet to Robinhood Chain to sign in." };
  }
  if (parsed.expirationTime && new Date(parsed.expirationTime).getTime() < Date.now()) {
    return { ok: false, reason: "This login request has expired. Please try again." };
  }
  if (parsed.notBefore && new Date(parsed.notBefore).getTime() > Date.now()) {
    return { ok: false, reason: "This login request is not valid yet." };
  }

  try {
    const client = createPublicClient({ chain: robinhoodChain, transport: http() });
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
    chainId: ROBINHOOD_CHAIN_ID,
    nonce: params.nonce,
    issuedAt: now.toISOString(),
    expirationTime: new Date(now.getTime() + 5 * 60_000).toISOString(),
  }).prepareMessage();
}
