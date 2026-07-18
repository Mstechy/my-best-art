import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type MessageChange = Pick<Database["public"]["Tables"]["messages"]["Row"], "receiver_id" | "sender_id">;

export function useUnreadMessages() {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Debounced refresh to prevent excessive API calls
  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      void refresh();
    }, 300); // 300ms debounce
  }, [refresh]);

  useEffect(() => {
    void refresh();
    if (!user?.id) return;

    const ch = supabase.channel(`unread-msgs-${user.id}`)
      .on("postgres_changes", 
        { 
          event: "*", 
          schema: "public", 
          table: "messages",
          filter: `receiver_id=eq.${user.id}` // Only listen to messages for this user
        }, 
        (payload: RealtimePostgresChangesPayload<MessageChange>) => {
          // Only refresh if the message is unread and belongs to this user
          const row = payload.new as MessageChange | null;
          if (row?.receiver_id === user.id) {
            debouncedRefresh();
          }
        }
      )
      .subscribe();

    return () => { 
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      supabase.removeChannel(ch); 
    };
  }, [refresh, debouncedRefresh, user?.id]);

  return total;
}
