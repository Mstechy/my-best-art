import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, ArrowLeft, User, Search, Loader2 } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import ProductRefCard, { extractProductRef } from "@/components/ProductRefCard";
import NegotiationBar from "@/components/NegotiationBar";
import { Link, useSearchParams } from "react-router-dom";
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

export default function BuyerChat() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [selectedPartnerName, setSelectedPartnerName] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [pinnedProduct, setPinnedProduct] = useState<PinnedProduct | null>(null);
  const [convoSearch, setConvoSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filteredConvos = conversations.filter(c =>
    !convoSearch ||
    c.partnerName.toLowerCase().includes(convoSearch.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(convoSearch.toLowerCase())
  );

  // Auto-open seller from query param
  useEffect(() => {
    const sellerId = searchParams.get("seller");
    const productId = searchParams.get("product");
    if (sellerId && user) {
      (async () => {
        const { data: profile } = await supabase.from("profiles").select("user_id, full_name").eq("user_id", sellerId).maybeSingle();
        const partnerName = profile?.full_name || "Seller";
        openConversation(sellerId, partnerName);
        if (productId) {
          const { data: prod } = await supabase.from("products").select("id, title, price").eq("id", productId).maybeSingle();
          if (prod) {
            setPinnedProduct({ id: (prod as any).id, title: (prod as any).title, price: Number((prod as any).price) });
            setNewMessage(`Hi! I'm interested in "${(prod as any).title}". Is the price negotiable?`);
          }
        }
        setSearchParams({}, { replace: true });
      })();
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (!user) return;
    fetchConversations();
    const channel = supabase.channel("buyer-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === user.id || msg.receiver_id === user.id) {
          if (selectedPartner && (msg.sender_id === selectedPartner || msg.receiver_id === selectedPartner)) {
            setMessages(prev => [...prev, msg]);
          }
          fetchConversations();
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedPartner]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchConversations = async () => {
    if (!user) return;
    const { data: msgs } = await supabase.from("messages").select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (!msgs || msgs.length === 0) { setLoading(false); return; }

    const partnerMap = new Map<string, { messages: Message[] }>();
    msgs.forEach(m => {
      const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!partnerMap.has(partnerId)) partnerMap.set(partnerId, { messages: [] });
      partnerMap.get(partnerId)!.messages.push(m as Message);
    });

    const partnerIds = [...partnerMap.keys()];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", partnerIds);
    const nameMap: Record<string, string> = {};
    profiles?.forEach(p => { nameMap[p.user_id] = p.full_name || "User"; });

    const convos: Conversation[] = partnerIds.map(pid => {
      const pmsgs = partnerMap.get(pid)!.messages;
      return { partnerId: pid, partnerName: nameMap[pid] || "User", lastMessage: pmsgs[0].content, lastAt: pmsgs[0].created_at, unread: pmsgs.filter(m => m.receiver_id === user.id && !m.is_read).length };
    });
    setConversations(convos);
    setLoading(false);
  };

  const openConversation = async (partnerId: string, partnerName: string) => {
    setSelectedPartner(partnerId);
    setSelectedPartnerName(partnerName);
    if (!user) return;
    const { data } = await supabase.from("messages").select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);
    await supabase.from("messages").update({ is_read: true }).eq("sender_id", partnerId).eq("receiver_id", user.id).eq("is_read", false);
  };

  const sendMessage = async () => {
    if (!user || !selectedPartner || !newMessage.trim()) return;
    const marker = pinnedProduct ? ` [product:${pinnedProduct.id}]` : "";
    const content = `${newMessage.trim()}${marker}`.slice(0, 2000);
    await supabase.from("messages").insert({ sender_id: user.id, receiver_id: selectedPartner, content });
    setNewMessage("");
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  return (
    <div className="space-y-4 max-w-[1280px]">
      {/* Header */}
      <AnimatedSection variant="fade-up">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">Messages</h1>
          <p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0]">Chat with sellers about their products</p>
        </div>
      </AnimatedSection>

      {selectedPartner ? (
        /* ── Conversation view ── */
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] flex flex-col h-[calc(100vh-220px)]">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F2F3F5] dark:border-[#222222]">
            <button onClick={() => { setSelectedPartner(null); setPinnedProduct(null); }}
              className="flex items-center justify-center h-7 w-7 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#111111] text-[#888880] dark:text-[#A0A0A0] transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111111] dark:bg-[#FAF5F2]">
              <span className="text-[11px] font-bold text-white dark:text-[#111111]">{getInitial(selectedPartnerName)}</span>
            </div>
            <span className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">{selectedPartnerName}</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {user && selectedPartner && <NegotiationBar currentUserId={user.id} partnerId={selectedPartner} role="buyer" />}
            {pinnedProduct && (
              <div className="sticky top-0 z-10">
                <ProductRefCard productId={pinnedProduct.id} />
              </div>
            )}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <MessageSquare className="h-8 w-8 text-[#E8E8E8] dark:text-[#2A2A2A]" />
                <p className="text-xs text-[#888880] dark:text-[#A0A0A0]">No messages yet. Start the conversation!</p>
              </div>
            )}
            {messages.map(msg => {
              const { productId, orderId, offerPrice, attachmentUrl, clean } = extractProductRef(msg.content);
              const mine = msg.sender_id === user?.id;
              const hasRef = productId || orderId || attachmentUrl;
              return (
                <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    mine
                      ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111]"
                      : "bg-[#F2F3F5] dark:bg-[#111111] text-[#111111] dark:text-[#FAF5F2]"
                  }`}>
                    {hasRef && <ProductRefCard productId={productId} orderId={orderId} offerPrice={offerPrice} attachmentUrl={attachmentUrl} />}
                    {clean && <p className="whitespace-pre-wrap text-[13px]">{clean}</p>}
                    <p className={`text-[9px] mt-1.5 ${mine ? "text-white/50 dark:text-[#111111]/50" : "text-[#888880] dark:text-[#A0A0A0]"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Pinned product chip */}
          {pinnedProduct && (
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-[#F2F3F5] dark:border-[#222222] bg-[#FAFAFA] dark:bg-[#111111]">
              <span className="text-[10px] text-[#888880] dark:text-[#A0A0A0]">Negotiating:</span>
              <span className="text-[10px] font-semibold text-[#111111] dark:text-[#FAF5F2] truncate flex-1">{pinnedProduct.title}</span>
              <span className="text-[10px] font-bold text-[#F6C75D]">${pinnedProduct.price.toFixed(2)}</span>
              <button onClick={() => setPinnedProduct(null)} className="text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors text-sm leading-none">×</button>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 px-4 py-3.5 border-t border-[#F2F3F5] dark:border-[#222222]">
            <input
              value={newMessage} onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 h-10 px-4 rounded-full border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-[#111111] dark:text-[#FAF5F2] text-sm placeholder-[#C0C0B8] dark:placeholder-[#555555] outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors"
            />
            <button onClick={sendMessage} disabled={!newMessage.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        /* ── Conversation list ── */
        <AnimatedSection variant="fade-up" delay={50}>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#888880]" /></div>
          ) : conversations.length === 0 ? (
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] py-16">
              <div className="flex flex-col items-center justify-center text-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-[#F2F3F5] dark:bg-[#111111] flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-[#888880] dark:text-[#A0A0A0]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">No conversations yet</p>
                  <p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0] max-w-xs">Browse the marketplace and message sellers to ask about their products.</p>
                </div>
                <Link to="/marketplace">
                  <button className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] transition-colors">
                    Browse Marketplace
                  </button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222]">
              {/* Search */}
              <div className="p-4 border-b border-[#F2F3F5] dark:border-[#222222]">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#888880]" />
                  <input value={convoSearch} onChange={e => setConvoSearch(e.target.value)} placeholder="Search conversations..."
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-sm text-[#111111] dark:text-[#FAF5F2] placeholder-[#C0C0B8] dark:placeholder-[#555555] outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors" />
                </div>
              </div>
              {/* Conversations */}
              <div className="divide-y divide-[#F2F3F5] dark:divide-[#1A1A1A]">
                {filteredConvos.map(convo => (
                  <button key={convo.partnerId} onClick={() => openConversation(convo.partnerId, convo.partnerName)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#FAFAFA] dark:hover:bg-[#111111] transition-colors">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111111] dark:bg-[#FAF5F2] shrink-0">
                      <span className="text-[11px] font-bold text-white dark:text-[#111111]">{getInitial(convo.partnerName)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">{convo.partnerName}</span>
                        <span className="text-[9px] text-[#888880] dark:text-[#A0A0A0] shrink-0">{new Date(convo.lastAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0] truncate mt-0.5">{convo.lastMessage}</p>
                    </div>
                    {convo.unread > 0 && (
                      <span className="flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shrink-0">
                        {convo.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </AnimatedSection>
      )}
    </div>
  );
}
