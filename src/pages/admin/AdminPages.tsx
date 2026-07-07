import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, FileText, Eye, Pencil } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Page {
  slug: string;
  title: string;
  body_markdown: string;
  updated_at: string;
}

export default function AdminPages() {
  const { user } = useAuth();
  const [pages, setPages] = useState<Page[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("site_pages" as any).select("*").order("slug");
    const list = (data as any as Page[]) || [];
    setPages(list);
    if (list.length && !activeSlug) {
      setActiveSlug(list[0].slug);
      setTitle(list[0].title);
      setBody(list[0].body_markdown);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectPage = (slug: string) => {
    const p = pages.find(x => x.slug === slug);
    if (!p) return;
    setActiveSlug(slug);
    setTitle(p.title);
    setBody(p.body_markdown);
  };

  const save = async () => {
    if (!activeSlug || !title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("site_pages" as any).update({
      title: title.trim(),
      body_markdown: body,
      updated_by: user?.id ?? null,
    } as any).eq("slug", activeSlug);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Page saved");
    load();
  };

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Site Pages</h1>
          <p className="mt-1 text-muted-foreground">Edit public legal, policy, and info pages. Supports markdown.</p>
        </div>
      </AnimatedSection>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <AnimatedSection variant="fade-up" delay={40}>
          <Card>
            <CardContent className="p-3 space-y-1">
              {loading ? (
                <p className="text-sm text-muted-foreground p-2">Loading…</p>
              ) : pages.map(p => (
                <button
                  key={p.slug}
                  onClick={() => selectPage(p.slug)}
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeSlug === p.slug ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  <span className="truncate flex-1 text-left">{p.title}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection variant="fade-up" delay={80}>
          <Card>
            <CardContent className="p-6 space-y-4">
              {!activeSlug ? (
                <p className="text-muted-foreground text-sm">Select a page to edit.</p>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium">Page Title</label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" />
                    <p className="mt-1 text-xs text-muted-foreground">URL slug: <code className="bg-muted px-1 rounded">/{activeSlug}</code></p>
                  </div>
                  <Tabs defaultValue="edit">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="edit"><Pencil className="h-3.5 w-3.5 mr-1.5" />Edit</TabsTrigger>
                      <TabsTrigger value="preview"><Eye className="h-3.5 w-3.5 mr-1.5" />Preview</TabsTrigger>
                    </TabsList>
                    <TabsContent value="edit" className="mt-3">
                      <Textarea
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        rows={22}
                        className="font-mono text-sm"
                        placeholder="# Heading&#10;&#10;Write content using markdown…"
                      />
                      <p className="mt-2 text-xs text-muted-foreground">Markdown supported: **bold**, *italic*, # headings, - lists, [links](url), tables.</p>
                    </TabsContent>
                    <TabsContent value="preview" className="mt-3">
                      <div className="rounded-lg border border-border/60 bg-background p-6 min-h-[400px] prose prose-sm dark:prose-invert max-w-none [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body || "*Nothing to preview*"}</ReactMarkdown>
                      </div>
                    </TabsContent>
                  </Tabs>
                  <div className="flex justify-end">
                    <Button onClick={save} disabled={saving} className="gap-2 gradient-admin text-primary-foreground">
                      <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Page"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>
    </div>
  );
}
