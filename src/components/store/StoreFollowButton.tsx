import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Heart, Check } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function StoreFollowButton({ sellerId, className }: { sellerId: string; className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [countResult, mineResult] = await Promise.all([
      supabase.from("store_follows").select("id", { count: "exact", head: true }).eq("seller_id", sellerId),
      user
        ? supabase.from("store_follows").select("id").eq("seller_id", sellerId).eq("follower_id", user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (countResult.error) {
      toast.error("Could not load follower count");
      return;
    }
    if (mineResult.error) {
      toast.error("Could not load follow status");
      return;
    }

    setCount(countResult.count || 0);
    setFollowing(!!mineResult.data);
  }, [sellerId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async () => {
    if (!user) {
      navigate(`/auth/login?redirect=${encodeURIComponent(`/seller/${sellerId}`)}`);
      return;
    }
    if (user.id === sellerId) {
      toast.error("You can't follow your own store");
      return;
    }

    try {
      setBusy(true);
      if (following) {
        const { error } = await supabase.from("store_follows").delete().eq("seller_id", sellerId).eq("follower_id", user.id);
        if (error) throw error;
        toast.success("Unfollowed store");
      } else {
        const { error } = await supabase.from("store_follows").insert({ seller_id: sellerId, follower_id: user.id });
        if (error) throw error;
        toast.success("Following - you'll be notified about new products");
      }
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update follow status";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      onClick={toggle}
      disabled={busy}
      variant="outline"
      className={`gap-2 ${following ? "border-accent text-accent hover:bg-accent/10" : "border-accent text-accent hover:bg-accent/10"} ${className || ""}`}
    >
      {following ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
      {following ? "Following" : "Follow"}
      <span className="text-xs text-muted-foreground">({count})</span>
    </Button>
  );
}
