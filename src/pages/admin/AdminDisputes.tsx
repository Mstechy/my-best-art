import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Search, Shield, Clock, Paperclip, Snowflake } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OrderContext {
  id: string;
  status: string;
  total_amount: number;
  tracking_number: string | null;
  carrier: string | null;
  created_at: string;
  buyer_name?: string;
  seller_name?: string;
  items?: { product_id: string; quantity: number; unit_price: number; product_title?: string }[];
}

interface Dispute {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  buyer_id: string;
  seller_id: string;
  order_id: string | null;
  proof_url: string | null;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  order?: OrderContext;
}

type Tab = "all" | "open" | "investigating" | "resolved" | "dismissed";

export default function AdminDisputes() {
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  const fetchDisputes = async () => {
    const { data } = await supabase.from("disputes").select("*").order("created_at", { ascending: false });
    if (!data) { setLoading(false); return; }
    const rows = data as Dispute[];
    const orderIds = [...new Set(rows.map(r => r.order_id).filter(Boolean) as string[])];
    const userIds = [...new Set(rows.flatMap(r => [r.buyer_id, r.seller_id]))];
    const [{ data: orders }, { data: items }, { data: profiles }] = await Promise.all([
      orderIds.length ? supabase.from("orders").select("id, status, total_amount, tracking_number, carrier, created_at, buyer_id, seller_id").in("id", orderIds) : Promise.resolve({ data: [] as any[] }),
      orderIds.length ? supabase.from("order_items").select("order_id, product_id, quantity, unit_price").in("order_id", orderIds) : Promise.resolve({ data: [] as any[] }),
      supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
    ]);
    const productIds = [...new Set((items as any[]).map(i => i.product_id).filter(Boolean))];
    const { data: products } = productIds.length ? await supabase.from("products").select("id, title").in("id", productIds) : { data: [] as any[] };
    const productMap = new Map((products as any[]).map(p => [p.id, p.title]));
    const profileMap = new Map((profiles as any[] || []).map(p => [p.user_id, p.full_name]));
    const itemsByOrder = new Map<string, any[]>();
    (items as any[]).forEach(i => {
      const arr = itemsByOrder.get(i.order_id) || [];
      arr.push({ ...i, product_title: productMap.get(i.product_id) || "Item" });
      itemsByOrder.set(i.order_id, arr);
    });
    const orderMap = new Map<string, OrderContext>();
    (orders as any[]).forEach(o => {
      orderMap.set(o.id, {
        id: o.id, status: o.status, total_amount: Number(o.total_amount),
        tracking_number: o.tracking_number, carrier: o.carrier, created_at: o.created_at,
        buyer_name: profileMap.get(o.buyer_id), seller_name: profileMap.get(o.seller_id),
        items: itemsByOrder.get(o.id) || [],
      });
    });
    setDisputes(rows.map(r => ({ ...r, order: r.order_id ? orderMap.get(r.order_id) : undefined })));
    setLoading(false);
  };

  useEffect(() => { fetchDisputes(); }, []);

  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const updateStatus = async (id: string, status: string, sellerId?: string) => {
    const update: any = { status };
    if (notesDraft[id] !== undefined) update.admin_notes = notesDraft[id];
    if (status === "resolved" || status === "dismissed") update.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("disputes").update(update).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    if (status === "resolved" && sellerId) {
      await supabase.rpc("admin_set_account_status", { _user_id: sellerId, _is_frozen: true });
    }
    toast({ title: `Dispute marked as ${status}` });
    fetchDisputes();
  };

  const freezeSeller = async (sellerId: string) => {
    await supabase.rpc("admin_set_account_status", { _user_id: sellerId, _is_frozen: true });
    toast({ title: "Seller account frozen" });
  };

  const filtered = disputes.filter(d => {
    const matchesSearch = !search || d.id.includes(search) || d.reason.toLowerCase().includes(search.toLowerCase());
    const matchesTab = tab === "all" || d.status === tab;
    return matchesSearch && matchesTab;
  });

  const tabs: Tab[] = ["all", "open", "investigating", "resolved", "dismissed"];
  const statusColors: Record<string, string> = {
    open: "bg-destructive/10 text-destructive",
    investigating: "bg-yellow-500/10 text-yellow-600",
    resolved: "bg-accent/10 text-accent",
    dismissed: "bg-muted text-muted-foreground",
  };

  const disputeStats = [
    { label: "Open", value: disputes.filter(d => d.status === "open").length, gradient: "gradient-primary" },
    { label: "Investigating", value: disputes.filter(d => d.status === "investigating").length, gradient: "gradient-seller" },
    { label: "Resolved", value: disputes.filter(d => d.status === "resolved").length, gradient: "gradient-buyer" },
    { label: "Total", value: disputes.length, gradient: "gradient-admin" },
  ];

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Disputes</h1>
          <p className="mt-1 text-muted-foreground">Manage buyer complaints and fraud reports</p>
        </div>
      </AnimatedSection>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {disputeStats.map((stat, i) => (
          <AnimatedSection key={stat.label} variant="fade-up" delay={i * 60}>
            <div className="stat-card">
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              <p className="font-display text-2xl font-bold text-foreground mt-2">{stat.value}</p>
            </div>
          </AnimatedSection>
        ))}
      </div>

      <AnimatedSection variant="fade-up" delay={100}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search disputes..." className="pl-10 h-11" />
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={120}>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all capitalize ${tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >{t === "all" ? "All" : t}</button>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={150}>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                  <Shield className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-display font-semibold text-foreground">No disputes found</p>
                <p className="mt-1 text-sm text-muted-foreground">When buyers report issues, disputes will appear here.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(dispute => (
              <Card key={dispute.id} className="border-border/60">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-semibold text-foreground text-sm">{dispute.reason}</p>
                      {dispute.description && <p className="text-xs text-muted-foreground mt-1 max-w-md">{dispute.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">{new Date(dispute.created_at).toLocaleDateString()}</p>
                      {dispute.proof_url && (
                        /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(dispute.proof_url) ? (
                          <a href={dispute.proof_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
                            <img src={dispute.proof_url} alt="Proof" className="h-20 w-20 rounded-md object-cover border border-border" />
                          </a>
                        ) : (
                          <a href={dispute.proof_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                            <Paperclip className="h-3.5 w-3.5" /> View proof (PDF)
                          </a>
                        )
                      )}
                    </div>
                    <Badge className={statusColors[dispute.status] || ""}>{dispute.status}</Badge>
                  </div>

                  {dispute.order ? (
                    <div className="rounded-lg border border-border/40 bg-muted/30 p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Order #{dispute.order.id.slice(0, 8)}</span>
                        <Badge variant="outline" className="text-[10px]">{dispute.order.status}</Badge>
                      </div>
                      <p className="text-muted-foreground">
                        Buyer: <span className="text-foreground">{dispute.order.buyer_name || dispute.buyer_id.slice(0, 8)}</span> ·
                        Seller: <span className="text-foreground">{dispute.order.seller_name || dispute.seller_id.slice(0, 8)}</span>
                      </p>
                      <p className="text-muted-foreground">Total: <span className="text-foreground font-medium">${dispute.order.total_amount.toFixed(2)}</span></p>
                      {dispute.order.tracking_number && (
                        <p className="text-muted-foreground">Tracking: <span className="font-mono text-foreground">{dispute.order.carrier} {dispute.order.tracking_number}</span></p>
                      )}
                      {dispute.order.items && dispute.order.items.length > 0 && (
                        <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                          {dispute.order.items.map((it, idx) => (
                            <li key={idx}>{it.product_title} × {it.quantity} (${Number(it.unit_price).toFixed(2)})</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No linked order</p>
                  )}


                  <Textarea
                    value={notesDraft[dispute.id] ?? dispute.admin_notes ?? ""}
                    onChange={e => setNotesDraft(prev => ({ ...prev, [dispute.id]: e.target.value }))}
                    placeholder="Admin notes (visible only to admins)…"
                    rows={2}
                    className="text-xs"
                  />

                  {(dispute.status === "open" || dispute.status === "investigating") && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Select onValueChange={(val) => updateStatus(dispute.id, val, dispute.seller_id)}>
                        <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Update status" /></SelectTrigger>
                        <SelectContent>
                          {dispute.status === "open" && <SelectItem value="investigating">Investigate</SelectItem>}
                          <SelectItem value="resolved">Resolve & freeze seller</SelectItem>
                          <SelectItem value="dismissed">Dismiss</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => freezeSeller(dispute.seller_id)}>
                        <Snowflake className="h-3.5 w-3.5" /> Freeze seller
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={200}>
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-seller mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Dispute Resolution Policy</p>
            <p className="text-xs text-muted-foreground mt-1">Seller accounts are automatically frozen when a buyer submits verified payment proof.</p>
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
