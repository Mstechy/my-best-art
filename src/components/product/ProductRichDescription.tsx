import React from "react";
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

  return (
    <section className="w-full max-w-4xl mx-auto">
      {/* Specifications table — AliExpress style, shows before description */}
      {specsEntries && specsEntries.length > 0 && (
        <div className="mb-8">
          <h3 className="text-base font-bold text-[#111111] dark:text-[#FAF5F2] mb-4">Specifications</h3>
          <div className="border border-[#E8E8E8] dark:border-[#222222] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {specsEntries.map(([key, value], idx) => (
                  <tr
                    key={key}
                    className={idx % 2 === 0 ? "bg-[#F9F9F8] dark:bg-[#1A1A1C]" : "bg-white dark:bg-[#1E1E1E]"}
                  >
                    <td className="px-4 py-3 text-xs text-[#888880] dark:text-[#A0A0A0] w-2/5 capitalize border-r border-[#E8E8E8] dark:border-[#222222]">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-[#111111] dark:text-[#FAF5F2]">
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Description text */}
      {description && (
        <div className="mb-8">
          <h3 className="text-base font-bold text-[#111111] dark:text-[#FAF5F2] mb-4">Description</h3>
          <div className="text-sm text-[#666666] dark:text-[#A0A0A0] leading-relaxed whitespace-pre-line">
            {description}
          </div>
        </div>
      )}

      {/* Image Stream Stack */}
      {images && images.length > 0 && (
        <div className="flex flex-col w-full">
          {images
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((img, idx) => (
              <DescriptionImage key={`${img.url}-${idx}`} url={img.url} alt={img.alt || undefined} />
            ))}
        </div>
      )}
    </section>
  );
}
