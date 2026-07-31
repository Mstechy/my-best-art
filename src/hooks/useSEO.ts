import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "product" | "organization";
  publishedTime?: string;
  modifiedTime?: string;
}

const SITE_NAME = "MarketHub";
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
}: SEOProps = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    const absoluteUrl = url ? `https://markethub.com${url}` : "https://markethub.com";

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
    setMeta("robots", "index, follow");

    // Open Graph
    setProperty("og:title", fullTitle);
    setProperty("og:description", description);
    setProperty("og:image", image);
    setProperty("og:url", absoluteUrl);
    setProperty("og:type", type);
    setProperty("og:site_name", SITE_NAME);

    // Twitter Card
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);
    setMeta("twitter:image", image);

    // Canonical URL
    setLink("canonical", absoluteUrl);

    // Structured data
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    const structuredData: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": type === "product" ? "Product" : "WebSite",
      name: title || SITE_NAME,
      description,
      ...(type === "product" && image ? { image } : {}),
      ...(type === "organization" ? {
        url: absoluteUrl,
        logo: image,
        sameAs: [
          "https://twitter.com/markethub",
          "https://linkedin.com/company/markethub",
        ],
      } : {}),
      ...(publishedTime ? { datePublished: publishedTime } : {}),
      ...(modifiedTime ? { dateModified: modifiedTime } : {}),
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(structuredData);
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      document.title = SITE_NAME;
    };
  }, [title, description, image, url, type, publishedTime, modifiedTime]);
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
  slug,
}: {
  productName: string;
  price: number;
  currency?: string;
  image?: string;
  description?: string;
  slug: string;
}) {
  return useSEO({
    title: productName,
    description: description || `Buy ${productName} for $${price.toFixed(2)} on MarketHub. Secure escrow payments, buyer protection, fast delivery worldwide.`,
    image: image || DEFAULT_IMAGE,
    url: `/products/${slug}`,
    type: "product",
  });
}