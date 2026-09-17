/**
 * Single-flight, TTL'd memoisation.
 *
 * Caching the resolved *value* is not enough: N concurrent cold callers all
 * miss the cache and all hit the network. During a static build that means nine
 * page workers firing the same RPC calls at once and tripping the rate limiter.
 * Caching the in-flight *promise* collapses them into one request.
 *
 * A rejected promise is evicted immediately so a transient failure is not
 * cached as if it were an answer.
 */
type Entry<T> = { at: number; promise: Promise<T> };

export function singleFlight<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  ttlMs: number,
  keyOf: (...args: Args) => string = (...a) => JSON.stringify(a),
) {
  const entries = new Map<string, Entry<T>>();

  return (...args: Args): Promise<T> => {
    const key = keyOf(...args);
    const hit = entries.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.promise;

    const promise = fn(...args);
    entries.set(key, { at: Date.now(), promise });
    promise.catch(() => {
      // Never serve a cached rejection.
      if (entries.get(key)?.promise === promise) entries.delete(key);
    });
    return promise;
  };
}
