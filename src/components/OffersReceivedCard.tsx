import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Loader2, DollarSign, Clock, CheckCircle2, XCircle, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, isPast } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface Offer {
  id: string;
  product_id: string;
  product_title?: string;
  product_image?: string;
  buyer_id: string;
  buyer_name?: string;
  amount: string;
  currency: string;
  note: string;
  attachment_url: string | null;
  status: "pending" | "accepted" | "countered" | "rejected" | "expired" | "cancelled";
  expires_at: string;
  created_at: string;
}

export default function OffersReceivedCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [showCounterDialog, setShowCounterDialog] = useState(false);

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
        buyer_id,
        seller_id,
        amount,
        currency,
        note,
        attachment_url,
        status,
        expires_at,
        created_at
      `)
      .eq("seller_id", user.id)
      .in("status", ["pending", "countered"])
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load offers", variant: "destructive" });
      setLoading(false);
      return;
    }

    type OfferWithJoins = Offer & {
      products?: { title?: string; product_images?: Array<{ image_url?: string | null }> };
      profiles?: { full_name?: string | null };
    };

    const formatted = (data || []).map((offer: OfferWithJoins) => ({
      id: offer.id,
      product_id: offer.product_id,
      product_title: offer.products?.title,
      product_image: offer.products?.product_images?.[0]?.image_url ?? undefined,
      buyer_id: offer.buyer_id,
      buyer_name: offer.profiles?.full_name || "Unknown Buyer",
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

  const handleResponse = async (offerId: string, action: "accept" | "reject" | "counter") => {
    if (action === "counter" && !counterAmount) {
      toast({ title: "Enter counter amount", variant: "destructive" });
      return;
    }

    setResponding(offerId);

    const body: {
      offerId: string;
      action: "accept" | "reject" | "counter";
      counterAmount?: number;
    } = { offerId, action };

    if (action === "counter") {
      body.counterAmount = parseFloat(counterAmount);
    }

    const { data, error } = await supabase.functions.invoke("respond-offer", { body });

    setResponding(null);

    if (error || data?.error) {
      toast({
        title: "Failed to respond",
        description: data?.error || error?.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: `Offer ${action === "accept" ? "accepted" : action === "reject" ? "rejected" : "countered"}`,
    });

    setShowCounterDialog(false);
    setCounterAmount("");
    setSelectedOffer(null);
    loadOffers();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Offers Received</CardTitle>
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
          <CardTitle>Offers Received</CardTitle>
          <CardDescription>No active offers right now</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 text-sm text-muted-foreground">
          When buyers make offers on your products, they'll appear here.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Offers Received ({offers.length})</CardTitle>
          <CardDescription>Respond to buyer offers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {offers.map((offer) => {
            const isExpired = isPast(new Date(offer.expires_at));
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
                      <p className="text-xs text-muted-foreground">from {offer.buyer_name}</p>
                    </div>
                    <Badge
                      variant={
                        offer.status === "countered"
                          ? "secondary"
                          : offer.status === "pending"
                            ? "default"
                            : "outline"
                      }
                    >
                      {offer.status}
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

                {!isExpired && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleResponse(offer.id, "accept")}
                      disabled={responding === offer.id}
                      className="flex items-center gap-1"
                    >
                      {responding === offer.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedOffer(offer);
                        setCounterAmount(offer.amount);
                        setShowCounterDialog(true);
                      }}
                      disabled={responding === offer.id}
                    >
                      Counter
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleResponse(offer.id, "reject")}
                      disabled={responding === offer.id}
                      className="flex items-center gap-1 text-destructive hover:text-destructive"
                    >
                      {responding === offer.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AlertDialog open={showCounterDialog} onOpenChange={setShowCounterDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Make a Counter Offer</AlertDialogTitle>
            <AlertDialogDescription>
              Current offer: ${parseFloat(selectedOffer?.amount || "0").toFixed(2)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="counter-price">Your counter price (USD)</Label>
              <Input
                id="counter-price"
                type="number"
                step="0.01"
                min="0"
                value={counterAmount}
                onChange={(e) => setCounterAmount(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedOffer && handleResponse(selectedOffer.id, "counter")}
              disabled={responding === selectedOffer?.id || !counterAmount}
            >
              {responding === selectedOffer?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Send Counter"
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
