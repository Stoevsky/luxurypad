"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAccount,
  useConfig,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
  type Config,
} from "wagmi";
import { getConnection } from "wagmi/actions";
import { APP_CHAIN_ID } from "@/lib/pons/deployment";
import { SIWE_STATEMENT } from "@/lib/auth/siwe.shared";

export type SessionInfo = { address: `0x${string}`; chainId: number } | null;

export function useSession() {
  return useQuery<SessionInfo>({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!res.ok) return null;
      const json = (await res.json()) as { session: SessionInfo };
      return json.session;
    },
    staleTime: 30_000,
  });
}

/**
 * Moves the wallet onto the app's chain, and proves it landed there.
 *
 * The re-read after the switch is not belt-and-braces: some wallets resolve
 * `wallet_switchEthereumChain` without actually moving — they may not support
 * the chain at all, or may keep a session pinned elsewhere. Continuing on that
 * optimism produces a SIWE message whose `Chain ID` line the wallet then
 * refuses to render, surfacing as an unreadable viem error. Failing here
 * instead lets us say which network the wallet is actually on.
 */
async function ensureAppChain(
  config: Config,
  switchChainAsync: (args: { chainId: number }) => Promise<unknown>,
) {
  const current = () => getConnection(config).chainId;
  if (current() === APP_CHAIN_ID) return;

  try {
    await switchChainAsync({ chainId: APP_CHAIN_ID });
  } catch {
    throw new Error(
      `Your wallet could not switch to Robinhood Chain (${APP_CHAIN_ID}). Add the network in your wallet, then try again.`,
    );
  }

  const landed = current();
  if (landed !== APP_CHAIN_ID) {
    throw new Error(
      `Your wallet is still on network ${landed ?? "unknown"}. Switch it to Robinhood Chain (${APP_CHAIN_ID}) and try again.`,
    );
  }
}

/**
 * Connect → nonce → sign → verify. A connected wallet on its own is never
 * treated as a session; the server decides, and only after checking a
 * signature over a nonce it issued.
 */
export function useSignIn() {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!isConnected || !address) throw new Error("Connect a wallet first.");

      // Read the chain off the connection, not off `useChainId()`. wagmi types
      // that hook as `config['chains'][number]['id']` — with a single
      // configured chain it can only ever return APP_CHAIN_ID, so comparing it
      // against APP_CHAIN_ID is a tautology and the guard never fires. The
      // wallet would then be handed a message pinned to `Chain ID: 4663` while
      // sitting on some other network, and refuse to display it.
      await ensureAppChain(config, switchChainAsync);

      const nonceRes = await fetch("/api/auth/nonce", { cache: "no-store" });
      if (!nonceRes.ok) throw new Error("Could not start sign-in. Please try again.");
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const now = new Date();
      const message = [
        `${window.location.host} wants you to sign in with your Ethereum account:`,
        address,
        "",
        SIWE_STATEMENT,
        "",
        `URI: ${window.location.origin}`,
        "Version: 1",
        `Chain ID: ${APP_CHAIN_ID}`,
        `Nonce: ${nonce}`,
        `Issued At: ${now.toISOString()}`,
        `Expiration Time: ${new Date(now.getTime() + 5 * 60_000).toISOString()}`,
      ].join("\n");

      const signature = await signMessageAsync({ message });

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      if (!verifyRes.ok) {
        const { error } = (await verifyRes.json().catch(() => ({ error: null }))) as { error?: string };
        throw new Error(error ?? "We couldn't verify your signature.");
      }
      return (await verifyRes.json()) as { address: `0x${string}`; chainId: number };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  const { disconnect } = useDisconnect();
  return useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      disconnect();
      queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });
}

export function useWalletConnectors() {
  const { connectors, connectAsync, isPending, error } = useConnect();
  return { connectors, connectAsync, isPending, error };
}

export { APP_CHAIN_ID };
