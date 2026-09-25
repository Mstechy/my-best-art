import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Save, Store as StoreIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function SellerStore() {
  const { user } = useAuth();
  const [bannerUrl, setBannerUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bio, setBio] = useState("");
  const [returnPolicy, setReturnPolicy] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState("");
  const [paymentPolicy, setPaymentPolicy] = useState("");
  const [shipFromLocation, setShipFromLocation] = useState("");
  const [deliveryDaysMin, setDeliveryDaysMin] = useState("");
  const [deliveryDaysMax, setDeliveryDaysMax] = useState("");
  const [returnWindowDays, setReturnWindowDays] = useState("");
  const [returnAccepted, setReturnAccepted] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("seller_stores" as any)
        .select("*")
        .eq("seller_id", user.id)
        .maybeSingle();
      if (data) {
        const d = data as any;
        setBannerUrl(d.banner_url || "");
        setLogoUrl(d.logo_url || "");
        setBio(d.bio || "");
        setReturnPolicy(d.return_policy || "");
        setShippingPolicy(d.shipping_policy || "");
        setPaymentPolicy(d.payment_policy || "");
        setShipFromLocation(d.ship_from_location || "");
        setDeliveryDaysMin(d.delivery_days_min?.toString() || "");
        setDeliveryDaysMax(d.delivery_days_max?.toString() || "");
        setReturnWindowDays(d.return_window_days?.toString() || "");
        setReturnAccepted(d.return_accepted === true ? "yes" : d.return_accepted === false ? "no" : "");
        setWarrantyTerms(d.warranty_terms || "");
      }
      setLoading(false);
    })();
  }, [user]);

  const upload = async (file: File, setter: (v: string) => void) => {
    if (!user) return;
    const path = `stores/${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    setter(pub.publicUrl);
  };

  const save = async () => {
    if (!user) return;
    if (bio.length > 300) { toast.error("Bio must be 300 characters or less"); return; }
    setSaving(true);
    const { error } = await supabase.from("seller_stores" as any).upsert({
      seller_id: user.id,
      banner_url: bannerUrl || null,
      logo_url: logoUrl || null,
      bio: bio || null,
      return_policy: returnPolicy || null,
      shipping_policy: shippingPolicy || null,
      payment_policy: paymentPolicy || null,
      ship_from_location: shipFromLocation.trim() || null,
      delivery_days_min: deliveryDaysMin ? Number(deliveryDaysMin) : null,
      delivery_days_max: deliveryDaysMax ? Number(deliveryDaysMax) : null,
      return_window_days: returnWindowDays ? Number(returnWindowDays) : null,
      return_accepted: returnAccepted === "yes" ? true : returnAccepted === "no" ? false : null,
      warranty_terms: warrantyTerms.trim() || null,
    } as any);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Store profile saved");
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Store Profile</h1>
          <p className="mt-1 text-muted-foreground">How buyers see your storefront</p>
        </div>
        {user && (
          <Link to={`/seller/${user.id}`}>
            <Button variant="outline" className="gap-2"><Eye className="h-4 w-4" /> Preview Store</Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display">Branding</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Store Banner</Label>
            {bannerUrl && <img src={bannerUrl} alt="Banner" loading="lazy" decoding="async" className="mt-2 h-32 w-full rounded-lg object-cover" />}
            <Input type="file" accept="image/*" className="mt-2" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], setBannerUrl)} />
          </div>
          <div>
            <Label>Store Logo</Label>
            {logoUrl && <img src={logoUrl} alt="Logo" loading="lazy" decoding="async" className="mt-2 h-16 w-16 rounded-full object-cover" />}
            <Input type="file" accept="image/*" className="mt-2" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], setLogoUrl)} />
          </div>
          <div>
            <Label>Bio (max 300)</Label>
            <Textarea maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
            <p className="mt-1 text-xs text-muted-foreground">{bio.length}/300</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display">Marketplace policies</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Shipping, delivery estimates, returns, refunds, buyer protection, and payment terms are set by the Tradibu admin and appear automatically on your product pages.</p>
          <p className="mt-2 text-xs text-muted-foreground">You only need to keep your product-specific information accurate, such as condition, warranty duration, stock, and shipping availability.</p>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="gap-2 gradient-seller text-primary-foreground shadow-glow-seller">
        <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Profile"}
      </Button>
    </div>
  );
}
