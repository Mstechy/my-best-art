import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Package, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatModerationAge } from "@/lib/moderationQueue";

type QueueKind = "product" | "seller" | "dispute";

interface QueueItem {
  id: string;
  kind: QueueKind;
  title: string;
  reason: string;
  createdAt: string;
  owner: string;
  nextAction: string;
  href: string;
}

const kindMeta: Record<QueueKind, { label: string; icon: typeof Package; className: string }> = {
  product: { label: "Product", icon: Package, className: "border-yellow-500/20 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300" },
  seller: { label: "Seller", icon: Users, className: "border-primary/20 bg-primary/10 text-primary" },
  dispute: { label: "Dispute", icon: AlertTriangle, className: "border-destructive/20 bg-destructive/10 text-destructive" },
};

function sortOldestFirst(items: QueueItem[]) {
  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export default function AdminOperationsQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [productsResult, sellersResult, disputesResult] = await Promise.all([
        (supabase as any).from("products").select("id,title,created_at,updated_at,moderation_reason,moderation_next_action,moderation_updated_at,status,is_approved").eq("is_approved", false).in("status", ["active", "draft"]).order("created_at", { ascending: true }).limit(8),
        supabase.rpc("admin_user_directory"),
        supabase.from("disputes").select("id,reason,created_at,status").in("status", ["open", "investigating"]).order("created_at", { ascending: true }).limit(8),
      ]);

      if (cancelled) return;
      const queue: QueueItem[] = [];
      (productsResult.data ?? []).forEach((product: any) => {
        const changesRequested = Boolean(product.moderation_reason?.trim());
        queue.push({ id: `product-${product.id}`, kind: "product", title: product.title || "Untitled product", reason: changesRequested ? product.moderation_reason : "New product awaiting approval.", createdAt: product.moderation_updated_at || product.updated_at || product.created_at, owner: changesRequested ? "Seller" : "Tradibu moderation", nextAction: changesRequested ? product.moderation_next_action || "Review the seller response." : "Review listing and approve or request changes.", href: "/admin/products" });
      });
      ((sellersResult.data ?? []) as Array<{ user_id?: string; full_name?: string | null; email?: string; roles?: string[]; is_approved?: boolean; is_banned?: boolean; created_at?: string }>).forEach((seller) => {
        if (!seller.roles?.includes("seller") || seller.is_approved || seller.is_banned) return;
        queue.push({ id: `seller-${seller.user_id}`, kind: "seller", title: seller.full_name || seller.email || "Seller application", reason: "Seller access is waiting for admin approval.", createdAt: seller.created_at || new Date().toISOString(), owner: "Tradibu admin", nextAction: "Review seller profile and approve or reject access.", href: "/admin/sellers" });
      });
      (disputesResult.data ?? []).forEach((dispute: any) => {
        queue.push({ id: `dispute-${dispute.id}`, kind: "dispute", title: `Dispute ${String(dispute.id).slice(0, 8)}`, reason: dispute.reason || "Buyer or seller dispute needs review.", createdAt: dispute.created_at, owner: "Tradibu admin", nextAction: "Review evidence and decide the next resolution step.", href: "/admin/disputes" });
      });
      setItems(sortOldestFirst(queue).slice(0, 8));
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div><CardTitle className="flex items-center gap-2 font-display"><ShieldCheck className="h-5 w-5 text-primary" /> Operations queue</CardTitle><p className="mt-1 text-xs text-muted-foreground">Oldest unresolved work first, with a clear next action.</p></div>
        <Clock className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Loading operations...</div> : items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /><p className="text-sm text-muted-foreground">No unresolved seller, product, or dispute work right now.</p></div>
        ) : <div className="space-y-3">{items.map((item) => { const meta = kindMeta[item.kind]; const Icon = meta.icon; return (
          <div key={item.id} className="rounded-xl border border-border/60 p-3"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="h-4 w-4 text-muted-foreground" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-foreground">{item.title}</p><Badge className={meta.className}>{meta.label}</Badge></div><p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Why:</span> {item.reason}</p><p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Next:</span> {item.nextAction}</p><p className="mt-1 text-[11px] text-muted-foreground">Owner: {item.owner} / {formatModerationAge(item.createdAt)}</p></div></div><Link to={item.href} className="shrink-0"><Button size="sm" variant="outline" className="gap-1">Open <ArrowRight className="h-3.5 w-3.5" /></Button></Link></div></div>
        ); })}</div>}
      </CardContent>
    </Card>
  );
}
