import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import DescriptionImage from "./DescriptionImage";

type DescImage = { url: string; alt?: string | null; order?: number };

export default function ProductRichDescription({
  images,
  description,
  specs,
}: {
  images?: DescImage[] | null;
  description?: string | null;
  specs?: Record<string, string> | null;
}) {
  const specsEntries = specs && Object.keys(specs).length > 0
    ? Object.entries(specs)
    : null;

  const [specsOpen, setSpecsOpen] = useState(true);

  return (
    <section className="w-full max-w-5xl mx-auto" aria-label="Product details content">
      {/* Specifications — AliExpress-style collapsible dropdown */}
      {specsEntries && specsEntries.length > 0 && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white shadow-sm dark:border-[#222222] dark:bg-[#1A1A1A]">
          <button
            type="button"
            onClick={() => setSpecsOpen(o => !o)}
            className="flex w-full items-center justify-between px-4 py-3 bg-[#FAFAFA] dark:bg-[#1A1A1C] text-left"
          >
            <span className="text-base font-bold text-[#111111] dark:text-[#FAF5F2]">Specifications</span>
            <ChevronDown className={`h-4 w-4 text-[#6E6C64] transition-transform ${specsOpen ? "rotate-180" : ""}`} />
          </button>
          {specsOpen && (
            <div className="border-t border-[#E8E8E8] dark:border-[#222222]">
              <table className="w-full text-sm">
                <tbody>
                  {specsEntries.map(([key, value], idx) => (
                    <tr
                      key={key}
                      className={idx % 2 === 0 ? "bg-[#F9F9F8] dark:bg-[#1A1A1C]" : "bg-white dark:bg-[#1E1E1E]"}
                    >
                      <td className="px-4 py-3 text-xs text-[#6E6C64] dark:text-[#A0A0A0] w-2/5 capitalize border-r border-[#E8E8E8] dark:border-[#222222]">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </td>
                      {/* `break-words`: a long unbroken value (serial, URL)
                          would otherwise widen the table past the card. */}
                      <td className="px-4 py-3 text-xs font-medium text-[#111111] dark:text-[#FAF5F2] break-words">
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
          <h2 id="product-details-content-heading" className="text-base font-bold text-[#111111] dark:text-[#FAF5F2]">Product Details</h2>
          <div className="mt-3 text-sm leading-relaxed text-[#666666] dark:text-[#A0A0A0] whitespace-pre-line">
            {description}
          </div>
        </div>
      )}

      {/* Image Stream Stack */}
      {images && images.length > 0 && (
        <div className="w-full">
          <h2 className="mb-3 text-base font-bold text-[#111111] dark:text-[#FAF5F2]">Product images & details</h2>
          <div className="flex flex-col gap-3 w-full">
            {images
              .slice()
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((img, idx) => (
                <DescriptionImage key={`${img.url}-${idx}`} url={img.url} alt={img.alt || undefined} />
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
