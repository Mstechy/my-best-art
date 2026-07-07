import { CheckCircle2, Circle, Package, Truck, ShoppingBag, Home } from "lucide-react";

const STEPS = [
  { key: "pending", label: "Placed", Icon: ShoppingBag },
  { key: "processing", label: "Processing", Icon: Package },
  { key: "shipped", label: "Shipped", Icon: Truck },
  { key: "delivered", label: "Delivered", Icon: Home },
] as const;

interface HistoryEntry { status: string; changed_at: string; }

interface Props {
  status: string;
  history?: HistoryEntry[];
}

export default function OrderTimeline({ status, history = [] }: Props) {
  const reachedIdx = STEPS.findIndex(s => s.key === status);
  const lastIdx = reachedIdx < 0 ? 0 : reachedIdx;
  const tsFor = (key: string) => history.find(h => h.status === key)?.changed_at;

  return (
    <ol className="space-y-3 mt-3">
      {STEPS.map((step, i) => {
        const done = i <= lastIdx && status !== "cancelled";
        const ts = tsFor(step.key);
        return (
          <li key={step.key} className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
              {ts && <p className="text-[11px] text-muted-foreground">{new Date(ts).toLocaleString()}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
