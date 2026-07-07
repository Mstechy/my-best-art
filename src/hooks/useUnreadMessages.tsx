import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useUnreadMessages() {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);

  const refresh = async () => {
    if (!user) { setTotal(0); return; }
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("is_read", false);
    setTotal(count ?? 0);
  };

  useEffect(() => {
    refresh();
    if (!user) return;
    const ch = supabase.channel(`unread-msgs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload: any) => {
        const row = payload.new ?? payload.old;
        if (row?.receiver_id === user.id || row?.sender_id === user.id) refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  return total;
}
