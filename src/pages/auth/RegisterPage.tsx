import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, ShoppingBag, Store, ShoppingCart, ArrowRight, Shield, Zap, BarChart3, Truck, Quote } from "lucide-react";
import GradientOrb from "@/components/GradientOrb";

type Role = "seller" | "buyer";

const sellerPerks = [
  { icon: BarChart3, text: "Real-time sales analytics" },
  { icon: Zap, text: "AI-powered pricing tools" },
  { icon: Shield, text: "Secure wallet & payouts" },
];
const buyerPerks = [
  { icon: Shield, text: "Escrow payment protection" },
  { icon: Truck, text: "Real-time order tracking" },
  { icon: Zap, text: "AI-powered recommendations" },
];

export default function RegisterPage() {
  const { user, role, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("buyer");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !fullName.trim()) return;
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

  const roles = [
    { id: "buyer" as Role, label: "Buyer", desc: "Shop & discover", icon: ShoppingCart, gradient: "gradient-buyer", border: "border-buyer/40" },
    { id: "seller" as Role, label: "Seller", desc: "List & sell", icon: Store, gradient: "gradient-seller", border: "border-seller/40" },
  ];

  const perks = selectedRole === "seller" ? sellerPerks : buyerPerks;
  const panelGradient = selectedRole === "seller" ? "gradient-seller" : "gradient-buyer";

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

          <h1 className="font-display text-3xl font-bold text-foreground">Create your account</h1>
          <p className="mt-2 text-muted-foreground">Choose how you want to use MarketHub</p>

          {/* Role selector */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRole(r.id)}
                className={`group relative flex flex-col items-center gap-2.5 rounded-2xl border-2 p-5 transition-all duration-300 ${
                  selectedRole === r.id
                    ? `${r.border} bg-primary/5 scale-[1.02] shadow-md`
                    : "border-border hover:border-primary/30 hover:bg-muted/50"
                }`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${r.gradient} transition-transform group-hover:scale-110`}>
                  <r.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="font-display text-sm font-semibold text-foreground">{r.label}</span>
                <span className="text-xs text-muted-foreground">{r.desc}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
              <Input id="fullName" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-12 pr-12" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 gap-2 text-base" disabled={submitting}>
              {submitting ? "Creating account..." : <>Sign Up as {selectedRole === "buyer" ? "Buyer" : "Seller"} <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth/login" className="text-primary font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>

      {/* Right: Dynamic gradient panel */}
      <div className={`hidden lg:flex lg:flex-1 relative ${panelGradient} overflow-hidden items-center justify-center transition-all duration-700`}>
        <GradientOrb color="primary" size="lg" className="top-10 -right-20 opacity-15" />
        <GradientOrb color="accent" size="md" className="bottom-20 -left-10 opacity-10" />

        <div className="relative z-10 max-w-md px-12 text-primary-foreground">
          <h2 className="font-display text-3xl font-bold mb-2">
            {selectedRole === "seller" ? "Start Selling Today" : "Shop with Confidence"}
          </h2>
          <p className="text-sm opacity-80 mb-8">
            {selectedRole === "seller"
              ? "Join 10,000+ sellers building successful businesses on MarketHub."
              : "Browse verified sellers and shop with escrow protection on every order."}
          </p>

          <div className="space-y-4 mb-10">
            {perks.map((perk) => (
              <div key={perk.text} className="flex items-center gap-4 glass-strong rounded-xl p-4 bg-background/10 border-background/20 animate-fade-in">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/20 shrink-0">
                  <perk.icon className="h-5 w-5" />
                </div>
                <span className="font-medium">{perk.text}</span>
              </div>
            ))}
          </div>

          <div className="glass-strong rounded-2xl p-6 bg-background/10 border-background/20">
            <Quote className="h-6 w-6 opacity-40 mb-3" />
            <p className="text-sm leading-relaxed opacity-90">
              {selectedRole === "seller"
                ? '"The AI tools helped me price my products competitively. My sales tripled in the first month."'
                : '"Finally a marketplace where I feel safe shopping. Escrow protection gives me total peace of mind."'}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-background/20 flex items-center justify-center text-xs font-bold">
                {selectedRole === "seller" ? "MS" : "JO"}
              </div>
              <div>
                <p className="text-sm font-semibold">{selectedRole === "seller" ? "Maria Silva" : "James Okafor"}</p>
                <p className="text-xs opacity-70">{selectedRole === "seller" ? "Top Seller" : "Verified Buyer"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
