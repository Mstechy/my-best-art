import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Copy, ExternalLink, RefreshCw, Search, ShoppingBasket, Unplug } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const FEED_URL = "https://www.tradibu.com/feeds/google-products.xml";
const GOOGLE_FN = "google-search-console";

type FeedRun = {
  started_at: string;
  finished_at: string | null;
  status: string;
  product_count: number;
  error_count: number;
  errors: unknown;
  triggered_by: string;
};
type FeedSettings = {
  default_brand: string | null;
  shipping_country: string;
  shipping_method: string;
  shipping_price_ngn: number | null;
};
type Exclusion = { entity_type: "seller" | "product" | "collection"; entity_id: string };
type CatalogueRow = { id: string; label: string; detail?: string };
type SearchRow = { clicks: number; impressions: number; ctr: number; position: number };
type SearchReport = {
  property: string;
  totals: SearchRow;
  dates: Array<SearchRow & { date: string }>;
  countries: Array<SearchRow & { country: string }>;
  pages: Array<SearchRow & { page: string }>;
  geographyLevel: "country";
};
type SearchStatus = { connected: boolean; connectedAt: string | null; property: string | null };

const db = supabase as unknown as { from: (table: string) => any };

function dateRange(days: number) {
  const end = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const format = (value: Date) => value.toISOString().slice(0, 10);
  return { startDate: format(start), endDate: format(end) };
}

