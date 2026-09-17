import { NextResponse } from "next/server";
import { ACTIVE_DEPLOYMENT, APP_CHAIN_ID } from "@/lib/pons/deployment";
import { rpc } from "@/lib/pons/client";

export const dynamic = "force-dynamic";

/**
 * Operational health for the two upstreams this product cannot work without:
 * the Robinhood asset registry and the chain RPC.
 *
 * Every field here is already public — the factory address ships in the client
 * bundle as a NEXT_PUBLIC_ var, and the asset API is unauthenticated. Only the
 * *host* of each endpoint is reported, never the full URL, because an RPC_URL
 * may legitimately carry an API key in its path.
 */

function hostOf(url: string | undefined, fallback: string): string {
  try {
    return new URL(url ?? fallback).host;
  } catch {
    return "invalid-url";
  }
}

export async function GET() {
  const assetBase = process.env.ASSET_API_BASE ?? "https://api.robinhood.com/rhj";

  const registry = await (async () => {
    const started = Date.now();
    try {
      const res = await fetch(`${assetBase}/assets`, {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      const ms = Date.now() - started;
      if (!res.ok) {
        return { host: hostOf(assetBase, assetBase), ok: false, status: res.status, ms };
      }
      const body = (await res.json()) as { assets?: unknown[] };
      return {
        host: hostOf(assetBase, assetBase),
        ok: true,
        status: res.status,
        ms,
        assetCount: Array.isArray(body.assets) ? body.assets.length : 0,
      };
    } catch (e) {
      return {
        host: hostOf(assetBase, assetBase),
        ok: false,
        ms: Date.now() - started,
        error: e instanceof Error ? e.name : "unknown",
      };
    }
  })();

  const chain = await (async () => {
    const started = Date.now();
    try {
      const block = await rpc().getBlockNumber();
      return {
        host: hostOf(process.env.RPC_URL, "https://rpc.mainnet.chain.robinhood.com"),
        ok: true,
        blockNumber: block.toString(),
        ms: Date.now() - started,
      };
    } catch (e) {
      return {
        host: hostOf(process.env.RPC_URL, "https://rpc.mainnet.chain.robinhood.com"),
        ok: false,
        ms: Date.now() - started,
        error: e instanceof Error ? e.name : "unknown",
      };
    }
  })();

  return NextResponse.json({
    chainId: APP_CHAIN_ID,
    deployment: ACTIVE_DEPLOYMENT
      ? { factory: ACTIVE_DEPLOYMENT.launchFactory, provenance: ACTIVE_DEPLOYMENT.provenance }
      : null,
    sessionSecretConfigured: (process.env.SESSION_SECRET?.length ?? 0) >= 32,
    appUrlConfigured: Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim()),
    registry,
    chain,
  });
}
