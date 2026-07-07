import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function RoleRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login" replace />;

  switch (role) {
    case "admin": return <Navigate to="/admin/dashboard" replace />;
    case "seller": return <Navigate to="/seller/dashboard" replace />;
    case "buyer": return <Navigate to="/buyer/dashboard" replace />;
    default: return <Navigate to="/marketplace" replace />;
  }
}
