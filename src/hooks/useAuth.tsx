import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "seller" | "buyer";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  
  is_banned: boolean;
  is_frozen: boolean;
  is_approved: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const rolePriority: AppRole[] = ["admin", "seller", "buyer"];

function pickPrimaryRole(rows: { role: string }[] | null | undefined): AppRole | null {
  const roles = rows?.map(row => row.role as AppRole) ?? [];
  return rolePriority.find(candidate => roles.includes(candidate)) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      let [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      // Role/profile provisioning: never block UI if this fails.
      // Also: if your project already has user_roles (e.g. you manually added 'admin'),
      // we should not keep retrying an RPC that may fail with 400.
      if ((!profileRes.data || !rolesRes.data || rolesRes.data.length === 0) && !role) {
        try {
          await supabase.rpc("ensure_user_profile" as never);
          [profileRes, rolesRes] = await Promise.all([
            supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", userId),
          ]);
        } catch (e) {
          console.error("ensure_user_profile failed:", e);
        }
      }

      setProfile((profileRes.data as Profile) ?? null);

      // Role resolution: prefer admin over everything.
      // If role rows are missing/empty due to RLS or partial reads, do NOT default to buyer.
      // Keep role=null so ProtectedRoute/RoleRedirect won't incorrectly send admins to buyer.
      const resolved = pickPrimaryRole(rolesRes.data);
      setRole(resolved ?? null);
    } catch (e) {
      console.error("Error fetching user data:", e);
      setProfile(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setLoading(true);
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setProfile(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(async () => {
      await supabase.auth.signOut({ scope: "local" });
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, selectedRole: AppRole) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: selectedRole },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) return { error: error.message };

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const refetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    await fetchUserData(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, role, loading, signUp, signIn, signOut, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
