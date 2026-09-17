"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui";
import { APP_CHAIN_ID, useSession, useSignIn, useSignOut, useWalletConnectors } from "@/lib/auth/use-auth";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function ConnectWallet() {
  // `chainId` here is the connection's, not `useChainId()`'s. The latter is
  // typed to the configured chains, so with one chain configured it always
  // equals APP_CHAIN_ID and no network mismatch is ever detectable.
  const { address, isConnected, chainId } = useAccount();
  const { data: session, isLoading } = useSession();
  const signIn = useSignIn();
  const signOut = useSignOut();
  const { connectors, connectAsync, isPending } = useWalletConnectors();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authenticated: the server verified a signature, not just a connection.
  if (session) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={`/@${session.address}`}
          className="tabular hidden text-sm text-ink hover:text-gold sm:inline"
        >
          {short(session.address)}
        </a>
        <Button variant="secondary" onClick={() => signOut.mutate()}>
          Sign out
        </Button>
      </div>
    );
  }

  // Connected but not authenticated — the distinction users must see.
  if (isConnected && address) {
    const wrongNetwork = chainId !== APP_CHAIN_ID;
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          onClick={() => {
            setError(null);
            signIn.mutate(undefined, { onError: (e) => setError(e.message) });
          }}
          disabled={signIn.isPending || isLoading}
        >
          {signIn.isPending ? "Check your wallet…" : wrongNetwork ? "Switch network & sign in" : "Sign in"}
        </Button>
        {error ? <p className="max-w-[240px] text-right text-[11px] text-burgundy">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <Button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        Connect Wallet
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 border border-line bg-card p-1.5 shadow-[0_18px_40px_-24px_rgb(17,16,15,0.45)]"
        >
          <p className="eyebrow px-2.5 py-2">Choose a wallet</p>
          {connectors.map((c) => (
            <button
              key={c.uid}
              role="menuitem"
              disabled={isPending}
              onClick={async () => {
                setError(null);
                try {
                  await connectAsync({ connector: c });
                  setOpen(false);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not connect.");
                }
              }}
              className="flex w-full items-center justify-between px-2.5 py-2 text-left text-sm transition-colors hover:bg-ground disabled:opacity-50"
            >
              {c.name}
            </button>
          ))}
          <p className="px-2.5 pb-2 pt-1.5 text-[11px] leading-snug text-muted">
            LuxuryPad never asks for a seed phrase, recovery phrase or private key.
          </p>
          {error ? <p className="px-2.5 pb-2 text-[11px] text-burgundy">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Shown wherever a non-EVM or wrong-network wallet is connected. */
export function UnsupportedNetworkNotice() {
  const { isConnected, chainId } = useAccount();
  if (!isConnected || chainId === APP_CHAIN_ID) return null;
  return (
    <div className="border-b border-line bg-[#642b35]/5 px-5 py-2 text-center text-[13px] text-burgundy">
      Your wallet is on network {chainId ?? "unknown"}. Switch to Robinhood Chain (
      {APP_CHAIN_ID}) to continue.
    </div>
  );
}
