import { Badge } from "@/components/ui/badge";

const map: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  shipped: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  delivered: "bg-accent/10 text-accent border-accent/20",
  resolved: "bg-accent/10 text-accent border-accent/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  open: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
};

export default function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const cls = map[status] || "bg-muted text-muted-foreground border-border";
  return <Badge className={`${cls} capitalize text-xs ${className}`}>{status}</Badge>;
}
