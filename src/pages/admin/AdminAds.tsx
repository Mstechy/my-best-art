import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, Eye, MousePointer, DollarSign, TrendingUp, Pencil, Trash2, Pause, Play, StopCircle } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdFormDialog, { AdRow } from "@/components/AdFormDialog";

export default function AdminAds() {
  const { toast } = useToast();
  const [ads, setAds] = useState<AdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdRow | null>(null);

  const fetchAds = async () => {
    const { data, error } = await supabase.from("ads").select("*").order("created_at", { ascending: false });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else setAds((data ?? []) as AdRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchAds(); }, []);

  const totalImpressions = ads.reduce((s, a) => s + (((a as any).impressions as number) ?? 0), 0);
  const totalClicks = ads.reduce((s, a) => s + (((a as any).clicks as number) ?? 0), 0);
  const totalSpent = ads.reduce((s, a) => s + Number(a.spent), 0);

  const adStats = [
    { label: "Active Ads", value: String(ads.filter(a => a.status === "active").length), icon: Megaphone, gradient: "gradient-admin" },
    { label: "Total Impressions", value: String(totalImpressions), icon: Eye, gradient: "gradient-primary" },
    { label: "Total Clicks", value: String(totalClicks), icon: MousePointer, gradient: "gradient-seller" },
    { label: "Spend", value: `$${totalSpent.toFixed(2)}`, icon: DollarSign, gradient: "gradient-buyer" },
  ];

  const statusColors: Record<string, string> = {
    active: "bg-accent/10 text-accent",
    paused: "bg-yellow-500/10 text-yellow-600",
    ended: "bg-muted text-muted-foreground",
  };

  const setStatus = async (id: string, status: "active" | "paused" | "ended") => {
    const { error } = await supabase.from("ads").update({ status: status as any }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Ad ${status}` });
    fetchAds();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this ad? This cannot be undone.")) return;
    const { error } = await supabase.from("ads").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Ad deleted" });
    fetchAds();
  };

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (ad: AdRow) => { setEditing(ad); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Ad Management</h1>
            <p className="mt-1 text-muted-foreground">Create promotional banners visible across the marketplace</p>
          </div>
          <Button onClick={openCreate} className="gap-2 gradient-admin text-primary-foreground shadow-glow">
            <Plus className="h-4 w-4" /> Create Ad
          </Button>
        </div>
      </AnimatedSection>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adStats.map((stat, i) => (
          <AnimatedSection key={stat.label} variant="fade-up" delay={i * 60}>
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.gradient}`}>
                  <stat.icon className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
              <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          </AnimatedSection>
        ))}
      </div>

      <AnimatedSection variant="fade-up" delay={200}>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : ads.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                  <TrendingUp className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-display font-semibold text-foreground">No ads yet</p>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">Create a promotional banner like “Summer Sale — 20% off” to push site-wide.</p>
                <Button onClick={openCreate} className="mt-6 gap-2 gradient-admin text-primary-foreground shadow-glow"><Plus className="h-4 w-4" /> Create First Ad</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {ads.map(ad => (
              <Card key={ad.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {ad.image_url && <img src={ad.image_url} alt="" className="h-12 w-20 rounded-md object-cover border border-border shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-foreground truncate">{ad.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{ad.placement} · {(ad as any).impressions ?? 0} impressions · {(ad as any).clicks ?? 0} clicks</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-muted-foreground">${Number(ad.spent).toFixed(2)} / ${Number(ad.budget).toFixed(2)}</span>
                      <Badge className={statusColors[ad.status] || ""}>{ad.status}</Badge>
                      <Button size="sm" variant="outline" onClick={() => openEdit(ad)} className="gap-1"><Pencil className="h-3 w-3" /> Edit</Button>
                      {ad.status === "active" ? (
                        <Button size="sm" variant="outline" onClick={() => setStatus(ad.id, "paused")} className="gap-1"><Pause className="h-3 w-3" /> Pause</Button>
                      ) : ad.status === "paused" ? (
                        <Button size="sm" variant="outline" onClick={() => setStatus(ad.id, "active")} className="gap-1"><Play className="h-3 w-3" /> Resume</Button>
                      ) : null}
                      {ad.status !== "ended" && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(ad.id, "ended")} className="gap-1"><StopCircle className="h-3 w-3" /> End</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => remove(ad.id)} className="gap-1 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AnimatedSection>

      <AdFormDialog open={dialogOpen} onOpenChange={setDialogOpen} ad={editing} onSaved={fetchAds} />
    </div>
  );
}
