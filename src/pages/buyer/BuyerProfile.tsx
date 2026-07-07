import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, MapPin, Lock, Plus, Trash2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { COUNTRIES } from "@/lib/countries";


interface Address {
  id: string;
  label: string | null;
  recipient: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  is_default: boolean;
}

export default function BuyerProfile() {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("US");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [password, setPassword] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [newAddr, setNewAddr] = useState<Partial<Address>>({ country: "US", is_default: false });

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || "");
    setCountry((profile as any).country || "US");
    setAvatarUrl((profile as any).avatar_url || "");
  }, [profile]);

  const loadAddresses = async () => {
    if (!user) return;
    const { data } = await supabase.from("addresses").select("*").eq("user_id", user.id).order("is_default", { ascending: false });
    if (data) setAddresses(data as Address[]);
  };

  useEffect(() => { loadAddresses(); }, [user?.id]);

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      full_name: fullName,
      country,
      avatar_url: avatarUrl || null,
    } as any).eq("user_id", user.id);
    if (error) toast.error(error.message); else toast.success("Profile updated");
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    const path = `avatars/${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    setAvatarUrl(pub.publicUrl);
  };

  const changePassword = async () => {
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast.error(error.message); else { toast.success("Password changed"); setPassword(""); }
  };

  const addAddress = async () => {
    if (!user) return;
    if (!newAddr.recipient || !newAddr.line1 || !newAddr.city) {
      toast.error("Recipient, line 1 and city are required");
      return;
    }
    if (newAddr.is_default) {
      await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    }
    const { error } = await supabase.from("addresses").insert({
      user_id: user.id,
      ...newAddr,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Address added");
    setShowAddrForm(false);
    setNewAddr({ country: "US", is_default: false });
    loadAddresses();
  };

  const removeAddress = async (id: string) => {
    await supabase.from("addresses").delete().eq("id", id);
    loadAddresses();
  };

  const setDefault = async (id: string) => {
    if (!user) return;
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    loadAddresses();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Profile & Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your account</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><User className="h-5 w-5" /> Account</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted overflow-hidden flex items-center justify-center">
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" /> : <User className="h-6 w-6 text-muted-foreground" />}
            </div>
            <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
          </div>
          <div><Label>Display Name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>Email</Label><Input value={profile?.email || ""} disabled /></div>
          <div>
            <Label>Country</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={saveProfile} className="gradient-buyer text-primary-foreground">Save Profile</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><Lock className="h-5 w-5" /> Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="password" placeholder="New password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button onClick={changePassword} variant="outline">Update Password</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display flex items-center gap-2"><MapPin className="h-5 w-5" /> Address Book</CardTitle>
          <Button size="sm" onClick={() => setShowAddrForm((s) => !s)} className="gap-1"><Plus className="h-3 w-3" /> Add</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showAddrForm && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Input placeholder="Label (Home, Office…)" value={newAddr.label || ""} onChange={(e) => setNewAddr({ ...newAddr, label: e.target.value })} />
              <Input placeholder="Recipient *" value={newAddr.recipient || ""} onChange={(e) => setNewAddr({ ...newAddr, recipient: e.target.value })} />
              <Input placeholder="Address line 1 *" value={newAddr.line1 || ""} onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })} />
              <Input placeholder="Address line 2" value={newAddr.line2 || ""} onChange={(e) => setNewAddr({ ...newAddr, line2: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="City *" value={newAddr.city || ""} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} />
                <Input placeholder="Region" value={newAddr.region || ""} onChange={(e) => setNewAddr({ ...newAddr, region: e.target.value })} />
                <Input placeholder="Postal code" value={newAddr.postal_code || ""} onChange={(e) => setNewAddr({ ...newAddr, postal_code: e.target.value })} />
                <Input placeholder="Country" value={newAddr.country || ""} onChange={(e) => setNewAddr({ ...newAddr, country: e.target.value.toUpperCase() })} maxLength={2} />
              </div>
              <Input placeholder="Phone" value={newAddr.phone || ""} onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!newAddr.is_default} onCheckedChange={(v) => setNewAddr({ ...newAddr, is_default: !!v })} />
                Set as default
              </label>
              <Button size="sm" onClick={addAddress} className="gradient-buyer text-primary-foreground">Save Address</Button>
            </div>
          )}
          {addresses.length === 0 ? (
            <EmptyState icon={MapPin} title="No addresses yet" description="Save an address for faster checkout" role="buyer" />
          ) : (
            addresses.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{a.label || a.recipient}</span>
                    {a.is_default && <span className="text-[10px] uppercase font-bold text-buyer">Default</span>}
                  </div>
                  <p className="text-muted-foreground">{a.recipient}</p>
                  <p className="text-muted-foreground">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
                  <p className="text-muted-foreground">{a.city}{a.region ? `, ${a.region}` : ""} {a.postal_code} · {a.country}</p>
                </div>
                <div className="flex flex-col gap-1">
                  {!a.is_default && <Button size="sm" variant="ghost" onClick={() => setDefault(a.id)} className="text-xs">Set default</Button>}
                  <Button size="sm" variant="ghost" onClick={() => removeAddress(a.id)} className="text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