function displayNumber(value: number, digits = 0) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function AdminGoogleMerchant() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<FeedSettings>({
    default_brand: "",
    shipping_country: "NG",
    shipping_method: "Standard",
    shipping_price_ngn: null,
  });
  const [runs, setRuns] = useState<FeedRun[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueRow[]>([]);
  const [entityType, setEntityType] = useState<Exclusion["entity_type"]>("product");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchStatus, setSearchStatus] = useState<SearchStatus | null>(null);
  const [searchReport, setSearchReport] = useState<SearchReport | null>(null);
  const [searchDays, setSearchDays] = useState(28);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchReportError, setSearchReportError] = useState("");

  const loadFeedData = useCallback(async () => {
    setLoading(true);
    const [settingsResult, runsResult, exclusionsResult] = await Promise.all([
      db.from("google_feed_settings").select("default_brand, shipping_country, shipping_method, shipping_price_ngn").eq("id", true).maybeSingle(),
      db.from("google_feed_runs").select("started_at, finished_at, status, product_count, error_count, errors, triggered_by").order("started_at", { ascending: false }).limit(10),
      db.from("google_feed_exclusions").select("entity_type, entity_id"),
    ]);
    const failure = settingsResult.error || runsResult.error || exclusionsResult.error;
    if (failure) {
      toast({ title: "Could not load Google Merchant settings", description: failure.message, variant: "destructive" });
    } else {
      if (settingsResult.data) setSettings(settingsResult.data as FeedSettings);
      setRuns((runsResult.data || []) as FeedRun[]);
      setExclusions((exclusionsResult.data || []) as Exclusion[]);
    }
    setLoading(false);
  }, [toast]);

  const loadSearchStatus = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke(`${GOOGLE_FN}`, { body: { action: "status" } });
    if (error) {
      toast({ title: "Could not check Search Console connection", description: error.message, variant: "destructive" });
      return;
    }
    setSearchStatus(data as SearchStatus);
  }, [toast]);

  useEffect(() => {
    void loadFeedData();
    void loadSearchStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("gsc") === "connected") {
      toast({ title: "Google Search Console connected" });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("gsc") === "error") {
      toast({ title: "Google connection failed", description: params.get("gsc_message") || "Try connecting again.", variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [loadFeedData, loadSearchStatus, toast]);

  useEffect(() => {
    let cancelled = false;
    const loadCatalogue = async () => {
      const term = search.trim();
      let query;
      if (entityType === "product") {
        query = db.from("products").select("id, title, seller_id").order("title").limit(100);
        if (term) query = query.ilike("title", `%${term}%`);
      } else if (entityType === "seller") {
        const { data: sellerRoles, error: rolesError } = await db.from("user_roles").select("user_id").eq("role", "seller").limit(5000);
        if (rolesError) {
          if (!cancelled) toast({ title: "Could not load sellers", description: rolesError.message, variant: "destructive" });
          return;
        }
        const sellerIds = (sellerRoles || []).map((row: { user_id: string }) => row.user_id);
        if (sellerIds.length === 0) {
          setCatalogue([]);
          return;
        }
        query = db.from("profiles").select("user_id, full_name").in("user_id", sellerIds).order("full_name").limit(100);
        if (term) query = query.ilike("full_name", `%${term}%`);
      } else {
        query = db.from("marketplace_collections").select("id, title").order("title").limit(100);
        if (term) query = query.ilike("title", `%${term}%`);
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        toast({ title: "Could not load exclusion options", description: error.message, variant: "destructive" });
        setCatalogue([]);
      } else if (entityType === "seller") {
        setCatalogue((data || []).map((row: { user_id: string; full_name: string | null }) => ({
          id: row.user_id,
          label: row.full_name || "Seller",
          detail: row.user_id,
        })));
      } else {
        setCatalogue((data || []).map((row: { id: string; title?: string; seller_id?: string }) => ({
          id: row.id,
          label: row.title || "Untitled",
          detail: entityType === "product" ? row.seller_id : undefined,
        })));
      }
    };
    void loadCatalogue();
    return () => { cancelled = true; };
  }, [entityType, search, toast]);

  const excludedIds = useMemo(
    () => new Set(exclusions.filter((item) => item.entity_type === entityType).map((item) => item.entity_id)),
    [entityType, exclusions],
  );
  const latestRun = runs[0];

  const updateExclusion = async (id: string, excluded: boolean) => {
    setSaving(true);
    const result = excluded
      ? await db.from("google_feed_exclusions").insert({ entity_type: entityType, entity_id: id })
      : await db.from("google_feed_exclusions").delete().eq("entity_type", entityType).eq("entity_id", id);
    setSaving(false);
    if (result.error) {
      toast({ title: "Could not update feed inclusion", description: result.error.message, variant: "destructive" });
      return;
    }
    setExclusions((current) => excluded
      ? [...current, { entity_type: entityType, entity_id: id }]
      : current.filter((row) => !(row.entity_type === entityType && row.entity_id === id)));
  };

  const saveSettings = async () => {
    const shippingPrice = settings.shipping_price_ngn === null ? null : Number(settings.shipping_price_ngn);
    if (shippingPrice !== null && (!Number.isFinite(shippingPrice) || shippingPrice < 0)) {
      toast({ title: "Check the shipping price", description: "Enter a non-negative amount in NGN, or leave blank to omit shipping from the feed.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await db.from("google_feed_settings").update({
      default_brand: settings.default_brand?.trim() || null,
      shipping_country: settings.shipping_country.trim().toUpperCase(),
      shipping_method: settings.shipping_method.trim() || "Standard",
      shipping_price_ngn: shippingPrice,
      updated_at: new Date().toISOString(),
    }).eq("id", true);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save Merchant settings", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Merchant defaults saved" });
  };

  const regenerateFeed = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("google-feed", { body: { trigger: "admin" } });
    setRunning(false);
    if (error || data?.error) {
      toast({ title: "Feed generation failed", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Product feed regenerated", description: `${data.productCount} products included.` });
    await loadFeedData();
  };

  const copyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(FEED_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Could not copy feed URL", description: "Select and copy the URL manually.", variant: "destructive" });
    }
  };

  const connectSearchConsole = async () => {
    const { data, error } = await supabase.functions.invoke(GOOGLE_FN, { body: { action: "start" } });
    if (error || !data?.authorizationUrl) {
      toast({ title: "Could not start Google authorization", description: error?.message || data?.error || "Check the Google OAuth setup.", variant: "destructive" });
      return;
    }
    window.location.assign(data.authorizationUrl);
  };

  const disconnectSearchConsole = async () => {
    const { error } = await supabase.functions.invoke(GOOGLE_FN, { body: { action: "disconnect" } });
    if (error) {
      toast({ title: "Could not disconnect Google Search Console", description: error.message, variant: "destructive" });
      return;
    }
    setSearchStatus((current) => current ? { ...current, connected: false, connectedAt: null } : null);
    setSearchReport(null);
  };

  const loadSearchReport = async () => {
    const { data, error } = await supabase.functions.invoke(GOOGLE_FN, {
      body: { action: "report", ...dateRange(searchDays) },
    });
    if (error || data?.error) {
      setSearchReportError(error?.message || data?.error || "Search Console report failed");
      toast({ title: "Could not load Search Console report", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    setSearchReportError("");
    setSearchReport(data as SearchReport);
  };

  useEffect(() => {
    if (!searchStatus?.connected) return;
    let cancelled = false;
    const load = async () => {
      setSearchLoading(true);
      const { data, error } = await supabase.functions.invoke(GOOGLE_FN, {
        body: { action: "report", ...dateRange(searchDays) },
      });
      if (!cancelled && (error || data?.error)) {
        setSearchReportError(error?.message || data?.error || "Search Console report failed");
      } else if (!cancelled) {
        setSearchReportError("");
        setSearchReport(data as SearchReport);
      }
      if (!cancelled) setSearchLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [searchDays, searchStatus?.connected]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-foreground">Google Merchant</h1>
        <p className="mt-1 text-muted-foreground">Control product feed inclusion and monitor Google Search performance.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Automatic product feed</CardTitle>
          <CardDescription>Updates after catalogue changes and on the scheduled run. Google can fetch this public URL without signing in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={FEED_URL} aria-label="Google product feed URL" />
            <Button type="button" variant="outline" onClick={copyFeedUrl} className="shrink-0 gap-2">
              <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy URL"}
            </Button>
            <Button type="button" variant="outline" asChild className="shrink-0 gap-2">
              <a href={FEED_URL} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Open feed</a>
            </Button>
            <Button type="button" onClick={regenerateFeed} disabled={running} className="shrink-0 gap-2">
              <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} /> {running ? "Generating…" : "Regenerate now"}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Last run" value={latestRun ? new Date(latestRun.started_at).toLocaleString() : "No completed run yet"} />
            <Metric label="Products in last run" value={latestRun ? displayNumber(latestRun.product_count) : "—"} />
            <Metric label="Reported errors" value={latestRun ? displayNumber(latestRun.error_count) : "—"} />
          </div>
          {latestRun && (
            <p className="text-sm text-muted-foreground">Status: <span className="font-medium text-foreground">{latestRun.status}</span> · Trigger: {latestRun.triggered_by}</p>
          )}
          {latestRun && Array.isArray(latestRun.errors) && latestRun.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <h3 className="font-medium text-destructive">Latest run issues</h3>
              <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-auto pl-5 text-sm">
                {(latestRun.errors as Array<{ title?: string; product_id?: string; reason?: string }>).map((item, index) => (
                  <li key={`${item.product_id || index}-${index}`}>{item.title || item.product_id || "Feed"}: {item.reason || "Unknown error"}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feed defaults</CardTitle>
          <CardDescription>Use default brand only for products that genuinely share that manufacturer/brand. Do not use Tradibu as a substitute brand.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Default brand">
            <Input value={settings.default_brand || ""} onChange={(event) => setSettings({ ...settings, default_brand: event.target.value })} placeholder="Optional manufacturer brand" />
          </Field>
          <Field label="Shipping country (ISO code)">
            <Input value={settings.shipping_country} onChange={(event) => setSettings({ ...settings, shipping_country: event.target.value })} maxLength={2} />
          </Field>
          <Field label="Shipping service">
            <Input value={settings.shipping_method} onChange={(event) => setSettings({ ...settings, shipping_method: event.target.value })} />
          </Field>
          <Field label="Default shipping price (NGN)">
            <Input type="number" min="0" step="0.01" value={settings.shipping_price_ngn ?? ""} onChange={(event) => setSettings({ ...settings, shipping_price_ngn: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Leave blank if unknown" />
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="button" onClick={saveSettings} disabled={saving}>{saving ? "Saving…" : "Save defaults"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Include or exclude catalogue items</CardTitle>
          <CardDescription>Excluded sellers, products, or collections are omitted on the next feed generation. Toggle “Include” on to restore an item.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={entityType} onChange={(event) => setEntityType(event.target.value as Exclusion["entity_type"])}>
              <option value="product">Products</option>
              <option value="seller">Sellers</option>
              <option value="collection">Collections</option>
            </select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${entityType}s`} />
            </div>
          </div>
          <div className="divide-y divide-border rounded-md border">
            {catalogue.map((item) => {
              const excluded = excludedIds.has(item.id);
              return (
                <div key={item.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    {item.detail && <p className="truncate text-xs text-muted-foreground">{item.detail}</p>}
                  </div>
                  <span className={`text-xs ${excluded ? "text-destructive" : "text-muted-foreground"}`}>{excluded ? "Excluded" : "Included"}</span>
                  <Switch checked={!excluded} disabled={saving} aria-label={`${excluded ? "Include" : "Exclude"} ${item.label}`} onCheckedChange={(include) => void updateExclusion(item.id, !include)} />
                </div>
              );
            })}
            {!loading && catalogue.length === 0 && <p className="p-5 text-center text-sm text-muted-foreground">No matching {entityType}s found.</p>}
          </div>
          <p className="text-xs text-muted-foreground">Search is limited to the first 100 matches; enter a more specific name to find an item.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Google Search Console</CardTitle>
          <CardDescription>Search clicks, impressions, click-through rate, and average position for Tradibu’s verified Search Console property.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Search Console property">
              <Input value={searchStatus?.property || ""} onChange={(event) => setSearchStatus((status) => status ? { ...status, property: event.target.value } : status)} placeholder="sc-domain:tradibu.com" />
            </Field>
            <Button type="button" variant="outline" disabled={!searchStatus?.property} onClick={async () => {
              const { error } = await db.from("google_search_console_settings").update({ property_url: searchStatus?.property?.trim() }).eq("id", true);
              if (error) toast({ title: "Could not save Search Console property", description: error.message, variant: "destructive" });
              else {
                toast({ title: "Search Console property saved" });
                if (searchStatus?.connected) await loadSearchReport();
              }
            }}>Save property</Button>
            {searchStatus?.connected
              ? <Button type="button" variant="outline" onClick={disconnectSearchConsole} className="gap-2"><Unplug className="h-4 w-4" /> Disconnect</Button>
              : <Button type="button" onClick={connectSearchConsole} className="gap-2"><ShoppingBasket className="h-4 w-4" /> Connect Google account</Button>}
          </div>
          {searchStatus?.connected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Connected · Search data can be delayed by Google. Source: {searchReport?.property || searchStatus.property}</p>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={searchDays} onChange={(event) => setSearchDays(Number(event.target.value))} aria-label="Search Console date range">
                  <option value={7}>Last 7 days</option><option value={28}>Last 28 days</option><option value={90}>Last 90 days</option>
                </select>
              </div>
              {searchReportError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{searchReportError}</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Search clicks" value={searchReport ? displayNumber(searchReport.totals.clicks) : "—"} />
                <Metric label="Impressions" value={searchReport ? displayNumber(searchReport.totals.impressions) : "—"} />
                <Metric label="Average CTR" value={searchReport ? `${(searchReport.totals.ctr * 100).toFixed(2)}%` : "—"} />
                <Metric label="Average position" value={searchReport ? displayNumber(searchReport.totals.position, 1) : "—"} />
              </div>
              {searchLoading ? <div className="h-64 animate-pulse rounded-md bg-muted/40" /> : searchReport && (
                <>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={searchReport.dates}>
                        <defs><linearGradient id="gscClicks" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="clicks" stroke="hsl(var(--primary))" fill="url(#gscClicks)" />
                        <Line type="monotone" dataKey="impressions" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">Google Search Console provides geographic search performance by country, not by state or city. Its API returns top rows and may not expose every low-volume query or page.</p>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <ReportTable title="Countries" label="Country" rows={searchReport.countries.map((row) => ({ label: row.country.toUpperCase(), clicks: row.clicks, impressions: row.impressions }))} />
                    <ReportTable title="Top landing pages" label="Page" rows={searchReport.pages.slice(0, 10).map((row) => ({ label: row.page, clicks: row.clicks, impressions: row.impressions }))} />
                  </div>
                  <Button type="button" variant="outline" onClick={loadSearchReport}>Refresh Search Console report</Button>
                </>
              )}
            </>
          ) : (
            <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">Connect the Google account that has access to Tradibu’s Search Console property. Google OAuth credentials and the Search Console API must be configured in Supabase before connecting.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent feed runs</CardTitle><CardDescription>Feed generation history; see the most recent run above.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {runs.map((run) => (
            <div key={`${run.started_at}-${run.triggered_by}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <span>{new Date(run.started_at).toLocaleString()}</span>
              <span>{run.status}</span><span>{displayNumber(run.product_count)} products</span><span>{displayNumber(run.error_count)} issues</span>
            </div>
          ))}
          {!runs.length && !loading && <p className="text-sm text-muted-foreground">No feed runs have been recorded yet.</p>}
          {loading && <p className="text-sm text-muted-foreground">Loading feed history…</p>}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Google Search Console performance is separate from Merchant Center product diagnostics. Google account access is read-only.</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium">{label}{children}</label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 font-display text-xl font-semibold">{value}</p></div>;
}

function ReportTable({ title, label, rows }: { title: string; label: string; rows: Array<{ label: string; clicks: number; impressions: number }> }) {
  return (
    <div className="overflow-hidden rounded-md border">
      <h3 className="border-b p-3 text-sm font-semibold">{title}</h3>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-muted/80"><tr><th className="p-2 font-medium">{label}</th><th className="p-2 text-right font-medium">Clicks</th><th className="p-2 text-right font-medium">Impressions</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.label} className="border-t"><td className="max-w-[16rem] truncate p-2" title={row.label}>{row.label}</td><td className="p-2 text-right">{displayNumber(row.clicks)}</td><td className="p-2 text-right">{displayNumber(row.impressions)}</td></tr>)}
            {!rows.length && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">No data for this date range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
