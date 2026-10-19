import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Search, Package, CheckCircle2, XCircle, Clock, Pencil, Trash2, Plus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AnimatedSection from "@/components/AnimatedSection";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ProductImage from "@/components/product/ProductImage";
import { getUserFacingErrorMessage, logError } from "@/lib/errorHandler";
import { useAdminProducts } from "@/hooks/useAdminDashboard";
import { useCurrency } from "@/hooks/useCurrency";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Product {
  id: string;
  title: string;
  price: number;
  status: string;
  is_approved: boolean;
  stock_quantity: number;
  created_at: string;
  seller_id: string;
  seller_name?: string;
  seller_email?: string;
  primary_image?: string;
  moderation_reason?: string | null;
  moderation_next_action?: string | null;
  moderation_owner_id?: string | null;
  moderation_updated_at?: string | null;
}

type Tab = "all" | "pending" | "approved" | "archived";

export default function AdminProducts() {
  const { formatPrice } = useCurrency();
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Product | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNextAction, setRejectNextAction] = useState("Update the listing and submit it again for review.");
  const pageSize = 25;

  const productsQuery = useAdminProducts(page, pageSize, search, tab);
  const products = productsQuery.data?.products ?? [];
  const counts = productsQuery.data?.counts ?? { all: 0, pending: 0, approved: 0, archived: 0 };
  const total = productsQuery.data?.total ?? 0;
  const loading = productsQuery.isLoading;

  useEffect(() => {
    setPage(0);
  }, [search, tab]);

  const approveProduct = async (id: string) => {
     
    const { error } = await (supabase as any).rpc("admin_set_product_approval", { _product_id: id, _is_approved: true, _status: "active", _moderation_reason: null, _moderation_next_action: null, _moderation_owner_id: null });
    if (error) { logError(error, "admin_product_approval"); toast({ title: "Error", description: getUserFacingErrorMessage(error, "save"), variant: "destructive" }); return; }
    toast({ title: "Product approved", description: "Product is now visible on the marketplace." });
    productsQuery.refetch();
  };

  const rejectProduct = async (id: string, reason: string, nextAction: string) => {
     
    const { error } = await (supabase as any).rpc("admin_set_product_approval", { _product_id: id, _is_approved: false, _status: "draft", _moderation_reason: reason, _moderation_next_action: nextAction, _moderation_owner_id: null });
    if (error) { logError(error, "admin_product_rejection"); toast({ title: "Error", description: getUserFacingErrorMessage(error, "save"), variant: "destructive" }); return; }
    toast({ title: "Changes requested", description: "The seller can now see why the listing was hidden and what to do next." });
    productsQuery.refetch();
  };

  const setFlashDealStatus = async (productId: string, status: string) => {
     
    const { error } = await (supabase as any).rpc("admin_set_flash_deal_status", { _product_id: productId, _new_status: status });
    if (error) { logError(error, "admin_flash_deal_status"); toast({ title: "Error", description: getUserFacingErrorMessage(error, "save"), variant: "destructive" }); return; }
    toast({ title: `Flash deal ${status}`, description: `Flash deal has been ${status}.` });
    productsQuery.refetch();
  };

  const pendingCount = counts.pending;

  const tabs: { label: string; value: Tab; count: number }[] = [
    { label: "All Products", value: "all", count: counts.all },
    { label: "Pending Approval", value: "pending", count: pendingCount },
    { label: "Approved", value: "approved", count: counts.approved },
    { label: "Archived", value: "archived", count: counts.archived },
  ];

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Product Management</h1>
            <p className="mt-1 text-muted-foreground">Approve, reject or delete listings. You can only edit products you published yourself.</p>
          </div>
          <Link to="/seller/products">
            <Button className="gap-2 gradient-admin text-primary-foreground">
              <Plus className="h-4 w-4" /> Publish product
            </Button>
          </Link>
        </div>
      </AnimatedSection>

      {pendingCount > 0 && (
        <AnimatedSection variant="fade-up" delay={30}>
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
            <div>
              <p className="font-medium text-foreground text-sm">{pendingCount} product{pendingCount > 1 ? "s" : ""} awaiting approval</p>
              <p className="text-xs text-muted-foreground">Review and approve to make them visible on the marketplace</p>
            </div>
            <Button size="sm" variant="outline" className="ml-auto shrink-0" onClick={() => setTab("pending")}>
              Review Now
            </Button>
          </div>
        </AnimatedSection>
      )}

      <AnimatedSection variant="fade-up" delay={50}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by product name..." className="pl-10 h-11" />
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
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading products...</div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                  <Package className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-display font-semibold text-foreground">No products found</p>
                <p className="mt-1 text-sm text-muted-foreground">Products will appear here as sellers list them.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map(product => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden shrink-0">
                              {product.primary_image ? (
                                <ProductImage src={product.primary_image} alt={product.title} loading="lazy" />
                              ) : (
                                <div className="flex items-center justify-center h-full"><Package className="h-4 w-4 text-muted-foreground" /></div>
                              )}
                            </div>
                            <span className="font-medium text-foreground text-sm truncate max-w-[200px]">{product.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="text-sm text-foreground">{product.seller_name}</span>
                            <p className="text-xs text-muted-foreground">{product.seller_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{formatPrice(product.price)}</TableCell>
                        <TableCell>{product.stock_quantity}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant={product.status === "active" ? "default" : "secondary"} className="capitalize text-xs">
                              {product.status}
                            </Badge>
                            {product.is_approved ? (
                              <Badge className="bg-success/10 text-success border-success/20 gap-1 text-xs">
                                <CheckCircle2 className="h-3 w-3" /> Approved
                              </Badge>
                            ) : product.status === "active" ? (
                              <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 gap-1 text-xs">
                                <Clock className="h-3 w-3" /> Pending
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end flex-wrap">
                            {product.status === "active" && !product.is_approved && (
                              <Button size="sm" onClick={() => approveProduct(product.id)} className="gap-1 bg-success hover:bg-success/90 text-success-foreground">
                                <CheckCircle2 className="h-3 w-3" /> Approve
                              </Button>
                            )}
                            {product.status === "active" && !product.is_approved && (
                              <Button size="sm" variant="outline" onClick={() => { setRejectTarget(product); setRejectReason(product.moderation_reason || ""); setRejectNextAction(product.moderation_next_action || "Update the listing and submit it again for review."); }} className="gap-1 text-destructive hover:text-destructive">
                                <XCircle className="h-3 w-3" /> Request changes
                              </Button>
                            )}
                            {product.is_approved && (
                              <Button size="sm" variant="outline" onClick={() => { setRejectTarget(product); setRejectReason(product.moderation_reason || ""); setRejectNextAction(product.moderation_next_action || "Update the listing and submit it again for review."); }} className="gap-1">
                                <XCircle className="h-3 w-3" /> Hide
                              </Button>
                            )}
                            {product.seller_id === user?.id ? (
                              <Link to="/seller/products">
                                <Button size="sm" variant="outline" className="gap-1">
                                  <Pencil className="h-3 w-3" /> Edit
                                </Button>
                              </Link>
                            ) : (
                              <Link to={`/product/${product.id}`} target="_blank">
                                <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground">
                                  View
                                </Button>
                              </Link>
                            )}
                            <Button size="sm" variant="outline" onClick={() => setDeleteId(product.id)} className="gap-1 text-destructive hover:text-destructive">
                              <Trash2 className="h-3 w-3" /> Delete
                            </Button>
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? "No products" : `Showing ${page * pageSize + 1}-${page * pageSize + products.length} of ${total}`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0 || loading}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((value) => value + 1)} disabled={(page + 1) * pageSize >= total || loading}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the product and its images. Existing orders remain intact. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteId) return;
                const id = deleteId;
                setDeleteId(null);
                const { error } = await supabase.from("products").delete().eq("id", id);
                if (error) { logError(error, "admin_product_delete"); toast({ title: "Error", description: getUserFacingErrorMessage(error, "delete"), variant: "destructive" }); return; }
                toast({ title: "Product deleted" });
                productsQuery.refetch();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request changes before approval?</AlertDialogTitle>
            <AlertDialogDescription>
              The seller will see this reason and the next action in their dashboard. Be specific and actionable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 py-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Reason
              <Textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Example: Add clear photos of the product label and confirm the storage size." rows={4} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Next action for seller
              <Input value={rejectNextAction} onChange={(event) => setRejectNextAction(event.target.value)} />
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!rejectReason.trim() || !rejectTarget}
              onClick={async () => {
                if (!rejectTarget || !rejectReason.trim()) return;
                const target = rejectTarget;
                setRejectTarget(null);
                await rejectProduct(target.id, rejectReason.trim(), rejectNextAction.trim() || "Update the listing and submit it again for review.");
                setRejectReason("");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Request changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
