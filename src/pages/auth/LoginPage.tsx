import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowRight, ShoppingBag, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { user, role, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && role) {
      if (redirectTo && redirectTo.startsWith("/")) {
        navigate(redirectTo, { replace: true });
        return;
      }
      const dashboardMap: Record<string, string> = {
        admin: "/admin/dashboard",
        seller: "/seller/dashboard",
        buyer: "/buyer/dashboard",
      };
      navigate(dashboardMap[role] || "/marketplace", { replace: true });
    }
  }, [user, role, navigate, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Welcome back!");
    }
  };

  return (
    <div className="relative min-h-screen bg-[#FAFAFA] dark:bg-[#0E0E0E] flex items-center justify-center p-4 overflow-hidden">
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-[#F6C75D]/10 blur-[120px]" />
        <div className="absolute -bottom-24 -right-24 h-[340px] w-[340px] rounded-full bg-[#111111]/5 dark:bg-[#F6C75D]/5 blur-[100px]" />
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
            Welcome back.
          </h1>
          <p className="mt-1.5 text-xs text-[#888880] dark:text-[#A0A0A0]">
            Sign in to your account to continue
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
                autoComplete="email"
                className="w-full h-11 px-4 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-[#111111] dark:text-[#FAF5F2] text-sm placeholder-[#C0C0B8] dark:placeholder-[#555555] outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors duration-150"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">
                  Password
                </label>
                <Link
                  to="/auth/forgot-password"
                  className="text-[10px] font-semibold text-[#888880] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
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
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full h-11 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
              ) : (
                <>Sign in <ArrowRight className="h-3.5 w-3.5" /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-7 flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E8E8E8] dark:bg-[#222222]" />
            <span className="text-[10px] text-[#888880] dark:text-[#555555] uppercase tracking-wider font-medium">or</span>
            <div className="flex-1 h-px bg-[#E8E8E8] dark:bg-[#222222]" />
          </div>

          <p className="mt-5 text-center text-xs text-[#888880] dark:text-[#A0A0A0]">
            Don't have an account?{" "}
            <Link
              to="/auth/register"
              className="font-bold text-[#111111] dark:text-[#FAF5F2] hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-[10px] text-[#C0C0B8] dark:text-[#444444]">
          By signing in you agree to our{" "}
          <Link to="/legal/terms" className="underline hover:text-[#888880]">Terms</Link>
          {" "}and{" "}
          <Link to="/legal/privacy" className="underline hover:text-[#888880]">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
