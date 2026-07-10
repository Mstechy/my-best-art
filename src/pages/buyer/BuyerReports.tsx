import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, AlertTriangle, Shield, FileText, Plus, Clock, Loader2 } from "lucide-react";
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

const DISPUTE_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  open:          { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-500 dark:text-red-400", label: "Open" },
  investigating: { bg: "bg-[#F6C75D]/15", text: "text-[#5C3A00] dark:text-[#F6C75D]", label: "Investigating" },
  resolved:      { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400", label: "Resolved" },
  dismissed:     { bg: "bg-[#F2F3F5] dark:bg-[#1A1A1A]", text: "text-[#888880] dark:text-[#A0A0A0]", label: "Dismissed" },
};

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
    if (/(.)\\1{3,}/.test(v)) return "Please use a meaningful reason";
    if (v.split(/\\s+/).filter(Boolean).length < 2) return "Please use at least two words";
    return null;
  };

  const validateDescription = (val: string): string | null => {
    const v = val.trim();
    if (!v) return null;
    if (v.length < 10) return "Description should be at least 10 characters";
    if (/(.)\\1{4,}/.test(v)) return "Please write a meaningful description";
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
      if (proofFile.size > MAX_PROOF_BYTES) { toast({ title: "File too large", description: "Max 5MB", variant: "destructive" }); setSaving(false); return; }
      const safeName = proofFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
      const path = `disputes/${user.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, proofFile, { contentType: proofFile.type, upsert: false });
      if (upErr) { toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); setSaving(false); return; }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      proofUrl = pub.publicUrl;
    }

    const { error } = await supabase.from("disputes").insert({
      buyer_id: user.id, seller_id: selectedOrder.seller_id, order_id: selectedOrder.id,
      reason: reason.trim(), description: description.trim() || null, proof_url: proofUrl,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else {
      toast({ title: "Report submitted" });
      setReason(""); setDescription(""); setSelectedOrderId(""); setProofFile(null); setDialogOpen(false);
    }
    setSaving(false);
    const { data } = await supabase.from("disputes").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false });
    if (data) setDisputes(data as Dispute[]);
  };

  const reportTypes = [
    { icon: AlertTriangle, title: "Fraud / Scam", desc: "Seller didn't deliver or sent fake products", iconBg: "bg-red-50 dark:bg-red-900/20", iconColor: "text-red-500" },
    { icon: Shield, title: "Payment Issue", desc: "Unauthorized charge or payment not refunded", iconBg: "bg-purple-50 dark:bg-purple-900/20", iconColor: "text-purple-500" },
    { icon: FileText, title: "Product Issue", desc: "Product doesn't match description or is defective", iconBg: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-500" },
  ];

  return (
    <div className="space-y-6 max-w-[1280px]">
      {/* Header */}
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">Reports & Disputes</h1>
            <p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0]">Report sellers and track complaint status</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-semibold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
                <Plus className="h-3.5 w-3.5" /> New Report
              </button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-[#1A1A1A] border-[#E8E8E8] dark:border-[#222222] rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">File a Report</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">Order *</label>
                  <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                    <SelectTrigger className="h-10 rounded-xl border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-xs">
                      <SelectValue placeholder="Choose an order" />
                    </SelectTrigger>
                    <SelectContent>
                      {orders.map(order => (
                        <SelectItem key={order.id} value={order.id} className="text-xs">
                          #{order.id.slice(0, 8)} · {order.status} · ${Number(order.total_amount).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">Reason *</label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="h-10 rounded-xl border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-xs">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {REASONS.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">Description</label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 1000))} placeholder="Describe the issue in detail..." rows={4}
                    className="rounded-xl border-[#E8E8E8] dark:border-[#222222] bg-[#FAFAFA] dark:bg-[#111111] text-xs" />
                  <p className="text-right text-[9px] text-[#888880]">{description.length}/1000</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">Proof (image or PDF, max 5MB)</label>
                  <input type="file" accept="image/*,application/pdf" onChange={e => setProofFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-xs text-[#888880] file:mr-3 file:rounded-full file:border-0 file:bg-[#111111] file:dark:bg-[#FAF5F2] file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:text-white file:dark:text-[#111111] hover:file:opacity-80 cursor-pointer" />
                  {proofFile && <p className="text-[10px] text-[#888880]">{proofFile.name}</p>}
                </div>

                <button onClick={submitReport} disabled={saving || !reason.trim() || !selectedOrderId}
                  className="w-full h-11 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors disabled:opacity-50">
                  {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…</> : "Submit Report"}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </AnimatedSection>

      {/* Report type cards */}
      <AnimatedSection variant="fade-up" delay={50}>
        <p className="text-xs font-bold text-[#888880] dark:text-[#A0A0A0] uppercase tracking-wider mb-4">What would you like to report?</p>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
          {reportTypes.map((type, i) => (
            <button key={type.title} onClick={() => { setReason(type.title); setDialogOpen(true); }}
              className={`group bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${
                i === 2 ? "col-span-2 sm:col-span-1" : ""
              }`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${type.iconBg} mb-4 group-hover:scale-105 transition-transform`}>
                <type.icon className={`h-5 w-5 ${type.iconColor}`} />
              </div>
              <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">{type.title}</p>
              <p className="mt-1 text-[10px] text-[#888880] dark:text-[#A0A0A0] leading-relaxed">{type.desc}</p>
            </button>
          ))}
        </div>
      </AnimatedSection>

      {/* Disputes list */}
      <AnimatedSection variant="fade-up" delay={100}>
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222]">
          <div className="px-5 pt-5 pb-4 border-b border-[#F2F3F5] dark:border-[#222222]">
            <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">Your Reports</p>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#888880]" /></div>
            ) : disputes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <div className="h-12 w-12 rounded-2xl bg-[#F2F3F5] dark:bg-[#111111] flex items-center justify-center">
                  <Flag className="h-5 w-5 text-[#888880] dark:text-[#A0A0A0]" />
                </div>
                <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">No reports filed</p>
                <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0] max-w-xs">If you experience any issues with a seller, file a report above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {disputes.map(d => {
                  const order = orders.find(o => o.id === d.order_id);
                  const cfg = DISPUTE_STATUS[d.status] ?? DISPUTE_STATUS.dismissed;
                  return (
                    <div key={d.id} className="rounded-xl border border-[#F2F3F5] dark:border-[#1E1E1E] bg-[#FAFAFA] dark:bg-[#111111] p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2]">{d.reason}</p>
                          {d.description && <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0] truncate max-w-xs mt-0.5">{d.description}</p>}
                          <p className="text-[9px] text-[#888880] dark:text-[#A0A0A0] mt-1">{new Date(d.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </div>
                      {order && (
                        <a href="/buyer/tracking" className="block rounded-lg bg-[#F2F3F5] dark:bg-[#1A1A1A] px-3 py-2 text-[10px] hover:opacity-80 transition-opacity">
                          <span className="text-[#888880]">Order </span>
                          <span className="font-mono font-semibold text-[#111111] dark:text-[#FAF5F2]">#{order.id.slice(0, 8)}</span>
                          <span className="text-[#888880]"> · {order.status} · ${Number(order.total_amount).toFixed(2)}</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </AnimatedSection>

      {/* Info strip */}
      <AnimatedSection variant="fade-up" delay={150}>
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-4 flex items-start gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F6C75D]/15 shrink-0">
            <Clock className="h-3.5 w-3.5 text-[#F6C75D]" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">Reports are reviewed within 24–48 hours</p>
            <p className="mt-1 text-[10px] text-[#888880] dark:text-[#A0A0A0]">Our team investigates every report. Seller accounts may be frozen during investigation.</p>
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
