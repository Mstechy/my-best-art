import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * React Query key factory for Supabase resources.
 * Provides consistent, structured cache keys for invalidation.
 */
export const supabaseKeys = {
  all: ["supabase"] as const,
  tables: () => [...supabaseKeys.all, "tables"] as const,
  table: (table: string) => [...supabaseKeys.tables(), table] as const,
  row: (table: string, id: string) => [...supabaseKeys.table(table), id] as const,
  rpc: (name: string) => [...supabaseKeys.all, "rpc", name] as const,
  rpcWithArgs: (name: string, args: Record<string, unknown>) =>
    [...supabaseKeys.rpc(name), ...Object.values(args).filter(Boolean).map(String)] as const,
};

/**
 * useSupabaseQuery – generic cached query for any supabase fetch (select or rpc).
 *
 * Pass a function that performs the supabase call and returns the data.
 * React Query handles caching, staleness, background refetch, and error management.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useSupabaseQuery(
 *   supabaseKeys.table("products"),
 *   () => supabase.from("products").select("*").then(r => { if (r.error) throw r.error; return r.data; })
 * );
 * ```
 */
export function useSupabaseQuery<TData = unknown>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, PostgrestError>, "queryKey" | "queryFn">,
) {
  return useQuery<TData, PostgrestError>({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000, // 5 min – avoids refetch on every mount
    gcTime: 10 * 60 * 1000,   // 10 min – keep in memory cache
    refetchOnWindowFocus: false,
    retry: 2,
    ...options,
  });
}

/**
 * useSupabaseMutation – mutation with automatic cache invalidation.
 *
 * @example
 * ```tsx
 * const updateProduct = useSupabaseMutation(
 *   (data: { id: string; title: string }) =>
 *     supabase.from("products").update({ title: data.title }).eq("id", data.id),
 *   { invalidateTables: ["products"] }
 * );
 * ```
 */
export function useSupabaseMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, PostgrestError, TVariables>, "mutationFn"> & {
    /** Table names to invalidate on success (triggers refetch of related queries) */
    invalidateTables?: string[];
  },
) {
  const queryClient = useQueryClient();
  const { invalidateTables, ...mutationOpts } = options ?? {};

  return useMutation<TData, PostgrestError, TVariables>({
    mutationFn,
    ...mutationOpts,
    onSuccess: async (data, variables, context) => {
      if (invalidateTables) {
        await Promise.all(
          invalidateTables.map(table =>
            queryClient.invalidateQueries({ queryKey: supabaseKeys.table(table) })
          ),
        );
      }
      await mutationOpts.onSuccess?.(data, variables, context);
    },
  });
}