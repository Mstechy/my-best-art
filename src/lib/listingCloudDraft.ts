import { supabase } from "@/integrations/supabase/client";
import type { ProductFormDraft } from "@/lib/sellerListing/listingForm";

interface CloudDraftRow {
  payload: ProductFormDraft;
  updated_at: string;
}

export async function saveListingCloudDraft(sellerId: string, payload: ProductFormDraft): Promise<void> {
  const { error } = await (supabase as any)
    .from("seller_listing_drafts")
    .upsert({ seller_id: sellerId, payload }, { onConflict: "seller_id" });
  if (error) throw error;
}

export async function loadListingCloudDraft(sellerId: string): Promise<CloudDraftRow | null> {
  const { data, error } = await (supabase as any)
    .from("seller_listing_drafts")
    .select("payload,updated_at")
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (error) throw error;
  return (data as CloudDraftRow | null) ?? null;
}

export async function clearListingCloudDraft(sellerId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("seller_listing_drafts")
    .delete()
    .eq("seller_id", sellerId);
  if (error) throw error;
}
