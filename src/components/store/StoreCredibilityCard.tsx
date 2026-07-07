import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";

interface Credibility {
  avg_rating: number;
  avg_description: number;
  avg_communication: number;
  avg_shipping: number;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

export default function StoreCredibilityCard({ sellerId, onDetails }: { sellerId: string; onDetails?: () => void }) {
  const [data, setData] = useState<Credibility | null>(null);

  useEffect(() => {
    (async () => {
      const { data: rows } = await (supabase as any).rpc("store_credibility", { _seller_id: sellerId });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (row) {
        setData({
          avg_rating: Number(row.avg_rating || 0),
          avg_description: Number(row.avg_description || 0),
          avg_communication: Number(row.avg_communication || 0),
          avg_shipping: Number(row.avg_shipping || 0),
          positive: Number(row.positive || 0),
          neutral: Number(row.neutral || 0),
          negative: Number(row.negative || 0),
          total: Number(row.total || 0),
        });
      }
    })();
  }, [sellerId]);

  if (!data) return null;
  const pct = (n: number) => (data.total > 0 ? Math.round((n / data.total) * 100) : 0);
  const positivePct = pct(data.positive);
  const neutralPct = pct(data.neutral);
  const negativePct = pct(data.negative);
  const sub = [
    { label: "Items as described", value: data.avg_description || data.avg_rating },
    { label: "Communication", value: data.avg_communication || data.avg_rating },
    { label: "Shipping speed", value: data.avg_shipping || data.avg_rating },
  ];

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div>
          <div className="font-display text-5xl font-bold text-foreground">{data.avg_rating.toFixed(1)}</div>
          <div className="mt-1 text-xs text-muted-foreground">store rating</div>
          <div className="mt-2 flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
              <Star key={s} className={`h-4 w-4 ${s <= Math.round(data.avg_rating) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
            ))}
          </div>
          {onDetails && (
            <button onClick={onDetails} className="mt-2 text-xs text-primary hover:underline">Details ›</button>
          )}
        </div>
        <div className="space-y-3">
          {sub.map(s => (
            <div key={s.label} className="flex items-center gap-3 text-sm">
              <span className="w-40 text-muted-foreground">{s.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${(s.value / 5) * 100}%` }} />
              </div>
              <span className="w-10 text-right text-foreground font-medium">{Number(s.value).toFixed(1)}</span>
            </div>
          ))}
          <div className="mt-4 pt-4 border-t border-border/60 space-y-1.5">
            <BarRow label="Positive" pct={positivePct} count={data.positive} color="bg-accent" />
            <BarRow label="Neutral" pct={neutralPct} count={data.neutral} color="bg-yellow-500" />
            <BarRow label="Negative" pct={negativePct} count={data.negative} color="bg-destructive" />
            <div className="pt-1 text-xs text-muted-foreground">{positivePct}% positive reviews · {data.total} total</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BarRow({ label, pct, count, color }: { label: string; pct: number; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-foreground font-medium">{pct}%</span>
      <span className="w-14 text-right text-muted-foreground">{count} rev.</span>
    </div>
  );
}
