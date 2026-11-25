import { Dispatch, SetStateAction, useEffect, useState } from "react";
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

interface FilterFieldsProps {
  draft: MarketplaceFiltersState;
  setDraft: Dispatch<SetStateAction<MarketplaceFiltersState>>;
  formatPrice: (amount: number) => string;
  categoryName?: string | null;
  categoryFilters: string[];
  categoryFilterOptions: Record<string, string[]>;
  onApply: () => void;
  onReset: () => void;
}

const formatFilterLabel = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^\w/, c => c.toUpperCase());

/**
 * The filter controls are shared by the desktop refinement rail and the
 * mobile sheet. Keeping one field implementation prevents the two layouts
 * from drifting apart as category-specific filters evolve.
 */
function FilterFields({
  draft,
  setDraft,
  formatPrice,
  categoryName,
  categoryFilters,
  categoryFilterOptions,
  onApply,
  onReset,
}: FilterFieldsProps) {
  const updateCategoryFilter = (key: string, nextValue: string) => {
    setDraft(current => {
      const categoryAttributes = { ...current.categoryAttributes };
      if (nextValue === "any") {
        delete categoryAttributes[key];
      } else {
        categoryAttributes[key] = nextValue;
      }
      return { ...current, categoryAttributes };
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <Label>Price range</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">From</span>
            <Input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={draft.minPrice || ""}
              onChange={(event) => setDraft(current => ({ ...current, minPrice: event.target.value === "" ? 0 : Math.max(0, Number(event.target.value)) }))}
              aria-label="Minimum price"
              className="h-9 text-xs"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">To</span>
            <Input
              type="number"
              min={draft.minPrice || 0}
              step="any"
              inputMode="decimal"
              value={draft.maxPrice ?? ""}
              onChange={(event) => setDraft(current => ({ ...current, maxPrice: event.target.value === "" ? null : Math.max(0, Number(event.target.value)) }))}
              aria-label="Maximum price"
              className="h-9 text-xs"
            />
          </label>
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>{formatPrice(draft.minPrice)}</span>
          <span>{draft.maxPrice === null ? "No maximum" : formatPrice(draft.maxPrice)}</span>
        </div>
      </div>

      <div>
        <Label>Minimum rating</Label>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map(rating => (
            <button
              type="button"
              key={rating}
              aria-pressed={draft.minRating === rating}
              onClick={() => setDraft(current => ({ ...current, minRating: rating }))}
              className={`flex h-9 items-center justify-center gap-0.5 rounded-lg border text-[11px] font-medium transition-colors ${draft.minRating === rating ? "border-[#C2410C] bg-[#FFF1E6] text-[#9A3412] dark:border-[#F6C75D] dark:bg-[#3A2910] dark:text-[#F6C75D]" : "border-border hover:bg-muted"}`}
            >
              {rating === 0 ? "Any" : <><span>{rating}</span><Star className="h-3 w-3 fill-current" /></>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Condition</Label>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {["any", "new", "used", "refurbished"].map(condition => (
            <button
              type="button"
              key={condition}
              aria-pressed={draft.condition === condition}
              onClick={() => setDraft(current => ({ ...current, condition }))}
              className={`h-9 rounded-lg border text-[11px] font-medium capitalize transition-colors ${draft.condition === condition ? "border-[#C2410C] bg-[#FFF1E6] text-[#9A3412] dark:border-[#F6C75D] dark:bg-[#3A2910] dark:text-[#F6C75D]" : "border-border hover:bg-muted"}`}
            >
              {condition}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={draft.inStockOnly}
          onChange={event => setDraft(current => ({ ...current, inStockOnly: event.target.checked }))}
          className="h-4 w-4 rounded border-border"
        />
        <span className="text-foreground">In stock only</span>
      </label>

      {categoryFilters.length > 0 && (
        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <Label>{categoryName ? `${categoryName} details` : "Category details"}</Label>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Use the specifications sellers add for this department.</p>
          </div>
          {categoryFilters.map(filter => {
            const options = categoryFilterOptions[filter] || [];
            if (options.length === 0) return null;
            return (
              <div key={filter}>
                <Label className="text-xs text-muted-foreground">{formatFilterLabel(filter)}</Label>
                <div className="mt-2 max-h-36 space-y-1 overflow-y-auto pr-1">
                  <button
                    type="button"
                    aria-pressed={!draft.categoryAttributes[filter]}
                    onClick={() => updateCategoryFilter(filter, "any")}
                    className={`block w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${!draft.categoryAttributes[filter] ? "bg-[#FFF1E6] font-semibold text-[#9A3412] dark:bg-[#3A2910] dark:text-[#F6C75D]" : "hover:bg-muted"}`}
                  >
                    Any
                  </button>
                  {options.map(option => (
                    <button
                      type="button"
                      key={option}
                      aria-pressed={draft.categoryAttributes[filter] === option}
                      onClick={() => updateCategoryFilter(filter, option)}
                      className={`block w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${draft.categoryAttributes[filter] === option ? "bg-[#FFF1E6] font-semibold text-[#9A3412] dark:bg-[#3A2910] dark:text-[#F6C75D]" : "hover:bg-muted"}`}
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

      <div className="flex gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onReset} className="h-9 flex-1 text-xs">Reset</Button>
        <Button type="button" variant="brand" onClick={onApply} className="h-9 flex-1 text-xs">Apply</Button>
      </div>
    </div>
  );
}

/** Persistent desktop refinement rail using the same controls as mobile. */
export function MarketplaceFiltersPanel({
  value,
  onChange,
  activeCount,
  categoryName,
  categoryFilters = [],
  categoryFilterOptions = {},
}: Props) {
  const { formatPrice } = useCurrency();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const apply = () => {
    const minPrice = Math.max(0, Number.isFinite(draft.minPrice) ? draft.minPrice : 0);
    const maxPrice = draft.maxPrice === null
      ? null
      : Math.max(minPrice, Number.isFinite(draft.maxPrice) ? draft.maxPrice : minPrice);
    onChange({ ...draft, minPrice, maxPrice });
  };
  const reset = () => {
    setDraft(defaultFilters);
    onChange(defaultFilters);
  };

  return (
    <section aria-label="Refine products" className="rounded-2xl border border-[#E8E8E8] bg-white p-4 dark:border-[#222222] dark:bg-[#1E1E1E]">
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-[#E8E8E8] pb-3 dark:border-[#222222]">
        <div>
          <h2 className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">Refine results</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Narrow the live catalogue</p>
        </div>
        {activeCount > 0 && <span className="rounded-full bg-[#FFF1E6] px-2 py-1 text-[10px] font-bold text-[#9A3412] dark:bg-[#3A2910] dark:text-[#F6C75D]">{activeCount} active</span>}
      </div>
      <FilterFields
        draft={draft}
        setDraft={setDraft}
        formatPrice={formatPrice}
        categoryName={categoryName}
        categoryFilters={categoryFilters}
        categoryFilterOptions={categoryFilterOptions}
        onApply={apply}
        onReset={reset}
      />
    </section>
  );
}

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
  const reset = () => {
    setDraft(defaultFilters);
    onChange(defaultFilters);
  };

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) setDraft(value); }}>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-10 gap-2 rounded-full">
          <Filter className="h-4 w-4" />
          Filters
          {activeCount > 0 && <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-ink">{activeCount}</span>}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Refine products by price, rating, condition, availability, and category details.</SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <FilterFields
            draft={draft}
            setDraft={setDraft}
            formatPrice={formatPrice}
            categoryName={categoryName}
            categoryFilters={categoryFilters}
            categoryFilterOptions={categoryFilterOptions}
            onApply={apply}
            onReset={reset}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
