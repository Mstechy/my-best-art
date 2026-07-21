import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Search, Store, CheckCircle2, Snowflake, Ban, ShieldCheck, ShieldOff, UserCheck, UserX, Crown, ShoppingBag } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserFacingErrorMessage, logError } from "@/lib/errorHandler";

type AppRole = "admin" | "seller" | "buyer";

interface UserAccount {
  user_id: string;
  full_name: string | null;
  email: string;
  is_verified: boolean;
  is_banned: boolean;
  is_frozen: boolean;
  is_approved: boolean;
  created_at: string;
  roles: AppRole[];
  primary_role: AppRole | null;
  seller_capable: boolean;
  product_count: number;
  order_count: number;
}

type Tab = "all" | "sellers" | "buyers" | "admins" | "pending" | "frozen" | "banned";

export default function AdminSellers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  const fetchUsers = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.rpc("admin_user_directory");
      if (error) throw error;

      setUsers((data || []).map((u: Partial<UserAccount> & { roles?: AppRole[]; seller_capable?: unknown; product_count?: unknown; order_count?: unknown }) => ({
        user_id: String(u.user_id ?? ""),
        full_name: (u.full_name ?? null) as string | null,
        email: String(u.email ?? ""),
        is_verified: Boolean((u as unknown as { is_verified?: unknown }).is_verified),
        is_banned: Boolean((u as unknown as { is_banned?: unknown }).is_banned),
        is_frozen: Boolean((u as unknown as { is_frozen?: unknown }).is_frozen),
        is_approved: Boolean((u as unknown as { is_approved?: unknown }).is_approved),
        created_at: String(u.created_at ?? ""),
        roles: (u.roles ?? []) as AppRole[],
        primary_role: (u.primary_role ?? null) as AppRole | null,
        seller_capable: Boolean(u.seller_capable),
        product_count: Number(u.product_count) || 0,
        order_count: Number(u.order_count) || 0,
      })));
    } catch (e) {
      logError(e, "admin_user_directory");
      const msg = getUserFacingErrorMessage(e, "load");
      setLoadError(msg);
      toast({ title: "Could not load users", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const updateAccount = async (userId: string, update: Partial<{ is_verified: boolean; is_frozen: boolean; is_banned: boolean; is_approved: boolean }>, title: string) => {
    // Prefer v2 RPC so the same DB fields/keys that SellerDashboard polls are updated.
    const rpcName = "admin_set_account_status_v2";

    const { error } = await supabase.rpc(rpcName, {
      _user_id: userId,
      _is_verified: update.is_verified ?? null,
      _is_approved: update.is_approved ?? null,
      _is_banned: update.is_banned ?? null,
      _is_frozen: update.is_frozen ?? null,
    });

    if (error) {
      logError(error, "admin_set_account_status");
      toast({
        title: "Error",
        description: getUserFacingErrorMessage(error, "save"),
        variant: "destructive",
      });
      return;
    }
    toast({ title });
    await fetchUsers();
  };

  const updateSellerAccess = async (user: UserAccount, grant: boolean) => {
    const rpcName = grant ? "admin_grant_seller" : "admin_revoke_seller";
    const userId = user.user_id;

    if (!userId) return;

    // Use a clear object structure for the RPC call
    const { error } = await supabase.rpc(rpcName, { _user_id: userId });

    if (error) {
      logError(error, "admin_seller_access");
      toast({
        title: "Action Failed",
        description: getUserFacingErrorMessage(error, "save"),
        variant: "destructive",
      });
      return;
    }

    toast({ title: grant ? "Seller access granted" : "Seller access revoked" });
    await fetchUsers(); // Refresh the list
  };

  const filtered = users.filter(user => {
    const query = search.toLowerCase();
    const matchesSearch = !query || user.full_name?.toLowerCase().includes(query) || user.email.toLowerCase().includes(query) || user.user_id.toLowerCase().includes(query);
    const matchesTab =
      tab === "all" ||
      (tab === "sellers" && user.seller_capable) ||
      (tab === "buyers" && user.roles.includes("buyer") && !user.seller_capable) ||
      (tab === "admins" && user.roles.includes("admin")) ||
      (tab === "pending" && user.roles.includes("seller") && !user.is_approved && !user.is_banned) ||
      (tab === "frozen" && user.is_frozen) ||
      (tab === "banned" && user.is_banned);
    return matchesSearch && matchesTab;
  });

  const tabs: { label: string; value: Tab; count: number }[] = [
    { label: "All Users", value: "all", count: users.length },
    { label: "Sellers", value: "sellers", count: users.filter(u => u.seller_capable).length },
    { label: "Buyers", value: "buyers", count: users.filter(u => u.roles.includes("buyer") && !u.seller_capable).length },
    { label: "Admins", value: "admins", count: users.filter(u => u.roles.includes("admin")).length },
    { label: "Pending Sellers", value: "pending", count: users.filter(u => u.roles.includes("seller") && !u.is_approved && !u.is_banned).length },
    { label: "Frozen", value: "frozen", count: users.filter(u => u.is_frozen).length },
    { label: "Banned", value: "banned", count: users.filter(u => u.is_banned).length },
  ];

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Manage Users</h1>
            <p className="mt-1 text-muted-foreground">View every account email, role, seller access, and account status</p>
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={50}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, or user ID..." className="pl-10 h-11" />
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={80}>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {tabs.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === t.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {t.label} <span className="ml-1 text-xs opacity-70">({t.count})</span>
            </button>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={100}>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="font-display">Users</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading users...</div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mb-4">
                  <Store className="h-7 w-7 text-destructive" />
                </div>
                <p className="font-display font-semibold text-foreground">Couldn't load users</p>
                <p className="mt-1 text-sm text-muted-foreground max-w-md">{loadError}</p>
                <Button onClick={fetchUsers} className="mt-4" size="sm">Try again</Button>
              </div>
            ) : filtered.length === 0 ? (

              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                  <Store className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-display font-semibold text-foreground">No users found</p>
                <p className="mt-1 text-sm text-muted-foreground">Accounts will appear here after users register or sign in.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Account Status</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((user, idx) => (
                      <TableRow key={user.user_id || idx}>
                        <TableCell>
                          <div>
                            <span className="font-medium text-foreground">{user.full_name || "—"}</span>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {user.roles.includes("admin") && <Badge className="bg-primary/10 text-primary border-primary/20 gap-1"><Crown className="h-3 w-3" /> Admin</Badge>}
                            {user.seller_capable && <Badge className="bg-accent/10 text-accent border-accent/20 gap-1"><Store className="h-3 w-3" /> Seller</Badge>}
                            {user.roles.includes("buyer") && !user.seller_capable && <Badge variant="secondary" className="gap-1"><ShoppingBag className="h-3 w-3" /> Buyer</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {user.is_banned ? (
                              <Badge variant="destructive">Banned</Badge>
                            ) : user.is_frozen ? (
                              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Frozen</Badge>
                            ) : user.seller_capable && user.is_approved ? (
                              <Badge className="bg-accent/10 text-accent border-accent/20">Approved</Badge>
                            ) : user.roles.includes("seller") ? (
                              <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending</Badge>
                            ) : (
                              <Badge variant="secondary">Active</Badge>
                            )}
                            {user.is_verified && (
                              <Badge className="bg-accent/10 text-accent border-accent/20 gap-1"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{user.product_count}</TableCell>
                        <TableCell>{user.order_count}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end flex-wrap">
                            {!user.seller_capable ? (
                              <Button size="sm" onClick={() => updateSellerAccess(user, true)} className="gap-1 bg-accent hover:bg-accent/90 text-accent-foreground">
                                <UserCheck className="h-3 w-3" /> Make Seller
                              </Button>
                            ) : !user.roles.includes("admin") && user.roles.includes("seller") ? (
                              <Button size="sm" variant="outline" onClick={() => updateSellerAccess(user, false)} className="gap-1">
                                <UserX className="h-3 w-3" /> Remove Seller
                              </Button>
                            ) : null}
                            {user.roles.includes("seller") && !user.is_approved ? (
                              <Button size="sm" onClick={() => updateAccount(user.user_id, { is_approved: true }, "Seller approved")} className="gap-1 bg-accent hover:bg-accent/90 text-accent-foreground">
                                <UserCheck className="h-3 w-3" /> Approve
                              </Button>
                            ) : user.roles.includes("seller") && !user.roles.includes("admin") ? (
                              <Button size="sm" variant="outline" onClick={() => updateAccount(user.user_id, { is_approved: false }, "Seller approval revoked")} className="gap-1">
                                <UserX className="h-3 w-3" /> Revoke Approval
                              </Button>
                            ) : null}
                            {!user.is_verified ? (
                              <Button size="sm" variant="outline" onClick={() => updateAccount(user.user_id, { is_verified: true }, "User verified")} className="gap-1 text-accent">
                                <ShieldCheck className="h-3 w-3" /> Verify
                              </Button>
                            ) : !user.roles.includes("admin") ? (
                              <Button size="sm" variant="outline" onClick={() => updateAccount(user.user_id, { is_verified: false }, "Verification removed")} className="gap-1">
                                <ShieldOff className="h-3 w-3" /> Unverify
                              </Button>
                            ) : null}
                            {!user.is_frozen ? (
                              <Button size="sm" variant="outline" onClick={() => updateAccount(user.user_id, { is_frozen: true }, "Account frozen")} className="gap-1">
                                <Snowflake className="h-3 w-3" /> Freeze
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => updateAccount(user.user_id, { is_frozen: false }, "Account unfrozen")} className="gap-1">
                                Unfreeze
                              </Button>
                            )}
                            {!user.is_banned ? (
                              <Button size="sm" variant="outline" onClick={() => updateAccount(user.user_id, { is_banned: true, is_frozen: true }, "Account revoked")} className="gap-1 text-destructive">
                                <Ban className="h-3 w-3" /> Revoke
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => updateAccount(user.user_id, { is_banned: false, is_frozen: false }, "Account restored")} className="gap-1">
                                Restore
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>
    </div>
  );
}
