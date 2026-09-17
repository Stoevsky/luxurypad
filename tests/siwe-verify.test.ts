import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifySiwe } from "@/lib/auth/siwe";
import { SIWE_STATEMENT } from "@/lib/auth/siwe.shared";
import { APP_CHAIN_ID } from "@/lib/pons/deployment";

/**
 * These use a throwaway key generated in-memory per run. It is never a user
 * key, and nothing here talks to a wallet.
 *
 * The property under test is that an ordinary wallet can sign in while the
 * chain is unreachable. viem's `publicClient.verifyMessage` routes everything
 * through the ERC-6492 universal validator, which costs an `eth_call` — so
 * before the local-recovery fast path, a busy public RPC would reject a
 * perfectly valid signature. That failed intermittently and looked like a
 * signature problem, which is exactly the kind of bug worth pinning.
 */

const DOMAIN = "luxurypad.family";

type MessageArgs = {
  address: string;
  nonce: string;
  chainId?: number;
  domain?: string;
  issuedAt?: Date;
  expiresAt?: Date;
};

function message(args: MessageArgs) {
  const issued = args.issuedAt ?? new Date();
  const expires = args.expiresAt ?? new Date(issued.getTime() + 5 * 60_000);
  return [
    `${args.domain ?? DOMAIN} wants you to sign in with your Ethereum account:`,
    args.address,
    "",
    SIWE_STATEMENT,
    "",
    `URI: https://${args.domain ?? DOMAIN}`,
    "Version: 1",
    `Chain ID: ${args.chainId ?? APP_CHAIN_ID}`,
    `Nonce: ${args.nonce}`,
    `Issued At: ${issued.toISOString()}`,
    `Expiration Time: ${expires.toISOString()}`,
  ].join("\n");
}

async function signedBy(overrides: Partial<Omit<MessageArgs, "address">> = {}) {
  const account = privateKeyToAccount(generatePrivateKey());
  const msg = message({ address: account.address, nonce: "abc123nonce", ...overrides });
  return { account, message: msg, signature: await account.signMessage({ message: msg }) };
}

afterEach(() => vi.unstubAllGlobals());

describe("verifySiwe", () => {
  it("accepts a valid EOA signature without making a single network call", async () => {
    const { account, message: msg, signature } = await signedBy();

    // Any outbound request at all is a failure of the fast path.
    const fetchSpy = vi.fn(async () => {
      throw new Error("network call attempted");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await verifySiwe({
      message: msg,
      signature,
      expectedNonce: "abc123nonce",
      expectedDomains: [DOMAIN],
    });

    expect(result).toEqual({ ok: true, address: account.address, chainId: APP_CHAIN_ID });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a signature over a different message, offline", async () => {
    const { account, signature } = await signedBy();
    const tampered = message({ address: account.address, nonce: "abc123nonce" }).replace(
      SIWE_STATEMENT,
      "Sign in to SomewhereElse.",
    );

    // Recovery yields a different address, so this must not reach the chain
    // path and quietly pass.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network call attempted");
      }),
    );

    const result = await verifySiwe({
      message: tampered,
      signature,
      expectedNonce: "abc123nonce",
      expectedDomains: [DOMAIN],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a nonce this server did not issue", async () => {
    const { message: msg, signature } = await signedBy();
    const result = await verifySiwe({
      message: msg,
      signature,
      expectedNonce: "a-different-nonce",
      expectedDomains: [DOMAIN],
    });
    expect(result).toEqual({
      ok: false,
      reason: "This login request has expired. Please try again.",
    });
  });

  it("rejects a message issued for another site", async () => {
    const { message: msg, signature } = await signedBy({ domain: "evil.example" });
    const result = await verifySiwe({
      message: msg,
      signature,
      expectedNonce: "abc123nonce",
      expectedDomains: [DOMAIN],
    });
    expect(result).toEqual({
      ok: false,
      reason: "The login message was issued for a different site.",
    });
  });

  it("rejects a message pinned to another chain", async () => {
    const { message: msg, signature } = await signedBy({ chainId: 1 });
    const result = await verifySiwe({
      message: msg,
      signature,
      expectedNonce: "abc123nonce",
      expectedDomains: [DOMAIN],
    });
    expect(result).toEqual({
      ok: false,
      reason: "Switch your wallet to Robinhood Chain to sign in.",
    });
  });

  it("rejects an expired message", async () => {
    const past = new Date(Date.now() - 60 * 60_000);
    const { message: msg, signature } = await signedBy({
      issuedAt: past,
      expiresAt: new Date(past.getTime() + 5 * 60_000),
    });
    const result = await verifySiwe({
      message: msg,
      signature,
      expectedNonce: "abc123nonce",
      expectedDomains: [DOMAIN],
    });
    expect(result).toEqual({
      ok: false,
      reason: "This login request has expired. Please try again.",
    });
  });
});
