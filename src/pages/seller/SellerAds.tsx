import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, Eye, MousePointer, DollarSign, TrendingUp } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Ad {
  id: string;
  title: string;
  placement: string;
  status: string;
  impressions: number;
  clicks: number;
  budget: number;
  spent: number;
  start_date: string | null;
  end_date: string | null;
}

export default function SellerAds() {
  const { user } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("ads").select("*").eq("seller_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setAds(data as Ad[]); setLoading(false); });
  }, [user]);

  const totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
  const totalSpent = ads.reduce((s, a) => s + Number(a.spent), 0);

  const adStats = [
    { label: "Active Campaigns", value: String(ads.filter(a => a.status === "active").length), icon: Megaphone, gradient: "gradient-seller" },
    { label: "Total Impressions", value: String(totalImpressions), icon: Eye, gradient: "gradient-primary" },
    { label: "Total Clicks", value: String(totalClicks), icon: MousePointer, gradient: "gradient-buyer" },
    { label: "Ad Spend", value: `$${totalSpent.toFixed(2)}`, icon: DollarSign, gradient: "gradient-admin" },
  ];

  const statusColors: Record<string, string> = {
    active: "bg-accent/10 text-accent",
    paused: "bg-yellow-500/10 text-yellow-600",
    ended: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">My Ads</h1>
            <p className="mt-1 text-muted-foreground">Boost your products with advertising</p>
          </div>
          <Button className="gap-2 gradient-seller text-primary-foreground shadow-glow-seller">
            <Plus className="h-4 w-4" /> Create Campaign
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
            <CardContent className="py-16">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted mb-5">
                  <TrendingUp className="h-9 w-9 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">No ad campaigns yet</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">Create your first ad campaign to increase product visibility and drive more sales.</p>
                <Button className="mt-6 gap-2 gradient-seller text-primary-foreground shadow-glow-seller">
                  <Plus className="h-4 w-4" /> Create Your First Campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {ads.map(ad => (
              <Card key={ad.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-display font-semibold text-foreground">{ad.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{ad.placement} • {ad.impressions} impressions • {ad.clicks} clicks</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">${Number(ad.spent).toFixed(2)} / ${Number(ad.budget).toFixed(2)}</span>
                      <Badge className={statusColors[ad.status] || ""}>{ad.status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AnimatedSection>
    </div>
  );
}
