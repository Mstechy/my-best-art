import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Clock, ShieldCheck, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("admin" | "seller" | "buyer")[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login" replace />;

  if (profile?.is_banned || profile?.is_frozen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10">
            <ShieldCheck className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Account Access Restricted</h1>
          <p className="text-muted-foreground leading-relaxed">
            This account has been restricted by an administrator. Contact support if you believe this is a mistake.
          </p>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const dashboardMap = { admin: "/admin/dashboard", seller: "/seller/dashboard", buyer: "/buyer/dashboard" };
    return <Navigate to={dashboardMap[role] || "/"} replace />;
  }

  // Seller approval gate — unapproved sellers see a waiting page
  if (role === "seller" && profile && !profile.is_approved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
            <Clock className="h-10 w-10 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Account Under Review</h1>
          <p className="text-muted-foreground leading-relaxed">
            Your seller account is being reviewed by our admin team. You'll receive full access to your seller dashboard once your account is approved.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="rounded-xl border border-border p-4 text-center">
              <ShieldCheck className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Identity Verification</p>
            </div>
            <div className="rounded-xl border border-border p-4 text-center">
              <Store className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Store Setup Review</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">This usually takes 24-48 hours. Check back soon.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
