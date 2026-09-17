"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useChainId, useConnect, useDisconnect, useSignMessage, useSwitchChain } from "wagmi";
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
 * Connect → nonce → sign → verify. A connected wallet on its own is never
 * treated as a session; the server decides, and only after checking a
 * signature over a nonce it issued.
 */
export function useSignIn() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!isConnected || !address) throw new Error("Connect a wallet first.");

      if (chainId !== APP_CHAIN_ID) {
        await switchChainAsync({ chainId: APP_CHAIN_ID });
      }

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
