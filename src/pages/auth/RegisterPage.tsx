import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Eye, EyeOff, ArrowRight, ShoppingBag, Loader2,
  ShoppingCart, Store, Check,
} from "lucide-react";

type Role = "seller" | "buyer";

export default function RegisterPage() {
  const { user, role, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && role) {
      const dashboardMap: Record<string, string> = {
        admin: "/admin/dashboard",
        seller: "/seller/dashboard",
        buyer: "/buyer/dashboard",
      };
      navigate(dashboardMap[role] || "/marketplace", { replace: true });
    }
  }, [user, role, navigate]);

  const handleRoleSelect = (r: Role) => {
    setSelectedRole(r);
    // Slight delay so the selection animation is visible before form appears
    setTimeout(() => setShowForm(true), 180);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !fullName.trim()) return;
    if (!selectedRole) { toast.error("Please select an account type"); return; }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(email, password, fullName, selectedRole);
    setSubmitting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Account created! Please check your email to verify.");
      navigate("/auth/login");
    }
  };

  const roleOptions: { id: Role; label: string; sub: string; icon: typeof ShoppingCart }[] = [
    {
      id: "buyer",
      label: "I want to Buy",
      sub: "Discover & shop verified products",
      icon: ShoppingCart,
    },
    {
      id: "seller",
      label: "I want to Sell",
      sub: "List products & grow your business",
      icon: Store,
    },
  ];

  return (
    <div className="relative min-h-screen bg-[#FAFAFA] dark:bg-[#0E0E0E] flex items-center justify-center p-4 overflow-hidden">
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -right-32 h-[420px] w-[420px] rounded-full bg-[#F6C75D]/10 blur-[120px]" />
        <div className="absolute -bottom-24 -left-24 h-[340px] w-[340px] rounded-full bg-[#111111]/5 dark:bg-[#F6C75D]/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 mb-8 justify-center select-none">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111111] dark:bg-[#FAF5F2]">
            <ShoppingBag className="h-4.5 w-4.5 text-white dark:text-[#111111]" />
          </div>
          <span className="font-bold text-xl text-[#111111] dark:text-[#FAF5F2] tracking-tight">MarketHub</span>
        </Link>

        {/* Card */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl border border-[#E8E8E8] dark:border-[#222222] shadow-2xl shadow-black/5 dark:shadow-black/40 px-8 py-9">

          <h1 className="text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">
            Create your account.
          </h1>
          <p className="mt-1.5 text-xs text-[#888880] dark:text-[#A0A0A0]">
            Choose how you'd like to use MarketHub
          </p>

          {/* Role Selector */}
          <div className="mt-7 grid grid-cols-2 gap-3">
            {roleOptions.map((r) => {
              const isSelected = selectedRole === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleRoleSelect(r.id)}
                  className={`relative flex flex-col items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                    isSelected
                      ? "bg-[#111111] dark:bg-[#FAF5F2] border-[#111111] dark:border-[#FAF5F2]"
                      : "bg-[#FAFAFA] dark:bg-[#111111] border-[#E8E8E8] dark:border-[#2A2A2A] hover:border-[#C8C8C0] dark:hover:border-[#3A3A3A]"
                  }`}
                >
                  {/* Checkmark */}
                  {isSelected && (
                    <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-[#F6C75D] flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-[#5C3A00]" />
                    </span>
                  )}
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    isSelected ? "bg-white/15 dark:bg-[#111111]/20" : "bg-[#F2F3F5] dark:bg-[#1A1A1A]"
                  }`}>
                    <r.icon className={`h-4.5 w-4.5 ${isSelected ? "text-white dark:text-[#111111]" : "text-[#888880] dark:text-[#A0A0A0]"}`} />
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${isSelected ? "text-white dark:text-[#111111]" : "text-[#111111] dark:text-[#FAF5F2]"}`}>
                      {r.label}
                    </p>
                    <p className={`mt-0.5 text-[10px] leading-tight ${isSelected ? "text-white/70 dark:text-[#111111]/70" : "text-[#888880] dark:text-[#A0A0A0]"}`}>
                      {r.sub}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Form — slides in after role selected */}
          <div
            className={`overflow-hidden transition-all duration-500 ${
              showForm ? "max-h-[600px] opacity-100 mt-6" : "max-h-0 opacity-0 mt-0"
            }`}
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Active role badge */}
              {selectedRole && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F6C75D]/15 text-[10px] font-bold text-[#5C3A00] dark:text-[#F6C75D] uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#F6C75D] animate-pulse" />
                    {selectedRole === "buyer" ? "Buyer Account" : "Seller Account"}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSelectedRole(null); setShowForm(false); }}
                    className="text-[10px] text-[#888880] dark:text-[#A0A0A0] hover:underline"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-1.5">
                <label htmlFor="fullName" className="block text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  maxLength={100}
                  autoComplete="name"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-[#111111] dark:text-[#FAF5F2] text-sm placeholder-[#C0C0B8] dark:placeholder-[#555555] outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors duration-150"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  autoComplete="email"
                  className="w-full h-11 px-4 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-[#111111] dark:text-[#FAF5F2] text-sm placeholder-[#C0C0B8] dark:placeholder-[#555555] outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors duration-150"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full h-11 pl-4 pr-12 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-[#111111] dark:text-[#FAF5F2] text-sm placeholder-[#C0C0B8] dark:placeholder-[#555555] outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#888880] dark:text-[#555555] hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors p-0.5"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Password strength hint */}
                {password.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                          password.length >= i * 4
                            ? password.length >= 10 ? "bg-[#4CAF50]" : "bg-[#F6C75D]"
                            : "bg-[#E8E8E8] dark:bg-[#2A2A2A]"
                        }`}
                      />
                    ))}
                    <span className="text-[9px] text-[#888880] dark:text-[#555555] ml-1 w-12 shrink-0">
                      {password.length >= 10 ? "Strong" : password.length >= 6 ? "Medium" : "Weak"}
                    </span>
                  </div>
                )}
              </div>

              {/* CTA */}
              <button
                type="submit"
                disabled={submitting}
                className="mt-1 w-full h-11 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>
                ) : (
                  <>
                    Create {selectedRole === "buyer" ? "Buyer" : "Seller"} Account
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Divider + sign in link */}
          <div className="mt-7 flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E8E8E8] dark:bg-[#222222]" />
            <span className="text-[10px] text-[#888880] dark:text-[#555555] uppercase tracking-wider font-medium">or</span>
            <div className="flex-1 h-px bg-[#E8E8E8] dark:bg-[#222222]" />
          </div>

          <p className="mt-5 text-center text-xs text-[#888880] dark:text-[#A0A0A0]">
            Already have an account?{" "}
            <Link to="/auth/login" className="font-bold text-[#111111] dark:text-[#FAF5F2] hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-[10px] text-[#C0C0B8] dark:text-[#444444]">
          By creating an account you agree to our{" "}
          <Link to="/legal/terms" className="underline hover:text-[#888880]">Terms</Link>
          {" "}and{" "}
          <Link to="/legal/privacy" className="underline hover:text-[#888880]">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
