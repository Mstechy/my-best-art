import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, ArrowLeft, User, Search } from "lucide-react";
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

  // Auto-open seller chat from query param, with optional product context for negotiation
  useEffect(() => {
    const sellerId = searchParams.get("seller");
    const productId = searchParams.get("product");
    if (sellerId && user) {
      (async () => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("user_id", sellerId)
          .maybeSingle();
        const partnerName = profile?.full_name || "Seller";
        openConversation(sellerId, partnerName);
        if (productId) {
          const { data: prod } = await supabase
            .from("products")
            .select("id, title, price")
            .eq("id", productId)
            .maybeSingle();
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
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, selectedPartner]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchConversations = async () => {
    if (!user) return;
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
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
      return {
        partnerId: pid,
        partnerName: nameMap[pid] || "User",
        lastMessage: pmsgs[0].content,
        lastAt: pmsgs[0].created_at,
        unread: pmsgs.filter(m => m.receiver_id === user.id && !m.is_read).length,
      };
    });
    setConversations(convos);
    setLoading(false);
  };

  const openConversation = async (partnerId: string, partnerName: string) => {
    setSelectedPartner(partnerId);
    setSelectedPartnerName(partnerName);
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
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

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Messages</h1>
          <p className="mt-1 text-muted-foreground">Chat with sellers about their products</p>
        </div>
      </AnimatedSection>

      {selectedPartner ? (
        <div className="flex flex-col h-[calc(100vh-220px)]">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedPartner(null); setPinnedProduct(null); }}><ArrowLeft className="h-4 w-4" /></Button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"><User className="h-4 w-4 text-muted-foreground" /></div>
            <span className="font-display font-semibold text-foreground">{selectedPartnerName}</span>
          </div>
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {user && selectedPartner && (
              <NegotiationBar currentUserId={user.id} partnerId={selectedPartner} role="buyer" />
            )}
            {pinnedProduct && (
              <div className="sticky top-0 z-10">
                <ProductRefCard productId={pinnedProduct.id} />
              </div>
            )}
            {messages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No messages yet. Start the conversation!
              </div>
            )}
            {messages.map(msg => {
              const { productId, orderId, offerPrice, attachmentUrl, clean } = extractProductRef(msg.content);
              const mine = msg.sender_id === user?.id;
              const hasRef = productId || orderId || attachmentUrl;
              return (
                <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    {hasRef && <ProductRefCard productId={productId} orderId={orderId} offerPrice={offerPrice} attachmentUrl={attachmentUrl} />}
                    {clean && <p className="whitespace-pre-wrap">{clean}</p>}
                    <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          {pinnedProduct && (
            <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg border border-primary/30 bg-primary/5 text-xs">
              <span className="text-muted-foreground">Negotiating:</span>
              <span className="font-medium text-foreground truncate flex-1">{pinnedProduct.title}</span>
              <span className="font-bold text-primary">${pinnedProduct.price.toFixed(2)}</span>
              <button onClick={() => setPinnedProduct(null)} className="text-muted-foreground hover:text-foreground">×</button>
            </div>
          )}
          <div className="flex gap-2 pt-4 border-t border-border">
            <Input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." className="h-11"
              onKeyDown={e => e.key === "Enter" && sendMessage()} />
            <Button onClick={sendMessage} className="gap-2 bg-primary text-primary-foreground h-11" disabled={!newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <>
          <AnimatedSection variant="fade-up" delay={50}>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : conversations.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="py-16">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted mb-5">
                      <MessageSquare className="h-9 w-9 text-muted-foreground" />
                    </div>
                    <h3 className="font-display text-xl font-semibold text-foreground">No conversations yet</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-sm">Browse the marketplace and message sellers to ask about their products.</p>
                    <Link to="/marketplace" className="mt-6"><Button variant="outline" className="gap-2">Browse Marketplace</Button></Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                <div className="relative mb-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={convoSearch} onChange={e => setConvoSearch(e.target.value)} placeholder="Search conversations..." className="pl-9 h-10" />
                </div>
                {filteredConvos.map(convo => (
                  <button key={convo.partnerId} onClick={() => openConversation(convo.partnerId, convo.partnerName)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 text-left hover:bg-muted/50 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground text-sm">{convo.partnerName}</span>
                        <span className="text-xs text-muted-foreground">{new Date(convo.lastAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{convo.lastMessage}</p>
                    </div>
                    {convo.unread > 0 && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{convo.unread}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </AnimatedSection>
        </>
      )}
    </div>
  );
}
