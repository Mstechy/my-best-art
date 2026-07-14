import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, MessageSquare, Search, Send } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import AnimatedSection from "@/components/AnimatedSection";
import NegotiationBar from "@/components/NegotiationBar";
import ProductRefCard, { extractProductRef } from "@/components/ProductRefCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  partnerId: string;
  partnerName: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
}

interface PinnedProduct { id: string; title: string; price: number; }

export default function ChatInterface({ role }: { role: "buyer" | "seller" }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [selectedPartnerName, setSelectedPartnerName] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [convoSearch, setConvoSearch] = useState("");
  const [pinnedProduct, setPinnedProduct] = useState<PinnedProduct | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const filteredConversations = useMemo(() => conversations.filter((conversation) => {
    const term = convoSearch.trim().toLowerCase();
    return !term || conversation.partnerName.toLowerCase().includes(term) || conversation.lastMessage.toLowerCase().includes(term);
  }), [conversations, convoSearch]);

  const fetchConversations = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error: loadError } = await supabase.from("messages").select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order("created_at", { ascending: false });
    if (loadError) setError("Could not load your messages. Please refresh and try again.");
    if (!data?.length) { setConversations([]); setLoading(false); return; }

    const grouped = new Map<string, Message[]>();
    data.forEach((row) => {
      const message = row as Message;
      const partnerId = message.sender_id === user.id ? message.receiver_id : message.sender_id;
      grouped.set(partnerId, [...(grouped.get(partnerId) || []), message]);
    });
    const partnerIds = [...grouped.keys()];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", partnerIds);
    const names = Object.fromEntries((profiles || []).map((profile) => [profile.user_id, profile.full_name || "User"]));
    setConversations(partnerIds.map((partnerId) => {
      const thread = grouped.get(partnerId)!;
      return { partnerId, partnerName: names[partnerId] || "User", lastMessage: thread[0].content, lastAt: thread[0].created_at, unread: thread.filter((message) => message.receiver_id === user.id && !message.is_read).length };
    }));
    setLoading(false);
  };

  const openConversation = async (partnerId: string, partnerName: string) => {
    if (!user) return;
    setError(""); setSelectedPartner(partnerId); setSelectedPartnerName(partnerName); setMessages([]);
    const { data, error: loadError } = await supabase.from("messages").select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    if (loadError) setError("Could not open this conversation.");
    if (data) setMessages(data as Message[]);
    await supabase.from("messages").update({ is_read: true }).eq("sender_id", partnerId).eq("receiver_id", user.id).eq("is_read", false);
    fetchConversations();
  };

  useEffect(() => {
    if (!user) return;
    fetchConversations();
    const channel = supabase.channel(`messages-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, ({ new: row }) => {
        const message = row as Message;
        if (message.sender_id !== user.id && message.receiver_id !== user.id) return;
        if (selectedPartner && (message.sender_id === selectedPartner || message.receiver_id === selectedPartner)) {
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
        }
        fetchConversations();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, selectedPartner]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const partnerId = searchParams.get("seller") || searchParams.get("partner");
    const productId = searchParams.get("product");
    if (!partnerId || !user) return;
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("user_id, full_name").eq("user_id", partnerId).maybeSingle();
      await openConversation(partnerId, profile?.full_name || (role === "buyer" ? "Seller" : "Buyer"));
      if (productId) {
        const { data: product } = await supabase.from("products").select("id, title, price").eq("id", productId).maybeSingle();
        if (product) {
          setPinnedProduct({ id: product.id, title: product.title, price: Number(product.price) });
          if (role === "buyer") setDraft(`Hi! I'm interested in \"${product.title}\". Is the price negotiable?`);
        }
      }
      setSearchParams({}, { replace: true });
    })();
  }, [searchParams, user?.id, role, setSearchParams]);

  const sendMessage = async () => {
    if (!user || !selectedPartner || !draft.trim() || sending) return;
    setSending(true); setError("");
    const marker = pinnedProduct ? ` [product:${pinnedProduct.id}]` : "";
    const { data, error: sendError } = await supabase.from("messages")
      .insert({ sender_id: user.id, receiver_id: selectedPartner, content: `${draft.trim()}${marker}`.slice(0, 2000) })
      .select().single();
    if (sendError) {
      setError("Message was not sent. Please try again.");
    } else {
      if (data) setMessages((current) => current.some((message) => message.id === data.id) ? current : [...current, data as Message]);
      setDraft("");
      fetchConversations();
    }
    setSending(false);
  };

  const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "U";
  const audience = role === "buyer" ? "sellers" : "buyers";

  return <div className="max-w-[1280px] space-y-4">
    <AnimatedSection variant="fade-up"><div><h1 className="text-2xl font-bold tracking-tight text-[#111111] dark:text-[#FAF5F2]">Messages</h1><p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0]">Chat with {audience} about products and orders</p></div></AnimatedSection>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
    {selectedPartner ? <section className="flex h-[calc(100vh-220px)] min-h-[460px] flex-col overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white dark:border-[#222222] dark:bg-[#1A1A1A]">
      <header className="flex items-center gap-3 border-b border-[#F2F3F5] px-4 py-3.5 dark:border-[#222222]"><button onClick={() => { setSelectedPartner(null); setPinnedProduct(null); }} aria-label="Back to conversations" className="grid h-7 w-7 place-items-center rounded-full text-[#888880] transition-colors hover:bg-[#F2F3F5] hover:text-[#111111] dark:hover:bg-[#111111] dark:hover:text-[#FAF5F2]"><ArrowLeft className="h-3.5 w-3.5" /></button><span className="grid h-8 w-8 place-items-center rounded-full bg-[#111111] text-[11px] font-bold text-white dark:bg-[#FAF5F2] dark:text-[#111111]">{initial(selectedPartnerName)}</span><span className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">{selectedPartnerName}</span></header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">{user && <NegotiationBar currentUserId={user.id} partnerId={selectedPartner} role={role} />}{pinnedProduct && <div className="sticky top-0 z-10"><ProductRefCard productId={pinnedProduct.id} /></div>}{messages.length === 0 && <div className="flex flex-col items-center justify-center gap-2 py-12 text-center"><MessageSquare className="h-8 w-8 text-[#E8E8E8] dark:text-[#2A2A2A]" /><p className="text-xs text-[#888880] dark:text-[#A0A0A0]">No messages yet. Start the conversation.</p></div>}{messages.map((message) => { const { productId, orderId, offerPrice, attachmentUrl, clean } = extractProductRef(message.content); const mine = message.sender_id === user?.id; return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-[#111111] text-white dark:bg-[#FAF5F2] dark:text-[#111111]" : "bg-[#F2F3F5] text-[#111111] dark:bg-[#111111] dark:text-[#FAF5F2]"}`}>{(productId || orderId || attachmentUrl) && <ProductRefCard productId={productId} orderId={orderId} offerPrice={offerPrice} attachmentUrl={attachmentUrl} />}{clean && <p className="whitespace-pre-wrap text-[13px]">{clean}</p>}<p className={`mt-1.5 text-[9px] ${mine ? "text-white/50 dark:text-[#111111]/50" : "text-[#888880] dark:text-[#A0A0A0]"}`}>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div></div>; })}<div ref={endRef} /></div>
      {pinnedProduct && <div className="flex items-center gap-2 border-t border-[#F2F3F5] bg-[#FAFAFA] px-4 py-2.5 dark:border-[#222222] dark:bg-[#111111]"><span className="text-[10px] text-[#888880]">Product:</span><span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[#111111] dark:text-[#FAF5F2]">{pinnedProduct.title}</span><span className="text-[10px] font-bold text-[#F6C75D]">${pinnedProduct.price.toFixed(2)}</span><button onClick={() => setPinnedProduct(null)} aria-label="Remove product reference" className="text-sm leading-none text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2]">×</button></div>}
      <div className="flex gap-2 border-t border-[#F2F3F5] px-4 py-3.5 dark:border-[#222222]"><input value={draft} maxLength={2000} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Type a message..." className="h-10 flex-1 rounded-full border border-[#E8E8E8] bg-[#FAFAFA] px-4 text-sm text-[#111111] outline-none transition-colors placeholder:text-[#C0C0B8] focus:border-[#111111] dark:border-[#2A2A2A] dark:bg-[#111111] dark:text-[#FAF5F2] dark:placeholder:text-[#555555] dark:focus:border-[#555555]" /><button onClick={sendMessage} disabled={!draft.trim() || sending} aria-label="Send message" className="grid h-10 w-10 place-items-center rounded-full bg-[#111111] text-white transition-colors hover:bg-[#2A2A2A] disabled:opacity-40 dark:bg-[#FAF5F2] dark:text-[#111111]"><Send className="h-4 w-4" /></button></div>
    </section> : <AnimatedSection variant="fade-up" delay={50}><section className="overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white dark:border-[#222222] dark:bg-[#1A1A1A]">{loading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#888880]" /></div> : conversations.length === 0 ? <div className="flex flex-col items-center justify-center gap-3 py-16 text-center"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#F2F3F5] dark:bg-[#111111]"><MessageSquare className="h-6 w-6 text-[#888880]" /></div><div><p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">No conversations yet</p><p className="mt-1 max-w-xs text-xs text-[#888880] dark:text-[#A0A0A0]">{role === "buyer" ? "Browse the marketplace and message sellers about their products." : "Messages from buyers will appear here."}</p></div>{role === "buyer" && <Link to="/marketplace" className="rounded-full border border-[#E8E8E8] px-5 py-2.5 text-xs font-semibold text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:border-[#222222] dark:text-[#FAF5F2] dark:hover:bg-[#111111]">Browse Marketplace</Link>}</div> : <><div className="border-b border-[#F2F3F5] p-4 dark:border-[#222222]"><label className="relative block"><Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#888880]" /><input value={convoSearch} onChange={(event) => setConvoSearch(event.target.value)} placeholder="Search conversations..." className="h-10 w-full rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] pl-10 pr-4 text-sm text-[#111111] outline-none focus:border-[#111111] dark:border-[#2A2A2A] dark:bg-[#111111] dark:text-[#FAF5F2]" /></label></div><div className="divide-y divide-[#F2F3F5] dark:divide-[#222222]">{filteredConversations.map((conversation) => <button key={conversation.partnerId} onClick={() => openConversation(conversation.partnerId, conversation.partnerName)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#FAFAFA] dark:hover:bg-[#111111]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#111111] text-[11px] font-bold text-white dark:bg-[#FAF5F2] dark:text-[#111111]">{initial(conversation.partnerName)}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">{conversation.partnerName}</span><span className="shrink-0 text-[9px] text-[#888880]">{new Date(conversation.lastAt).toLocaleDateString()}</span></span><span className="mt-0.5 block truncate text-[10px] text-[#888880] dark:text-[#A0A0A0]">{extractProductRef(conversation.lastMessage).clean || "Product shared"}</span></span>{conversation.unread > 0 && <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-[#F6C75D] px-1 text-[9px] font-bold text-[#5C3A00]">{conversation.unread > 99 ? "99+" : conversation.unread}</span>}</button>)}{filteredConversations.length === 0 && <p className="py-10 text-center text-xs text-[#888880]">No conversations match your search.</p>}</div></>}</section></AnimatedSection>}
  </div>;
}
