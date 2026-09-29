import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LegalLayout from "@/components/LegalLayout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { buildLegalPageDescription, canonicalPathFor } from "@/lib/pageSeo";

interface Props {
  slug: string;
  fallbackTitle: string;
}

export default function DynamicPage({ slug, fallbackTitle }: Props) {
  const { pathname } = useLocation();
  const [title, setTitle] = useState(fallbackTitle);
  const [body, setBody] = useState<string>("");
  const [updated, setUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Ten routes render through this component - the seven `site_pages` rows plus
  // the four alias paths - and until now not one of them declared a canonical,
  // so a crawler was told every policy page was a duplicate of the homepage.
  //
  // The canonical is resolved through the registry rather than taken from
  // `pathname`, because `/faq` and `/cookies` and `/seller-agreement` are second
  // names for pages that already exist under their own URL: standing on their
  // own feet would put four pairs of identical documents into the index. See
  // LEGAL_PAGES in src/lib/pageSeo.ts.
  //
  // The description is derived from the same body the visitor is reading, by the
  // same builder the build-time prerenderer calls, so the static file and this
  // render publish one description rather than two guesses at one.
  useSEO({
    title,
    description: buildLegalPageDescription(fallbackTitle, body),
    url: canonicalPathFor(pathname),
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("site_pages" as any)
        .select("title, body_markdown, updated_at")
        .eq("slug", slug)
        .maybeSingle();
      if (data) {
        const d = data as any;
        setTitle(d.title || fallbackTitle);
        setBody(d.body_markdown || "");
        setUpdated(d.updated_at ? `Last updated: ${new Date(d.updated_at).toLocaleDateString()}` : "");
      }
      setLoading(false);
    })();
  }, [slug, fallbackTitle]);

  return (
    <LegalLayout title={title} updated={updated}>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : body.trim().length === 0 ? (
        <p className="text-muted-foreground italic">This page has not been published yet.</p>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      )}
    </LegalLayout>
  );
}
