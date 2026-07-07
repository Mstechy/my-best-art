import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, MessageSquare, MessageCircleQuestion } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { maskName } from "@/lib/productContent";

interface ReviewRow {
  id: string;
  rating: number;
  body: string | null;
  title: string | null;
  created_at: string;
  user_id: string;
  product_id: string;
  buyer_name?: string;
  product_title?: string;
  reply?: string | null;
}

export default function SellerReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    if (!user) return;
    const { data: prods } = await supabase.from("products").select("id, title").eq("seller_id", user.id);
    const ids = (prods || []).map((p) => p.id);
    if (ids.length === 0) { setReviews([]); setLoading(false); return; }
    const titleMap: Record<string, string> = {};
    (prods || []).forEach((p: any) => { titleMap[p.id] = p.title; });

    const { data: revs } = await supabase
      .from("reviews")
      .select("*")
      .in("product_id", ids)
      .order("created_at", { ascending: false });

    const list = (revs || []) as any[];
    const userIds = [...new Set(list.map((r) => r.user_id))];
    const reviewIds = list.map((r) => r.id);
    const [{ data: profs }, { data: replies }] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("user_id, full_name").in("user_id", userIds) : Promise.resolve({ data: [] as any[] }),
      reviewIds.length ? supabase.from("review_replies" as any).select("*").in("review_id", reviewIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const profMap: Record<string, string> = {};
    (profs as any[] || []).forEach((p: any) => { profMap[p.user_id] = p.full_name || "Buyer"; });
    const replyMap: Record<string, string> = {};
    (replies as any[] || []).forEach((r: any) => { replyMap[r.review_id] = r.body; });

    setReviews(list.map((r) => ({
      ...r,
      buyer_name: profMap[r.user_id] || "Buyer",
      product_title: titleMap[r.product_id] || "Product",
      reply: replyMap[r.id] || null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const submitReply = async (reviewId: string) => {
    if (!user) return;
    const body = (drafts[reviewId] || "").trim();
    if (!body) return;
    const { error } = await supabase.from("review_replies" as any).insert({ review_id: reviewId, seller_id: user.id, body } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Reply posted");
    setDrafts((d) => ({ ...d, [reviewId]: "" }));
    load();
  };

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Reviews</h1>
        <p className="mt-1 text-muted-foreground">Buyer feedback on your products</p>
      </div>

      <Card>
        <CardContent className="p-6 flex items-center gap-6">
          <div className="text-center">
            <p className="font-display text-4xl font-bold text-foreground">{avg.toFixed(1)}</p>
            <div className="flex items-center justify-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`h-4 w-4 ${s <= Math.round(avg) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`} />
              ))}
            </div>
          </div>
          <div className="border-l border-border pl-6">
            <p className="text-sm text-muted-foreground">Total reviews</p>
            <p className="font-display text-2xl font-bold text-foreground">{reviews.length}</p>
          </div>
        </CardContent>
      </Card>

      {reviews.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No reviews yet" description="Reviews will appear as buyers receive their orders." role="seller" />
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-display">{r.title || r.product_title}</CardTitle>
                      <span className="text-xs text-muted-foreground">on {r.product_title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`h-3 w-3 ${s <= r.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{r.buyer_name} · {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {r.body && <p className="text-sm text-foreground">{r.body}</p>}
                {r.reply ? (
                  <div className="mt-3 rounded-lg border-l-2 border-seller bg-muted/40 p-3">
                    <p className="text-xs font-semibold text-foreground mb-1">Your reply</p>
                    <p className="text-sm text-muted-foreground">{r.reply}</p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      placeholder="Reply to this review…"
                      value={drafts[r.id] || ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                      rows={2}
                    />
                    <Button size="sm" onClick={() => submitReply(r.id)} className="gradient-seller text-primary-foreground">
                      Post Reply
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SellerQuestionsBoard />
    </div>
  );
}

function SellerQuestionsBoard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: prods } = await supabase.from("products").select("id, title").eq("seller_id", user.id);
    const ids = (prods || []).map((p) => p.id);
    if (!ids.length) { setRows([]); setLoading(false); return; }
    const titleMap: Record<string, string> = {};
    (prods || []).forEach((p: any) => { titleMap[p.id] = p.title; });
    const { data: qs } = await (supabase as any).from("product_questions").select("*").in("product_id", ids).order("created_at", { ascending: false });
    const list = (qs || []) as any[];
    if (!list.length) { setRows([]); setLoading(false); return; }
    const [{ data: profs }, { data: answers }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name").in("user_id", list.map((q: any) => q.asker_id)),
      (supabase as any).from("product_question_answers").select("*").in("question_id", list.map((q: any) => q.id)),
    ]);
    const nameMap: Record<string, string> = {};
    (profs || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name || "Buyer"; });
    const ansMap: Record<string, any> = {};
    (answers || []).forEach((a: any) => { if (!ansMap[a.question_id]) ansMap[a.question_id] = a; });
    setRows(list.map((q) => ({
      ...q,
      product_title: titleMap[q.product_id],
      asker_name: nameMap[q.asker_id],
      answer: ansMap[q.id] || null,
    })));
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  const submit = async (qid: string) => {
    if (!user) return;
    const body = (drafts[qid] || "").trim();
    if (body.length < 3) return;
    const { error } = await (supabase as any).from("product_question_answers").insert({
      question_id: qid,
      answerer_id: user.id,
      body,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Answer posted");
    setDrafts((d) => ({ ...d, [qid]: "" }));
    load();
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <MessageCircleQuestion className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold text-foreground">Buyer Questions</h2>
        <span className="text-sm text-muted-foreground">({rows.length})</span>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={MessageCircleQuestion} title="No questions yet" description="Buyer questions on your products will appear here." role="seller" />
      ) : (
        <div className="space-y-3">
          {rows.map((q) => (
            <Card key={q.id}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">on {q.product_title}</p>
                <p className="mt-1 text-sm text-foreground font-medium">Q: {q.question}</p>
                <p className="mt-1 text-xs text-muted-foreground">{maskName(q.asker_name)} · {new Date(q.created_at).toLocaleDateString()}</p>
                {q.answer ? (
                  <div className="mt-3 rounded-lg border-l-2 border-primary bg-muted/40 p-3">
                    <p className="text-xs font-semibold text-foreground mb-1">Your answer</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.answer.body}</p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Textarea placeholder="Answer this question…" value={drafts[q.id] || ""} onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))} rows={2} />
                    <Button size="sm" onClick={() => submit(q.id)} className="gradient-seller text-primary-foreground">Post Answer</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
