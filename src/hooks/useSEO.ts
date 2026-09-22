import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "product" | "organization";
  publishedTime?: string;
  modifiedTime?: string;
  structuredData?: Record<string, unknown>;
}

const SITE_NAME = "Tradibu";
const SITE_URL = "https://www.tradibu.com";
const DEFAULT_DESCRIPTION = "Connecting buyers with verified independent merchants worldwide. Shop with total peace of mind using secure escrow payments, buyer protection guarantees, and fast global delivery.";
const DEFAULT_IMAGE = "/placeholder.svg";

export function useSEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = "website",
  publishedTime,
  modifiedTime,
  structuredData,
}: SEOProps = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    const absoluteUrl = url ? new URL(url, SITE_URL).toString() : SITE_URL;
    const absoluteImage = image.startsWith("http") ? image : new URL(image, SITE_URL).toString();

    // Update document title
    document.title = fullTitle;

    // Update or create meta tags
    const setMeta = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement("meta");
        tag.name = name;
        document.head.appendChild(tag);
      }
      tag.content = content;
    };

    const setProperty = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      tag.content = content;
    };

    const setLink = (rel: string, href: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
    };

    // Basic meta tags
    setMeta("description", description);
    setMeta("keywords", "marketplace, ecommerce, buy online, independent merchants, escrow payments, buyer protection");
    setMeta("author", SITE_NAME);
    setMeta("robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");

    // Open Graph
    setProperty("og:title", fullTitle);
    setProperty("og:description", description);
    setProperty("og:image", absoluteImage);
    setProperty("og:url", absoluteUrl);
    setProperty("og:type", type);
    setProperty("og:site_name", SITE_NAME);

    // Twitter Card
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);
    setMeta("twitter:image", absoluteImage);

    // Canonical URL
    setLink("canonical", absoluteUrl);

    // Structured data
    const existingScript = document.querySelector('#page-structured-data');
    if (existingScript) {
      existingScript.remove();
    }

    const schemaData: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": type === "organization" ? "Organization" : "WebSite",
      name: title || SITE_NAME,
      description,
      ...(type === "product" && image ? { image: absoluteImage } : {}),
      ...(type === "organization" ? {
        url: absoluteUrl,
        logo: absoluteImage,
        sameAs: [
          "https://twitter.com/tradibu",
          "https://linkedin.com/company/tradibu",
        ],
      } : {}),
      ...(publishedTime ? { datePublished: publishedTime } : {}),
      ...(modifiedTime ? { dateModified: modifiedTime } : {}),
      ...structuredData,
    };

    const script = document.createElement("script");
    script.id = "page-structured-data";
    script.type = "application/ld+json";
    script.text = JSON.stringify(schemaData);
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      document.title = SITE_NAME;
    };
  }, [title, description, image, url, type, publishedTime, modifiedTime, structuredData]);
}

/**
 * Convenience hook for product pages
 */
export function useProductSEO({
  productName,
  price,
  currency = "USD",
  image,
  description,
  id,
  availability,
  rating,
  reviewCount,
  brand,
}: {
  productName: string;
  price: number;
  currency?: string;
  image?: string;
  description?: string;
  id: string;
  availability?: "InStock" | "OutOfStock";
  rating?: number;
  reviewCount?: number;
  brand?: string | null;
}) {
  return useSEO({
    title: productName,
    description: description || `Buy ${productName} for $${price.toFixed(2)} on Tradibu. Secure escrow payments, buyer protection, fast delivery worldwide.`,
    image: image || DEFAULT_IMAGE,
    url: `/product/${id}`,
    type: "product",
    structuredData: {
      "@type": "Product",
      name: productName,
      image: image ? [image.startsWith("http") ? image : new URL(image, SITE_URL).toString()] : undefined,
      description: description || `Buy ${productName} on Tradibu.`,
      ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
      offers: {
        "@type": "Offer",
        url: new URL(`/product/${id}`, SITE_URL).toString(),
        priceCurrency: currency,
        price: price.toFixed(2),
        availability: `https://schema.org/${availability || "InStock"}`,
        itemCondition: "https://schema.org/NewCondition",
      },
      ...(rating && reviewCount ? {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: rating.toFixed(1),
          reviewCount,
        },
      } : {}),
    },
  });
}
