import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageCircleQuestion, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { maskName } from "@/lib/productContent";
import { useNavigate } from "react-router-dom";

interface Question {
  id: string;
  product_id: string;
  asker_id: string;
  question: string;
  created_at: string;
  asker_name?: string | null;
  answer?: { body: string; created_at: string } | null;
}

export default function QAndASection({ productId }: { productId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("product_questions")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    const list = (data || []) as any[];
    if (list.length === 0) { setQuestions([]); return; }
    const [{ data: profs }, { data: answers }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name").in("user_id", list.map(q => q.asker_id)),
      (supabase as any).from("product_question_answers").select("*").in("question_id", list.map(q => q.id)),
    ]);
    const nameMap: Record<string, string> = {};
    (profs || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });
    const ansMap: Record<string, any> = {};
    (answers || []).forEach((a: any) => { if (!ansMap[a.question_id]) ansMap[a.question_id] = a; });
    setQuestions(list.map(q => ({ ...q, asker_name: nameMap[q.asker_id], answer: ansMap[q.id] || null })));
  };

  useEffect(() => { if (productId) load(); }, [productId]);

  const submit = async () => {
    if (!user) { navigate(`/auth/login?redirect=${encodeURIComponent(`/product/${productId}`)}`); return; }
    if (text.trim().length < 5) { toast.error("Question is too short"); return; }
    setSubmitting(true);
    const { error } = await (supabase as any).from("product_questions").insert({
      product_id: productId,
      asker_id: user.id,
      question: text.trim(),
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Question posted — the seller will be notified");
    setText(""); setOpen(false); load();
  };

  return (
    <section id="qa" className="mt-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageCircleQuestion className="h-5 w-5 text-primary" /> Questions & Answers
          {questions.length > 0 && <span className="text-base font-normal text-muted-foreground">({questions.length})</span>}
        </h2>
        <Button onClick={() => setOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1">
          <MessageCircle className="h-4 w-4" /> Ask a Question
        </Button>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No questions yet — be the first to ask about this product.
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map(q => (
            <div key={q.id} className="rounded-xl border border-border/60 p-4 bg-card">
              <div className="text-sm text-foreground font-medium whitespace-pre-wrap">Q: {q.question}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {maskName(q.asker_name)} · {new Date(q.created_at).toLocaleDateString()}
              </div>
              {q.answer ? (
                <div className="mt-3 rounded-lg bg-muted/50 border-l-2 border-primary p-3">
                  <div className="text-xs font-semibold text-foreground mb-1">A: Seller Reply</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">{q.answer.body}</div>
                </div>
              ) : (
                <span className="mt-3 inline-block rounded-full bg-muted text-muted-foreground text-[10px] px-2 py-0.5">
                  Awaiting answer
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ask a question</DialogTitle></DialogHeader>
          <Textarea rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="Ask the seller anything about this product…" />
          <Button onClick={submit} disabled={submitting} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {submitting ? "Posting…" : "Post Question"}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
