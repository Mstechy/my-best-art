import { Star, ShieldCheck } from "lucide-react";

interface Props {
  average: number;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  keywords: { keyword: string; count: number }[];
  activeFilter: string;
  onFilterChange: (f: string) => void;
  photoCount: number;
  starCounts: Record<number, number>;
  allVerified: boolean;
}

export default function ReviewSummary({ average, total, positive, neutral, negative, keywords, activeFilter, onFilterChange, photoCount, starCounts, allVerified }: Props) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const positivePct = pct(positive);
  const neutralPct = pct(neutral);
  const negativePct = pct(negative);

  const Bar = ({ label, value, percent, color }: { label: string; value: number; percent: number; color: string }) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${percent}%` }} />
      </div>
      <span className="w-12 text-right text-foreground/80 font-medium">{percent}%</span>
      <span className="w-14 text-right text-muted-foreground">{value} rev.</span>
    </div>
  );

  const filters = [
    { key: "all", label: `All (${total})` },
    { key: "photos", label: `With Photos (${photoCount})` },
    { key: "5", label: `5★ (${starCounts[5] ?? 0})` },
    { key: "4", label: `4★ (${starCounts[4] ?? 0})` },
    { key: "3", label: `3★ (${starCounts[3] ?? 0})` },
    { key: "2", label: `2★ (${starCounts[2] ?? 0})` },
    { key: "1", label: `1★ (${starCounts[1] ?? 0})` },
  ];

  return (
    <div className="rounded-xl border border-border/60 p-5 bg-card">
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="flex md:flex-col items-center md:items-start gap-4 md:gap-2">
          <div className="text-center md:text-left">
            <div className="font-display text-5xl font-bold text-foreground leading-none">{average.toFixed(1)}</div>
            <div className="mt-2 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`h-4 w-4 ${s <= Math.round(average) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
              ))}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{total} rating{total !== 1 ? "s" : ""}</div>
          </div>
          {allVerified && total > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-1 text-[10px] font-semibold border border-accent/20">
              <ShieldCheck className="h-3 w-3" /> All from verified purchases
            </span>
          )}
        </div>

        <div className="space-y-2">
          <Bar label="Positive" value={positive} percent={positivePct} color="bg-accent" />
          <Bar label="Neutral" value={neutral} percent={neutralPct} color="bg-yellow-500" />
          <Bar label="Negative" value={negative} percent={negativePct} color="bg-destructive" />
        </div>
      </div>

      {keywords.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {keywords.map(k => (
            <span key={k.keyword} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium border border-primary/20">
              {k.keyword} <span className="text-primary/70">({k.count})</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-1.5 overflow-x-auto -mx-1 px-1">
        {filters.map(f => {
          const active = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={`px-3 h-8 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground/80 border-border hover:bg-muted"}`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
