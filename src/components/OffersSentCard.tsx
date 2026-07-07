import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Loader2, DollarSign, Clock, Trash2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, isPast } from "date-fns";

interface Offer {
  id: string;
  product_id: string;
  product_title?: string;
  product_image?: string;
  seller_id: string;
  seller_name?: string;
  amount: string; // supabase numeric comes back as string
  currency: string;
  note: string;
  attachment_url: string | null;
  status: "pending" | "accepted" | "countered" | "rejected" | "expired" | "cancelled";
  expires_at: string;
  created_at: string;
}


export default function OffersSentCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadOffers();
  }, [user]);

  const loadOffers = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("offers")
      .select(`
        id,
      product_id,
      seller_id,
      buyer_id,
      amount,
        currency,
        note,
        attachment_url,
        status,
        expires_at,
        created_at
      `)
      .eq("buyer_id", user.id)
      .in("status", ["pending", "countered", "rejected", "accepted"])
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load offers", variant: "destructive" });
      setLoading(false);
      return;
    }

    type OfferRow = Omit<Offer, "product_title" | "product_image" | "seller_name"> & {
      product_title?: string | null;
      product_image?: string | null;
      seller_name?: string | null;
    };

    const formatted: Offer[] = (data || []).map((offer: OfferRow) => ({
      id: offer.id,
      product_id: offer.product_id,
      product_title: offer.product_title ?? undefined,
      product_image: offer.product_image ?? undefined,
      seller_id: offer.seller_id,
      seller_name: offer.seller_name ?? undefined,
      amount: offer.amount,
      currency: offer.currency,
      note: offer.note,
      attachment_url: offer.attachment_url,
      status: offer.status,
      expires_at: offer.expires_at,
      created_at: offer.created_at,
    }));

    setOffers(formatted);

    setLoading(false);
  };

  const handleCancel = async (offerId: string) => {
    setCancelling(offerId);
    const { data, error } = await supabase.functions.invoke("respond-offer", {
      body: { offerId, action: "cancel" },
    });
    setCancelling(null);

    if (error || data?.error) {
      toast({
        title: "Failed to cancel offer",
        description: data?.error || error?.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Offer cancelled" });
    loadOffers();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "default";
      case "countered":
        return "secondary";
      case "accepted":
        return "default";
      case "rejected":
        return "destructive";
      case "expired":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === "accepted") return "✓ Accepted";
    if (status === "rejected") return "✗ Rejected";
    if (status === "countered") return "↔ Countered";
    if (status === "expired") return "⏳ Expired";
    if (status === "cancelled") return "✕ Cancelled";
    return "⏳ Pending";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Offers Sent</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (offers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Offers Sent</CardTitle>
          <CardDescription>Track offers you've made</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 text-sm text-muted-foreground">
          You haven't made any offers yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Offers Sent ({offers.length})</CardTitle>
        <CardDescription>Track your active and past offers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {offers.map((offer) => {
          const isExpired = isPast(new Date(offer.expires_at));
          const isPending = offer.status === "pending" && !isExpired;
          
          return (
            <div
              key={offer.id}
              className="flex items-start gap-4 p-4 border rounded-lg bg-card hover:bg-muted/50 transition"
            >
              {offer.product_image && (
                <img
                  src={offer.product_image}
                  alt={offer.product_title}
                  className="h-16 w-16 rounded-md object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm line-clamp-1">{offer.product_title}</p>
                    <p className="text-xs text-muted-foreground">to {offer.seller_name}</p>
                  </div>
                  <Badge variant={getStatusColor(offer.status)}>
                    {getStatusLabel(offer.status)}
                  </Badge>
                </div>

                <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <DollarSign className="h-4 w-4" />
                    {parseFloat(offer.amount).toFixed(2)} {offer.currency}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {isExpired ? "Expired" : `Expires in ${formatDistanceToNow(new Date(offer.expires_at))}`}
                  </span>
                </div>

                {offer.note && (
                  <p className="mt-2 text-sm text-muted-foreground italic line-clamp-2">"{offer.note}"</p>
                )}

                {offer.attachment_url && (
                  <a
                    href={offer.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <MessageCircle className="h-3 w-3" /> View attachment
                  </a>
                )}
              </div>

              {isPending && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCancel(offer.id)}
                  disabled={cancelling === offer.id}
                  className="flex items-center gap-1 text-destructive hover:text-destructive flex-shrink-0"
                >
                  {cancelling === offer.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Cancel
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
