import { supabase } from "@/integrations/supabase/client";

const safeName = (name: string) => name.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "banner";

export async function uploadCollectionBanner(file: File, userId: string) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file for the banner.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Banner images must be 10 MB or smaller.");
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${Date.now()}-${safeName(file.name)}.${extension}`;
  const { error } = await supabase.storage.from("collection-banners").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from("collection-banners").getPublicUrl(path).data.publicUrl;
}
