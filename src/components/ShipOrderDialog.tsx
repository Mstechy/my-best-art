import { useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Truck, Loader2 } from "lucide-react";

const CARRIERS = ["GIG Logistics", "DHL", "FedEx", "UPS", "USPS", "Royal Mail", "NIPOST", "Aramex", "Other"];

const schema = z.object({
  carrier: z.string().min(2).max(40),
  tracking_number: z.string().trim().min(4, "Tracking number too short").max(40, "Too long"),
  estimated_delivery: z.string().optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string;
  initialCarrier?: string | null;
  initialTracking?: string | null;
  onConfirm: (data: { carrier: string; tracking_number: string; estimated_delivery: string | null }) => Promise<void>;
}

export default function ShipOrderDialog({ open, onOpenChange, orderId, initialCarrier, initialTracking, onConfirm }: Props) {
  const [carrier, setCarrier] = useState(initialCarrier || "GIG Logistics");
  const [tracking, setTracking] = useState(initialTracking || "");
  const [eta, setEta] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const parsed = schema.safeParse({ carrier, tracking_number: tracking, estimated_delivery: eta });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach(e => { errs[e.path[0] as string] = e.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    await onConfirm({
      carrier: parsed.data.carrier,
      tracking_number: parsed.data.tracking_number,
      estimated_delivery: eta || null,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Mark order as shipped</DialogTitle>
          <DialogDescription>Order #{orderId.slice(0, 8)} — buyer will get a real-time notification.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Carrier</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CARRIERS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.carrier && <p className="text-xs text-destructive mt-1">{errors.carrier}</p>}
          </div>
          <div>
            <Label htmlFor="trk">Tracking number</Label>
            <Input id="trk" value={tracking} onChange={e => setTracking(e.target.value)} className="h-11" placeholder="e.g. 1Z999AA10123456784" />
            {errors.tracking_number && <p className="text-xs text-destructive mt-1">{errors.tracking_number}</p>}
          </div>
          <div>
            <Label htmlFor="eta">Estimated delivery (optional)</Label>
            <Input id="eta" type="date" value={eta} onChange={e => setEta(e.target.value)} className="h-11" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="min-h-[44px] bg-primary text-primary-foreground gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Confirm shipment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
