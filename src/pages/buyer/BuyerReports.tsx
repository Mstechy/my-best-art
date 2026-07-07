import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, AlertTriangle, Shield, FileText, Plus, Clock } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Dispute {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  proof_url: string | null;
  order_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

const REASONS = ["Item not received", "Counterfeit / fake", "Damaged on arrival", "Wrong item", "Refund not issued", "Other"];
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

interface ReportableOrder {
  id: string;
  seller_id: string;
  status: string;
  total_amount: number;
  created_at: string;
}

export default function BuyerReports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [orders, setOrders] = useState<ReportableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [saving, setSaving] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("disputes").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false }),
      supabase.from("orders").select("id, seller_id, status, total_amount, created_at").eq("buyer_id", user.id).order("created_at", { ascending: false }),
    ]).then(([disputesRes, ordersRes]) => {
      if (disputesRes.data) setDisputes(disputesRes.data as Dispute[]);
      if (ordersRes.data) setOrders(ordersRes.data as ReportableOrder[]);
      setLoading(false);
    });
  }, [user]);

  const validateReason = (val: string): string | null => {
    const v = val.trim();
    if (v.length < 10) return "Reason must be at least 10 characters";
    if (!/[aeiou]/i.test(v)) return "Please use a meaningful reason";
    if (/(.)\1{3,}/.test(v)) return "Please use a meaningful reason";
    if (v.split(/\s+/).filter(Boolean).length < 2) return "Please use at least two words";
    return null;
  };
  const validateDescription = (val: string): string | null => {
    const v = val.trim();
    if (!v) return null;
    if (v.length < 10) return "Description should be at least 10 characters";
    if (/(.)\1{4,}/.test(v)) return "Please write a meaningful description";
    return null;
  };

  const submitReport = async () => {
    const selectedOrder = orders.find(order => order.id === selectedOrderId);
    if (!user || !selectedOrder) return;
    const rErr = validateReason(reason);
    if (rErr) { toast({ title: "Invalid reason", description: rErr, variant: "destructive" }); return; }
    const dErr = validateDescription(description);
    if (dErr) { toast({ title: "Invalid description", description: dErr, variant: "destructive" }); return; }
    setSaving(true);

    let proofUrl: string | null = null;
    if (proofFile) {
      if (proofFile.size > MAX_PROOF_BYTES) {
        toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
        setSaving(false); return;
      }
      const safeName = proofFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
      const path = `disputes/${user.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, proofFile, { contentType: proofFile.type, upsert: false });
      if (upErr) { toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); setSaving(false); return; }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      proofUrl = pub.publicUrl;
    }

    const { error } = await supabase.from("disputes").insert({
      buyer_id: user.id,
      seller_id: selectedOrder.seller_id,
      order_id: selectedOrder.id,
      reason: reason.trim(),
      description: description.trim() || null,
      proof_url: proofUrl,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Report submitted" }); setReason(""); setDescription(""); setSelectedOrderId(""); setProofFile(null); setDialogOpen(false); }
    setSaving(false);
    const { data } = await supabase.from("disputes").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false });
    if (data) setDisputes(data as Dispute[]);
  };

  const statusColors: Record<string, string> = {
    open: "bg-destructive/10 text-destructive",
    investigating: "bg-yellow-500/10 text-yellow-600",
    resolved: "bg-accent/10 text-accent",
    dismissed: "bg-muted text-muted-foreground",
  };

  const reportTypes = [
    { icon: AlertTriangle, title: "Fraud / Scam", desc: "Seller didn't deliver or sent fake products", gradient: "gradient-primary" },
    { icon: Shield, title: "Payment Issue", desc: "Unauthorized charge or payment not refunded", gradient: "gradient-seller" },
    { icon: FileText, title: "Product Issue", desc: "Product doesn't match description or is defective", gradient: "gradient-buyer" },
  ];

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Reports & Disputes</h1>
            <p className="mt-1 text-muted-foreground">Report sellers and track complaint status</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 gradient-primary text-primary-foreground shadow-glow">
                <Plus className="h-4 w-4" /> New Report
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">File a Report</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Order *</label>
                  <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choose an order" /></SelectTrigger>
                    <SelectContent>
                      {orders.map(order => (
                        <SelectItem key={order.id} value={order.id}>
                          #{order.id.slice(0, 8)} · {order.status} · ${Number(order.total_amount).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Reason *</label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason" /></SelectTrigger>
                    <SelectContent>
                      {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 1000))} placeholder="Describe the issue in detail..." className="mt-1" rows={4} />
                  <p className="mt-1 text-right text-[10px] text-muted-foreground">{description.length}/1000</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Proof (image or PDF, optional, max 5MB)</label>
                  <Input type="file" accept="image/*,application/pdf" onChange={e => setProofFile(e.target.files?.[0] ?? null)} className="mt-1 cursor-pointer" />
                  {proofFile && <p className="mt-1 text-xs text-muted-foreground">{proofFile.name}</p>}
                </div>
                <Button onClick={submitReport} disabled={saving || !reason.trim() || !selectedOrderId} className="w-full gradient-primary text-primary-foreground">
                  {saving ? "Submitting..." : "Submit Report"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={50}>
        <h2 className="font-display text-lg font-semibold text-foreground mb-4">What would you like to report?</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {reportTypes.map(type => (
            <button key={type.title} onClick={() => { setReason(type.title); setDialogOpen(true); }}
              className="group rounded-2xl border border-border/60 bg-card p-6 text-left card-hover transition-all">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${type.gradient} mb-4 group-hover:scale-110 transition-transform`}>
                <type.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-display font-semibold text-foreground">{type.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{type.desc}</p>
            </button>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={100}>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="font-display">Your Reports</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : disputes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                  <Flag className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-display font-semibold text-foreground">No reports filed</p>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">If you experience any issues with a seller, file a report above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {disputes.map(d => {
                  const order = orders.find(o => o.id === d.order_id);
                  return (
                    <div key={d.id} className="rounded-lg border border-border/40 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{d.reason}</p>
                          {d.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{d.description}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5">{new Date(d.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge className={statusColors[d.status] || ""}>{d.status}</Badge>
                      </div>
                      {order && (
                        <a href="/buyer/tracking" className="block rounded-md bg-muted/40 px-3 py-2 text-xs hover:bg-muted/60">
                          <span className="text-muted-foreground">Order </span>
                          <span className="font-mono">#{order.id.slice(0, 8)}</span>
                          <span className="text-muted-foreground"> · {order.status} · ${Number(order.total_amount).toFixed(2)}</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={150}>
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Reports are reviewed within 24-48 hours</p>
            <p className="text-xs text-muted-foreground mt-1">Our team investigates every report. Seller accounts may be frozen during investigation.</p>
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
