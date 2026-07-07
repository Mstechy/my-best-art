import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { Slider } from "../components/ui/slider";
import { Label } from "../components/ui/label";
import { Filter, Star } from "lucide-react";

export interface MarketplaceFiltersState {
  minPrice: number;
  maxPrice: number;
  minRating: number;
  inStockOnly: boolean;
  condition: string; // "any" | "new" | "used" | "refurbished"
}

export const defaultFilters: MarketplaceFiltersState = {
  minPrice: 0,
  maxPrice: 10000,
  minRating: 0,
  inStockOnly: false,
  condition: "any",
};

interface Props {
  value: MarketplaceFiltersState;
  onChange: (next: MarketplaceFiltersState) => void;
  activeCount: number;
}

export default function MarketplaceFilters({ value, onChange, activeCount }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const apply = () => { onChange(draft); setOpen(false); };
  const reset = () => { setDraft(defaultFilters); onChange(defaultFilters); };

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(value); }}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2 h-10">
          <Filter className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
        <div className="space-y-6 mt-6">
          <div>
            <Label>Price Range</Label>
            <div className="mt-3 px-1">
              <Slider
                min={0} max={10000} step={10}
                value={[draft.minPrice, draft.maxPrice]}
                onValueChange={([min, max]) => setDraft(d => ({ ...d, minPrice: min, maxPrice: max }))}
              />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>${draft.minPrice}</span>
                <span>${draft.maxPrice}{draft.maxPrice === 10000 ? "+" : ""}</span>
              </div>
            </div>
          </div>

          <div>
            <Label>Minimum Rating</Label>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2, 3, 4, 5].map(r => (
                <button key={r} onClick={() => setDraft(d => ({ ...d, minRating: r }))}
                  className={`flex-1 h-10 rounded-md border text-xs font-medium transition-colors ${draft.minRating === r ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
                  {r === 0 ? "Any" : (
                    <span className="inline-flex items-center gap-0.5">{r}<Star className="h-3 w-3 fill-current" /></span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Condition</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {["any", "new", "used", "refurbished"].map(c => (
                <button key={c} onClick={() => setDraft(d => ({ ...d, condition: c }))}
                  className={`h-10 rounded-md border text-xs font-medium capitalize transition-colors ${draft.condition === c ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={draft.inStockOnly}
              onChange={e => setDraft(d => ({ ...d, inStockOnly: e.target.checked }))}
              className="h-4 w-4 rounded border-border" />
            <span className="text-sm text-foreground">In stock only</span>
          </label>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={reset} className="flex-1">Reset</Button>
            <Button onClick={apply} className="flex-1 bg-primary text-primary-foreground">Apply</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function countActive(f: MarketplaceFiltersState): number {
  let n = 0;
  if (f.minPrice > 0 || f.maxPrice < 10000) n++;
  if (f.minRating > 0) n++;
  if (f.inStockOnly) n++;
  if (f.condition !== "any") n++;
  return n;
}
