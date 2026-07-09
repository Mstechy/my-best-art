import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";

interface Ad {
  id: string;
  title: string;
  image_url: string | null;
  target_url: string | null;
}

export default function PromoBanner() {
  const [ad, setAd] = useState<Ad | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (supabase as any)
      .from("ads_public")
      .select("id, title, image_url, target_url")
      .eq("placement", "banner")
      .limit(5)
      .then(({ data }: any) => {
        const list = (data ?? []) as Ad[];
        if (list.length > 0) setAd(list[0]);
      });
  }, []);


  // Track impression once per page load when ad becomes visible
  useEffect(() => {
    if (!ad) return;
    const key = `ad_imp_${ad.id}_${new Date().toISOString().slice(0,10)}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    (supabase as any).rpc("track_ad_impression", { _ad_id: ad.id });
  }, [ad]);

  const trackClick = () => {
    if (!ad) return;
    (supabase as any).rpc("track_ad_click", { _ad_id: ad.id });
  };

  if (!ad || dismissed) return null;

  const inner = (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
      {ad.image_url ? (
        <img src={ad.image_url} alt="" className="h-6 w-10 rounded object-cover shrink-0" />
      ) : (
        <Sparkles className="h-4 w-4 text-[#111111] dark:text-[#FAF5F2] shrink-0" />
      )}
      <span className="font-medium text-[#111111] dark:text-[#FAF5F2] truncate">{ad.title}</span>
    </div>
  );

  const safeTarget = ad.target_url && /^(https?:\/\/|\/)/i.test(ad.target_url) ? ad.target_url : null;

  return (
    <div className="relative bg-[#F8F3F0] dark:bg-[#1E1E1E] border-b border-[#E8E8E8] dark:border-[#222222] text-[#111111] dark:text-[#FAF5F2]">
      {safeTarget ? (
        safeTarget.startsWith("http") ? (
          <a href={safeTarget} target="_blank" rel="noopener noreferrer" className="block" onClick={trackClick}>{inner}</a>
        ) : (
          <Link to={safeTarget} className="block" onClick={trackClick}>{inner}</Link>
        )
      ) : inner}

      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#111111]/80 dark:text-[#FAF5F2]/80 hover:text-[#111111] dark:hover:text-[#FAF5F2]"
        aria-label="Dismiss promotion"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
