import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useUnreadMessages() {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setTotal(0);
      return;
    }

    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("is_read", false);

    if (error) return;
    setTotal(count ?? 0);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
    if (!user?.id) return;

    const ch = supabase.channel(`unread-msgs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload: any) => {
        const row = payload.new ?? payload.old;
        if (row?.receiver_id === user.id || row?.sender_id === user.id) void refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh, user?.id]);

  return total;
}
