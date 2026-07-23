import React, { useMemo } from "react";
import { Link } from "react-router-dom";

interface SearchSuggestionsProps {
  products: Array<{
    id: string;
    title: string;
    price: number;
    product_images?: { image_url: string }[];
  }>;
}

const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({ products }) => {
  const suggestions = useMemo(() => {
    return products.slice(0, 8);
  }, [products]);

  if (!suggestions.length) return null;

  return (
    <div className="mt-6">
      <h3 className="text-xs font-bold text-[#888880] dark:text-[#A0A0A0] uppercase tracking-wider mb-2">Suggestions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {suggestions.map(product => {
          const image = product.product_images?.[0]?.image_url;
          return (
            <Link
              key={product.id}
              to={`/product/${product.id}`}
              className="flex items-center gap-2 rounded-lg border border-[#E8E8E8] dark:border-[#222222] bg-white dark:bg-[#1E1E1E] p-2 hover:border-[#888880] dark:hover:border-[#555555] transition-colors"
            >
              <div className="h-8 w-8 shrink-0 rounded-md bg-[#F5F5F5] dark:bg-[#1E1E1E] overflow-hidden border border-[#E8E8E8] dark:border-[#222222]">
                {image ? (
                  <img src={image} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] truncate">{product.title}</div>
                <div className="text-[10px] text-[#888880] dark:text-[#A0A0A0]">{product.price.toLocaleString()}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default SearchSuggestions;