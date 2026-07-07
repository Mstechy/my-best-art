import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, ShoppingBag, ArrowRight, Shield, TrendingUp, Users, Quote } from "lucide-react";
import GradientOrb from "@/components/GradientOrb";

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
      // Navigation handled by useEffect when user/role state updates
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left: Form */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md animate-slide-up">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <ShoppingBag className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold text-foreground">MarketHub</span>
          </Link>

          <h1 className="font-display text-3xl font-bold text-foreground">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
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
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 gap-2 text-base" disabled={submitting}>
              {submitting ? "Signing in..." : <>Sign In <ArrowRight className="h-4 w-4" /></>}
            </Button>
            <Link to="/auth/forgot-password" className="block text-center text-sm text-primary hover:underline font-medium">
              Forgot password?
            </Link>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/auth/register" className="text-primary font-semibold hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Right: Gradient panel */}
      <div className="hidden lg:flex lg:flex-1 relative gradient-primary overflow-hidden items-center justify-center">
        <GradientOrb color="accent" size="lg" className="top-10 -right-20 opacity-20" />
        <GradientOrb color="seller" size="md" className="bottom-20 -left-10 opacity-15" />

        <div className="relative z-10 max-w-md px-12 text-primary-foreground">
          <div className="space-y-4 mb-10">
            <div className="glass-strong rounded-2xl p-4 bg-background/10 border-background/20 animate-float">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/20">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium opacity-80">Revenue Growth</p>
                  <p className="font-display text-xl font-bold">+247%</p>
                </div>
              </div>
            </div>
            <div className="glass-strong rounded-2xl p-4 bg-background/10 border-background/20 animate-float-slow ml-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/20">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium opacity-80">Active Sellers</p>
                  <p className="font-display text-xl font-bold">10,000+</p>
                </div>
              </div>
            </div>
            <div className="glass-strong rounded-2xl p-4 bg-background/10 border-background/20 animate-float ml-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/20">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium opacity-80">Secure Escrow</p>
                  <p className="font-display text-xl font-bold">$1M+ Protected</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-strong rounded-2xl p-6 bg-background/10 border-background/20">
            <Quote className="h-6 w-6 opacity-40 mb-3" />
            <p className="text-sm leading-relaxed opacity-90">
              "MarketHub transformed my side hustle into a full-time business. The analytics and escrow system are game-changers."
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-background/20 flex items-center justify-center text-xs font-bold">SC</div>
              <div>
                <p className="text-sm font-semibold">Sarah Chen</p>
                <p className="text-xs opacity-70">Top Seller</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
