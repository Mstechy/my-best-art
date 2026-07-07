import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface AdRow {
  id: string;
  title: string;
  image_url: string | null;
  target_url: string | null;
  placement: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: number;
  spent: number;
  seller_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ad?: AdRow | null;
  onSaved: () => void;
}

const PLACEMENTS = ["banner", "sidebar", "popup"];
const STATUSES = ["active", "paused", "ended"];

export default function AdFormDialog({ open, onOpenChange, ad, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [placement, setPlacement] = useState("banner");
  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("0");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ad) {
      setTitle(ad.title);
      setImageUrl(ad.image_url ?? "");
      setTargetUrl(ad.target_url ?? "");
      setPlacement(ad.placement);
      setStatus(ad.status);
      setStartDate(ad.start_date ?? "");
      setEndDate(ad.end_date ?? "");
      setBudget(String(ad.budget ?? 0));
    } else {
      setTitle(""); setImageUrl(""); setTargetUrl("");
      setPlacement("banner"); setStatus("active");
      setStartDate(""); setEndDate(""); setBudget("0");
    }
  }, [ad, open]);

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/ads/${Date.now()}-${file.name.replace(/[^a-z0-9.\-]/gi, "_")}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
    }
    setUploading(false);
  };


  const handleSave = async () => {
    if (!title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    if (targetUrl && !/^(https?:\/\/|\/)/i.test(targetUrl.trim())) {
      toast({ title: "Invalid URL", description: "Target URL must start with http(s):// or /", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      image_url: imageUrl || null,
      target_url: targetUrl.trim() || null,
      placement: placement as any,
      status: status as any,
      start_date: startDate || null,
      end_date: endDate || null,
      budget: Number(budget) || 0,
    };
    const res = ad
      ? await supabase.from("ads").update(payload).eq("id", ad.id)
      : await supabase.from("ads").insert({ ...payload, seller_id: user?.id ?? null });

    setSaving(false);
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: ad ? "Ad updated" : "Ad created" });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{ad ? "Edit Ad" : "Create Ad"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ad-title">Title</Label>
            <Input id="ad-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Summer Sale — 20% off" />
          </div>
          <div>
            <Label>Image</Label>
            <div className="flex items-center gap-3">
              {imageUrl && <img src={imageUrl} alt="" className="h-16 w-28 rounded-md object-cover border border-border" />}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                <span className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {imageUrl ? "Replace image" : "Upload image"}
                </span>
              </label>
            </div>
          </div>
          <div>
            <Label htmlFor="ad-target">Target URL</Label>
            <Input id="ad-target" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="/marketplace" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Placement</Label>
              <Select value={placement} onValueChange={setPlacement}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLACEMENTS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ad-start">Start date</Label>
              <Input id="ad-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ad-end">End date</Label>
              <Input id="ad-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="ad-budget">Budget (USD)</Label>
            <Input id="ad-budget" type="number" min="0" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {ad ? "Save changes" : "Create ad"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
