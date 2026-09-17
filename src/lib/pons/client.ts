import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { appChain } from "@/lib/chain/robinhood";

let client: PublicClient | null = null;

/**
 * Server-side read client. Uses a fallback transport so a single RPC outage
 * degrades to the secondary endpoint instead of taking the product down.
 * Callers must still handle rejection — see `withRpc`.
 */
export function rpc(): PublicClient {
  if (client) return client;
  const primary = process.env.RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
  const secondary = process.env.RPC_FALLBACK_URL;
  // The public RPC rate-limits at 429. viem retries with exponential backoff
  // from `retryDelay`, which matters far more than raw timeout here.
  const transports = [http(primary, { timeout: 15_000, retryCount: 4, retryDelay: 250 })];
  if (secondary && secondary !== primary) {
    transports.push(http(secondary, { timeout: 15_000, retryCount: 2, retryDelay: 250 }));
  }
  client = createPublicClient({
    chain: appChain,
    transport: transports.length > 1 ? fallback(transports) : transports[0],
    batch: { multicall: { wait: 16 } },
  }) as PublicClient;
  return client;
}

export class RpcUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Chain data is temporarily unavailable.");
    this.name = "RpcUnavailableError";
    this.cause = cause;
  }
}

/** Wrap a chain read so callers get a typed outage instead of a raw viem error. */
export async function withRpc<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new RpcUnavailableError(error);
  }
}
