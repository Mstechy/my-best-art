import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Mail, ShoppingBag, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message || "Failed to send reset email");
      return;
    }

    setSent(true);
    toast.success("Password reset link sent to your email!");
  };

  return (
    <div className="relative min-h-screen bg-[#FAFAFA] dark:bg-[#0E0E0E] flex items-center justify-center p-4 overflow-hidden">
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[380px] w-[380px] rounded-full bg-[#F6C75D]/8 blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-[280px] w-[280px] rounded-full bg-[#111111]/4 dark:bg-[#F6C75D]/4 blur-[90px]" />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Back link */}
        <Link
          to="/auth/login"
          className="inline-flex items-center gap-1.5 mb-6 text-xs font-medium text-[#888880] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </Link>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 mb-8 justify-center select-none">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111111] dark:bg-[#FAF5F2]">
            <ShoppingBag className="h-4.5 w-4.5 text-white dark:text-[#111111]" />
          </div>
          <span className="font-bold text-xl text-[#111111] dark:text-[#FAF5F2] tracking-tight">MarketHub</span>
        </Link>

        {/* Card */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl border border-[#E8E8E8] dark:border-[#222222] shadow-2xl shadow-black/5 dark:shadow-black/40 px-8 py-9">

          {!sent ? (
            <>
              {/* Lock icon with pulse ring */}
              <div className="flex justify-center mb-7">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-[#F6C75D]/20 animate-ping" />
                  <div className="relative h-14 w-14 rounded-full bg-[#F6C75D]/15 dark:bg-[#F6C75D]/10 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-[#F6C75D]" />
                  </div>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight text-center">
                Forgot your password?
              </h1>
              <p className="mt-2 text-xs text-[#888880] dark:text-[#A0A0A0] text-center leading-relaxed">
                Enter your email address and we'll send you a secure reset link.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">
                    Email address
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

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 w-full h-11 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                  ) : (
                    <><Mail className="h-3.5 w-3.5" /> Send Reset Link</>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Success state */
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full bg-[#4CAF50]/10 dark:bg-[#4CAF50]/15 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-[#4CAF50]" />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">
                  Check your inbox
                </h2>
                <p className="mt-2 text-xs text-[#888880] dark:text-[#A0A0A0] leading-relaxed px-2">
                  We sent a reset link to{" "}
                  <span className="font-semibold text-[#111111] dark:text-[#FAF5F2]">{email}</span>.
                  The link expires in 24 hours.
                </p>
              </div>

              <div className="bg-[#FAFAFA] dark:bg-[#111111] rounded-2xl p-4 text-left space-y-2.5 border border-[#E8E8E8] dark:border-[#222222]">
                {[
                  "Open the email from MarketHub",
                  "Click the secure reset link",
                  "Choose a new password",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="flex-shrink-0 h-5 w-5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-[9px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-xs text-[#888880] dark:text-[#A0A0A0]">{step}</span>
                  </div>
                ))}
              </div>

              <Link
                to="/auth/login"
                className="mt-2 w-full h-11 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors duration-200"
              >
                Back to sign in
              </Link>

              <button
                type="button"
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-[10px] text-[#888880] dark:text-[#555555] hover:text-[#111111] dark:hover:text-[#FAF5F2] hover:underline transition-colors mt-1"
              >
                Didn't receive it? Try a different email
              </button>
            </div>
          )}

          {!sent && (
            <>
              <div className="mt-7 flex items-center gap-3">
                <div className="flex-1 h-px bg-[#E8E8E8] dark:bg-[#222222]" />
                <span className="text-[10px] text-[#888880] dark:text-[#555555] uppercase tracking-wider font-medium">or</span>
                <div className="flex-1 h-px bg-[#E8E8E8] dark:bg-[#222222]" />
              </div>
              <p className="mt-5 text-center text-xs text-[#888880] dark:text-[#A0A0A0]">
                Remember your password?{" "}
                <Link to="/auth/login" className="font-bold text-[#111111] dark:text-[#FAF5F2] hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-[10px] text-[#C0C0B8] dark:text-[#444444]">
          Need help?{" "}
          <a href="mailto:support@markethub.com" className="underline hover:text-[#888880]">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
