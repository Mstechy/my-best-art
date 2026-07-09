import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { User, MapPin, Lock, Plus, Trash2, Loader2 } from "lucide-react";
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

function SectionCard({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222]">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4 border-b border-[#F2F3F5] dark:border-[#222222]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F2F3F5] dark:bg-[#111111]">
          <Icon className="h-3.5 w-3.5 text-[#888880] dark:text-[#A0A0A0]" />
        </div>
        <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">{label}</label>
      <input
        {...props}
        className={`w-full h-10 px-3.5 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-[#111111] dark:text-[#FAF5F2] text-xs placeholder-[#C0C0B8] dark:placeholder-[#555555] outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${props.className ?? ""}`}
      />
    </div>
  );
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
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

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
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, country, avatar_url: avatarUrl || null } as any).eq("user_id", user.id);
    setSavingProfile(false);
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
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) toast.error(error.message); else { toast.success("Password changed"); setPassword(""); }
  };

  const addAddress = async () => {
    if (!user) return;
    if (!newAddr.recipient || !newAddr.line1 || !newAddr.city) { toast.error("Recipient, line 1 and city are required"); return; }
    if (newAddr.is_default) await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    const { error } = await supabase.from("addresses").insert({ user_id: user.id, ...newAddr } as any);
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

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">Profile & Settings</h1>
        <p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0]">Manage your account details and preferences</p>
      </div>

      {/* Account */}
      <SectionCard icon={User} title="Account">
        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[#111111] dark:bg-[#FAF5F2] flex items-center justify-center overflow-hidden shrink-0">
              {avatarUrl
                ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                : <span className="text-sm font-bold text-white dark:text-[#111111]">{getInitials(fullName || profile?.full_name || "U")}</span>
              }
            </div>
            <div>
              <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2]">Profile photo</p>
              <label className="mt-1 cursor-pointer inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#888880] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors">
                Change photo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              </label>
            </div>
          </div>

          <FieldInput label="Display Name" value={fullName} onChange={(e) => setFullName((e.target as HTMLInputElement).value)} placeholder="Your full name" />
          <FieldInput label="Email" value={profile?.email || ""} disabled />

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">Country</label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="h-10 rounded-xl border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-xs">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <button onClick={saveProfile} disabled={savingProfile}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-semibold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors disabled:opacity-50">
            {savingProfile ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</> : "Save Profile"}
          </button>
        </div>
      </SectionCard>

      {/* Password */}
      <SectionCard icon={Lock} title="Change Password">
        <div className="space-y-3">
          <FieldInput label="New Password" type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword((e.target as HTMLInputElement).value)} />
          <button onClick={changePassword} disabled={savingPassword}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#111111] transition-colors disabled:opacity-50">
            {savingPassword ? <><Loader2 className="h-3 w-3 animate-spin" /> Updating…</> : "Update Password"}
          </button>
        </div>
      </SectionCard>

      {/* Address Book */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222]">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#F2F3F5] dark:border-[#222222]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F2F3F5] dark:bg-[#111111]">
              <MapPin className="h-3.5 w-3.5 text-[#888880] dark:text-[#A0A0A0]" />
            </div>
            <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">Address Book</p>
          </div>
          <button onClick={() => setShowAddrForm(s => !s)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-[10px] font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>

        <div className="p-5 space-y-3">
          {showAddrForm && (
            <div className="rounded-xl border border-[#E8E8E8] dark:border-[#222222] p-4 bg-[#FAFAFA] dark:bg-[#111111] space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">New Address</p>
              {[
                { label: "Label (Home, Office…)", key: "label", placeholder: "e.g. Home" },
                { label: "Recipient *", key: "recipient", placeholder: "Full name" },
                { label: "Address line 1 *", key: "line1", placeholder: "Street address" },
                { label: "Address line 2", key: "line2", placeholder: "Apt, suite, etc." },
              ].map(({ label, key, placeholder }) => (
                <FieldInput key={key} label={label} placeholder={placeholder}
                  value={(newAddr as any)[key] || ""}
                  onChange={(e) => setNewAddr({ ...newAddr, [key]: (e.target as HTMLInputElement).value })} />
              ))}
              <div className="grid grid-cols-2 gap-2">
                <FieldInput label="City *" placeholder="City" value={newAddr.city || ""} onChange={(e) => setNewAddr({ ...newAddr, city: (e.target as HTMLInputElement).value })} />
                <FieldInput label="Region" placeholder="State/Province" value={newAddr.region || ""} onChange={(e) => setNewAddr({ ...newAddr, region: (e.target as HTMLInputElement).value })} />
                <FieldInput label="Postal Code" placeholder="ZIP / Postal" value={newAddr.postal_code || ""} onChange={(e) => setNewAddr({ ...newAddr, postal_code: (e.target as HTMLInputElement).value })} />
                <FieldInput label="Country" placeholder="US" value={newAddr.country || ""} onChange={(e) => setNewAddr({ ...newAddr, country: (e.target as HTMLInputElement).value.toUpperCase() })} maxLength={2} />
              </div>
              <FieldInput label="Phone" placeholder="+1 555 000 0000" value={newAddr.phone || ""} onChange={(e) => setNewAddr({ ...newAddr, phone: (e.target as HTMLInputElement).value })} />
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={!!newAddr.is_default} onCheckedChange={(v) => setNewAddr({ ...newAddr, is_default: !!v })} />
                <span className="text-[#888880] dark:text-[#A0A0A0]">Set as default</span>
              </label>
              <button onClick={addAddress}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-[10px] font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
                Save Address
              </button>
            </div>
          )}

          {addresses.length === 0 && !showAddrForm ? (
            <div className="py-10 text-center">
              <div className="h-10 w-10 rounded-xl bg-[#F2F3F5] dark:bg-[#111111] flex items-center justify-center mx-auto mb-2">
                <MapPin className="h-4.5 w-4.5 text-[#888880] dark:text-[#A0A0A0]" />
              </div>
              <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2]">No addresses yet</p>
              <p className="mt-1 text-[10px] text-[#888880] dark:text-[#A0A0A0]">Save an address for faster checkout</p>
            </div>
          ) : (
            addresses.map(a => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#F2F3F5] dark:border-[#1E1E1E] bg-[#FAFAFA] dark:bg-[#111111] p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">{a.label || a.recipient}</span>
                    {a.is_default && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#F6C75D]/15 text-[9px] font-bold text-[#5C3A00] dark:text-[#F6C75D] uppercase tracking-wider">Default</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0]">{a.recipient}</p>
                  <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0]">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
                  <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0]">{a.city}{a.region ? `, ${a.region}` : ""} {a.postal_code} · {a.country}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {!a.is_default && (
                    <button onClick={() => setDefault(a.id)}
                      className="text-[10px] font-semibold text-[#888880] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors">
                      Set default
                    </button>
                  )}
                  <button onClick={() => removeAddress(a.id)} className="text-red-400 hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
