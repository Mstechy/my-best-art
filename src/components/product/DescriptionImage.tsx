import React from "react";

type DescriptionImageProps = {
  url: string;
  alt?: string | null;
  className?: string;
};

export default function DescriptionImage({ url, alt, className = "" }: DescriptionImageProps) {
  return (
    <div className={`relative w-full bg-gray-100 dark:bg-gray-800 overflow-hidden rounded-lg mb-2 min-h-[200px] ${className}`}>
      <img
        src={url}
        alt={alt || "Product detail description graphic"}
        loading="lazy"
        decoding="async"
        className="w-full h-auto object-cover transition-opacity duration-300 opacity-0 data-[loaded=true]:opacity-100"
        onLoad={(e) => e.currentTarget.setAttribute("data-loaded", "true")}
      />
    </div>
  );
}
