import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import DescriptionImage from "./DescriptionImage";
import { formatVariantAttributeLabel } from "@/lib/productDetailPresentation";

type DescImage = { url: string; alt?: string | null; order?: number };

export default function ProductRichDescription({
  images,
  description,
  specs,
  specificationsRef,
}: {
  images?: DescImage[] | null;
  description?: string | null;
  specs?: Record<string, string> | null;
  specificationsRef?: React.Ref<HTMLDivElement>;
}) {
  const specsEntries = specs && Object.keys(specs).length > 0
    ? Object.entries(specs)
    : null;
  const sortedImages = useMemo(
    () => (images ?? [])
      .filter((image) => Boolean(image.url))
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [images],
  );

  const [specsOpen, setSpecsOpen] = useState(true);
  const [imagesOpen, setImagesOpen] = useState(true);

  useEffect(() => {
    // Seller-uploaded media is part of the listing, so show it immediately.
    // Buyers can collapse the detail gallery with the explicit control below
    // when they want to get back to reviews or related products faster.
    setImagesOpen(true);
  }, [sortedImages]);

  return (
    <section className="w-full max-w-5xl mx-auto" aria-label="Product details content">
      {/* Specifications — AliExpress-style collapsible dropdown */}
      {specsEntries && specsEntries.length > 0 && (
        <div id="product-specifications" ref={specificationsRef} className="mb-8 scroll-mt-32 overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white shadow-sm dark:border-[#222222] dark:bg-[#1A1A1A]">
          <button
            type="button"
            onClick={() => setSpecsOpen(o => !o)}
            className="flex w-full items-center justify-between px-4 py-3 bg-[#FAFAFA] dark:bg-[#1A1A1C] text-left"
          >
            <span className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">Specifications</span>
            <ChevronDown className={`h-4 w-4 text-[#6E6C64] transition-transform ${specsOpen ? "rotate-180" : ""}`} />
          </button>
          {specsOpen && (
            <div className="border-t border-[#E8E8E8] dark:border-[#222222]">
              <table className="w-full text-[13px]">
                <tbody>
                  {specsEntries.map(([key, value], idx) => (
                    <tr
                      key={key}
                      className={idx % 2 === 0 ? "bg-[#F9F9F8] dark:bg-[#1A1A1C]" : "bg-white dark:bg-[#1E1E1E]"}
                    >
                      <td className="w-2/5 border-r border-[#E8E8E8] px-4 py-2.5 text-[11px] text-[#6E6C64] dark:border-[#222222] dark:text-[#A0A0A0]">
                        {formatVariantAttributeLabel(key)}
                      </td>
                      {/* `break-words`: a long unbroken value (serial, URL)
                          would otherwise widen the table past the card. */}
                      <td className="break-words px-4 py-2.5 text-[11px] font-medium text-[#111111] dark:text-[#FAF5F2]">
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Product details text */}
      {description && (
        <div className="mb-8 rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-sm dark:border-[#222222] dark:bg-[#1A1A1A] md:p-5">
          <h2 id="product-details-content-heading" className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">Product Details</h2>
          <div className="mt-2 text-[13px] leading-6 text-[#666666] dark:text-[#A0A0A0] whitespace-pre-line">
            {description}
          </div>
        </div>
      )}

      {/* Long seller-uploaded image details are available on demand. */}
      {sortedImages.length > 0 && (
        <div className="w-full">
          <div className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-[#E8D477] bg-gradient-to-br from-[#FFF8D6] via-white to-[#F7FAF5] p-4 shadow-sm dark:border-[#6E5A1B] dark:from-[#2A2410] dark:via-[#1A1A1A] dark:to-[#172018] sm:flex-row sm:items-center sm:justify-between">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[#F6C75D]" />
            <div>
              <h2 className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">Product images & details</h2>
              <p className="mt-1 text-xs text-[#6E6C64] dark:text-[#A0A0A0]">
                {sortedImages.length} seller-uploaded {sortedImages.length === 1 ? "image" : "images"}. Show them when you want to review the full listing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setImagesOpen((open) => !open)}
              aria-expanded={imagesOpen}
              aria-controls="product-description-images"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#111111] px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#2B2B2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:bg-[#FAF5F2] dark:text-[#111111] dark:hover:bg-white"
            >
              {imagesOpen ? "Hide full listing details" : "Show full listing details"}
              <ChevronDown className={`h-4 w-4 transition-transform ${imagesOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
          </div>
          {imagesOpen && (
            <div id="product-description-images" className="mt-3 flex w-full flex-col gap-3">
              {sortedImages.map((img, idx) => (
                <DescriptionImage key={`${img.url}-${idx}`} url={img.url} alt={img.alt || undefined} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
