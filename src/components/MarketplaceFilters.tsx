import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Filter, Star } from "lucide-react";
import { defaultFilters, type MarketplaceFiltersState } from "./marketplaceFiltersState";
import { useCurrency } from "@/hooks/useCurrency";

interface Props {
  value: MarketplaceFiltersState;
  onChange: (next: MarketplaceFiltersState) => void;
  activeCount: number;
  categoryName?: string | null;
  categoryFilters?: string[];
  categoryFilterOptions?: Record<string, string[]>;
}

const formatFilterLabel = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^\w/, c => c.toUpperCase());

export default function MarketplaceFilters({
  value,
  onChange,
  activeCount,
  categoryName,
  categoryFilters = [],
  categoryFilterOptions = {},
}: Props) {
  const { formatPrice } = useCurrency();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const apply = () => {
    const minPrice = Math.max(0, Number.isFinite(draft.minPrice) ? draft.minPrice : 0);
    const maxPrice = draft.maxPrice === null
      ? null
      : Math.max(minPrice, Number.isFinite(draft.maxPrice) ? draft.maxPrice : minPrice);
    onChange({ ...draft, minPrice, maxPrice });
    setOpen(false);
  };
  const reset = () => { setDraft(defaultFilters); onChange(defaultFilters); };
  const updateCategoryFilter = (key: string, nextValue: string) => {
    setDraft(d => {
      const categoryAttributes = { ...d.categoryAttributes };
      if (nextValue === "any") {
        delete categoryAttributes[key];
      } else {
        categoryAttributes[key] = nextValue;
      }
      return { ...d, categoryAttributes };
    });
  };

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
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Refine products by price, rating, condition, availability, and category details.</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 mt-6">
          <div>
            <Label>Price Range</Label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">From</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={draft.minPrice || ""}
                  onChange={(event) => setDraft(d => ({ ...d, minPrice: event.target.value === "" ? 0 : Math.max(0, Number(event.target.value)) }))}
                  aria-label="Minimum price"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">To</span>
                <Input
                  type="number"
                  min={draft.minPrice || 0}
                  step="any"
                  inputMode="decimal"
                  value={draft.maxPrice ?? ""}
                  onChange={(event) => setDraft(d => ({ ...d, maxPrice: event.target.value === "" ? null : Math.max(0, Number(event.target.value)) }))}
                  aria-label="Maximum price"
                />
              </label>
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{formatPrice(draft.minPrice)}</span>
              <span>{draft.maxPrice === null ? "No maximum" : formatPrice(draft.maxPrice)}</span>
            </div>
          </div>

          <div>
            <Label>Minimum Rating</Label>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2, 3, 4, 5].map(r => (
                <button type="button" key={r} aria-pressed={draft.minRating === r} onClick={() => setDraft(d => ({ ...d, minRating: r }))}
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
            <div className="grid grid-cols-2 gap-2 mt-2 sm:grid-cols-4">
              {["any", "new", "used", "refurbished"].map(c => (
                <button type="button" key={c} aria-pressed={draft.condition === c} onClick={() => setDraft(d => ({ ...d, condition: c }))}
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

          {categoryFilters.length > 0 && (
            <div className="space-y-4 border-t border-border pt-5">
              <div>
                <Label>{categoryName ? `${categoryName} Details` : "Category Details"}</Label>
                <p className="mt-1 text-xs text-muted-foreground">Narrow results using the fields sellers add for this category.</p>
              </div>
              {categoryFilters.map(filter => {
                const options = categoryFilterOptions[filter] || [];
                if (options.length === 0) return null;
                return (
                  <div key={filter}>
                    <Label className="text-xs text-muted-foreground">{formatFilterLabel(filter)}</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-pressed={!draft.categoryAttributes[filter]}
                        onClick={() => updateCategoryFilter(filter, "any")}
                        className={`h-9 rounded-md border px-3 text-xs font-medium transition-colors ${
                          !draft.categoryAttributes[filter] ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                        }`}
                      >
                        Any
                      </button>
                      {options.map(option => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={draft.categoryAttributes[filter] === option}
                          onClick={() => updateCategoryFilter(filter, option)}
                          className={`h-9 rounded-md border px-3 text-xs font-medium transition-colors ${
                            draft.categoryAttributes[filter] === option ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={reset} className="flex-1">Reset</Button>
            <Button onClick={apply} className="flex-1 bg-primary text-primary-foreground">Apply</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
