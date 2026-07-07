import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Tag, Paperclip, Loader2, X } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const offerSchema = z.object({
  offer: z.number().positive().max(9_999_999),
  note: z.string().max(500).optional(),
});

interface MakeOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productTitle: string;
  productPrice: number;
  onSent?: (sellerId: string) => void;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export default function MakeOfferDialog({ open, onOpenChange, productId, productTitle, productPrice, onSent }: MakeOfferDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [offer, setOffer] = useState<string>(((productPrice * 0.9).toFixed(2)));
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setNote(""); setFile(null); };

  const handleFileChange = (f: File | null) => {
    if (!f) { setFile(null); return; }
    if (f.size > MAX_FILE_BYTES) {
      toast({ title: "File too large", description: "Maximum 5 MB.", variant: "destructive" });
      return;
    }
    if (!/^image\/|application\/pdf$/i.test(f.type)) {
      toast({ title: "Unsupported file", description: "Use an image or PDF.", variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    const value = parseFloat(offer);
    const parsed = offerSchema.safeParse({ offer: value, note });
    if (!parsed.success) {
      toast({ title: "Invalid offer", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    let attachmentPath: string | null = null;
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
      attachmentPath = `offers/${user.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(attachmentPath, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setSubmitting(false);
        toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
        return;
      }
    }

    const { data, error } = await supabase.functions.invoke("send-offer", {
      body: { productId, offerPrice: value, note: note.trim(), attachmentPath },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({ title: "Couldn't send offer", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Offer sent!", description: "The seller has been notified." });
    onSent?.((data as any).sellerId);
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /> Make an Offer</DialogTitle>
          <DialogDescription className="line-clamp-2">{productTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="offer-price">Your offer (USD)</Label>
            <Input id="offer-price" type="number" step="0.01" min="0" max="9999999" inputMode="decimal"
              value={offer} onChange={(e) => setOffer(e.target.value)} className="h-11" />
            <p className="mt-1 text-xs text-muted-foreground">Listed at ${productPrice.toFixed(2)}</p>
          </div>
          <div>
            <Label htmlFor="offer-note">Note (optional, max 500)</Label>
            <Textarea id="offer-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder="I can pay today if you accept this price." rows={3} />
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{note.length}/500</p>
          </div>
          <div>
            <Label htmlFor="offer-file" className="flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" /> Attachment (image or PDF, optional)
            </Label>
            {file ? (
              <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 truncate text-foreground">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Input id="offer-file" type="file" accept="image/*,application/pdf"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} className="h-11 cursor-pointer" />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">Cancel</Button>
          <Button onClick={submit} disabled={submitting} className="min-h-[44px] bg-primary text-primary-foreground gap-2">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Send Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
