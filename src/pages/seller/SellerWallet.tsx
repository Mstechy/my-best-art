import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, DollarSign, ArrowUpRight, Clock, TrendingUp } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import EmptyState from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface WalletTx {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

type Filter = "all" | "sale" | "fee" | "withdrawal";

const TYPE_BADGE: Record<string, string> = {
  sale: "bg-accent/15 text-accent border-accent/30",
  fee: "bg-muted text-muted-foreground border-border",
  withdrawal: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  refund: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function SellerWallet() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [available, setAvailable] = useState(0);
  const [pending, setPending] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: wallet } = await supabase
        .from("seller_wallets").select("*").eq("seller_id", user.id).maybeSingle();

      if (wallet) {
        setAvailable(Number((wallet as any).available_balance) || 0);
        setPending(Number((wallet as any).pending_balance) || 0);
        setTotalEarned(Number((wallet as any).total_earned) || 0);
        const { data: txs } = await supabase
          .from("wallet_transactions").select("*").eq("wallet_id", (wallet as any).id)
          .order("created_at", { ascending: false });
        if (txs) setTransactions(txs as WalletTx[]);
      } else {
        // Fallback: derive pending from in-flight orders
        const { data: orders } = await supabase
          .from("orders").select("total_amount, status").eq("seller_id", user.id);
        const inFlight = (orders || [])
          .filter(o => ["pending", "processing", "shipped"].includes(o.status as string))
          .reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
        setPending(inFlight);
      }
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    if (filter === "all") return transactions;
    return transactions.filter(t => t.type === filter);
  }, [transactions, filter]);

  const grouped = useMemo(() => {
    const map: Record<string, WalletTx[]> = {};
    filtered.forEach(tx => {
      const day = new Date(tx.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      (map[day] ||= []).push(tx);
    });
    return Object.entries(map);
  }, [filtered]);

  const walletStats = [
    { label: "Available Balance", value: `$${available.toFixed(2)}`, icon: Wallet, gradient: "gradient-seller", desc: "Ready to withdraw" },
    { label: "Pending", value: `$${pending.toFixed(2)}`, icon: Clock, gradient: "gradient-primary", desc: "In escrow until delivered" },
    { label: "Total Earned", value: `$${totalEarned.toFixed(2)}`, icon: TrendingUp, gradient: "gradient-buyer", desc: "Lifetime earnings" },
  ];

  const filterPills: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "sale", label: "Sales" },
    { id: "fee", label: "Fees" },
    { id: "withdrawal", label: "Payouts" },
  ];

  const handleWithdraw = () => {
    if (available < 10) {
      toast({ title: "Minimum payout is $10", description: "Reach $10 in available balance to request a withdrawal.", variant: "destructive" });
      return;
    }
    toast({ title: "Payout requested", description: "Your withdrawal will be processed within 1–3 business days." });
  };

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Wallet</h1>
            <p className="mt-1 text-muted-foreground">Your earnings and withdrawal management</p>
          </div>
          <Button onClick={handleWithdraw} disabled={available < 10}
            className="gap-2 gradient-seller text-primary-foreground shadow-glow-seller disabled:opacity-50">
            <ArrowUpRight className="h-4 w-4" /> Request Payout
          </Button>
        </div>
      </AnimatedSection>

      <div className="grid gap-4 sm:grid-cols-3">
        {walletStats.map((stat, i) => (
          <AnimatedSection key={stat.label} variant="fade-up" delay={i * 80}>
            <Card className="border-border/60">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.gradient}`}>
                    <stat.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                </div>
                <p className="font-display text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.desc}</p>
              </CardContent>
            </Card>
          </AnimatedSection>
        ))}
      </div>

      <AnimatedSection variant="fade-up" delay={200}>
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <CardTitle className="font-display">Transaction History</CardTitle>
            <div className="flex gap-1">
              {filterPills.map(p => (
                <button
                  key={p.id}
                  onClick={() => setFilter(p.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filter === p.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : grouped.length === 0 ? (
              <EmptyState icon={DollarSign} title="No transactions yet" description="Your sales, fees, and payouts will appear here once orders are delivered." role="seller" />
            ) : (
              <div className="space-y-5">
                {grouped.map(([day, txs]) => (
                  <div key={day}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{day}</div>
                    <div className="space-y-2">
                      {txs.map(tx => {
                        const isNegative = tx.type === "withdrawal" || tx.type === "fee" || tx.type === "refund";
                        return (
                          <div key={tx.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <Badge className={`${TYPE_BADGE[tx.type] || "bg-muted text-muted-foreground"} capitalize text-[10px] shrink-0`}>{tx.type}</Badge>
                              <div className="min-w-0">
                                {tx.description && <p className="text-sm text-foreground truncate">{tx.description}</p>}
                                <p className="text-[11px] text-muted-foreground">{new Date(tx.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                              </div>
                            </div>
                            <span className={`font-display font-bold shrink-0 ${isNegative ? "text-destructive" : "text-accent"}`}>
                              {isNegative ? "-" : "+"}${Math.abs(Number(tx.amount)).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>
    </div>
  );
}
