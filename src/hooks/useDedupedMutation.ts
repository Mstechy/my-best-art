import { useCallback, useRef } from "react";

/**
 * A hook that prevents duplicate mutations from being executed concurrently.
 * 
 * At billion-user scale, network retries and double-clicks can cause the same
 * mutation to fire multiple times. This hook deduplicates by a key function,
 * ensuring only one in-flight request per key at a time.
 * 
 * Usage:
 * ```ts
 * const placeOrder = useDedupedMutation(
 *   async (orderId: string) => supabase.rpc("place_marketplace_order", ...),
 *   (orderId) => `place-order-${orderId}`
 * );
 * ```
 */
export function useDedupedMutation<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  getKey: (...args: TArgs) => string,
) {
  const inFlightRef = useRef<Map<string, Promise<TReturn>>>(new Map());

  return useCallback(
    async (...args: TArgs): Promise<TReturn> => {
      const key = getKey(...args);
      const inFlight = inFlightRef.current;

      // If a request with this key is already in flight, return the existing promise
      const existing = inFlight.get(key);
      if (existing) {
        return existing;
      }

      // Start the request and store the promise
      const promise = fn(...args).finally(() => {
        // Clean up after completion
        inFlight.delete(key);
      });

      inFlight.set(key, promise);
      return promise;
    },
    [fn, getKey],
  );
}