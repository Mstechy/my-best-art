import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, ShoppingBag, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import GradientOrb from "@/components/GradientOrb";

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
    <div className="flex min-h-screen">
      {/* Left: Form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md animate-slide-up">
          <Link to="/auth/login" className="inline-flex items-center gap-2 mb-12 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to login</span>
          </Link>

          <h1 className="font-display text-3xl font-bold text-foreground">Reset password</h1>
          <p className="mt-2 text-muted-foreground">Enter your email and we'll send you a reset link</p>

          {!sent ? (
            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 gap-2 text-base" 
                disabled={submitting}
              >
                {submitting ? "Sending..." : <>Send Reset Link <Mail className="h-4 w-4" /></>}
              </Button>
            </form>
          ) : (
            <div className="mt-10 p-6 rounded-lg bg-accent/10 border border-accent/30">
              <div className="flex gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20">
                  <Mail className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Check your email</p>
                  <p className="text-sm text-muted-foreground">We sent a reset link to {email}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Click the link in the email to reset your password. The link expires in 24 hours.
              </p>
              <Button 
                asChild 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Link to="/auth/login">Back to login</Link>
              </Button>
            </div>
          )}

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link to="/auth/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right: Gradient panel */}
      <div className="hidden lg:flex lg:flex-1 relative gradient-buyer overflow-hidden items-center justify-center">
        <GradientOrb color="seller" size="lg" className="top-10 -right-20 opacity-20" />
        <GradientOrb color="admin" size="md" className="bottom-20 -left-10 opacity-15" />

        <div className="relative z-10 max-w-md px-12 text-primary-foreground text-center">
          <div className="mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-background/20 mx-auto mb-4">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-2">Account Security</h2>
            <p className="text-sm opacity-80">We take your account security seriously. If you lose access to your password, we can help you regain it safely.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
