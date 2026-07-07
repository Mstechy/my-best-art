import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LegalLayout from "@/components/LegalLayout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Props {
  slug: string;
  fallbackTitle: string;
}

export default function DynamicPage({ slug, fallbackTitle }: Props) {
  const [title, setTitle] = useState(fallbackTitle);
  const [body, setBody] = useState<string>("");
  const [updated, setUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);

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
