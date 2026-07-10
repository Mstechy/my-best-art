import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
    <section id="qa" className="mt-10 px-4 md:px-0">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] flex items-center gap-1.5">
          <MessageCircleQuestion className="h-4.5 w-4.5 text-[#F6C75D]" /> Questions & Answers
          {questions.length > 0 && <span className="text-xs font-normal text-[#888880] ml-1">({questions.length})</span>}
        </h2>
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
          <MessageCircle className="h-3.5 w-3.5" /> Ask a Question
        </button>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-8 text-[#888880]">
          <MessageCircleQuestion className="h-6 w-6 mx-auto mb-2 text-[#C0C0B8]/40" />
          <p className="text-xs">No questions yet — be the first to ask about this product.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map(q => (
            <div key={q.id} className="rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm">
              <div className="text-xs text-[#111111] dark:text-[#FAF5F2] font-bold whitespace-pre-wrap leading-relaxed">Q: {q.question}</div>
              <div className="mt-2 text-[10px] font-semibold text-[#888880]">
                {maskName(q.asker_name)} · {new Date(q.created_at).toLocaleDateString()}
              </div>
              {q.answer ? (
                <div className="mt-4 rounded-xl bg-[#FAFAFA] dark:bg-[#111111] border border-[#E8E8E8] dark:border-[#2A2A2A] p-4">
                  <div className="text-[10px] font-bold text-[#F6C75D] uppercase tracking-wider mb-2">A: Seller Reply</div>
                  <div className="text-xs text-[#888880] whitespace-pre-wrap leading-relaxed">{q.answer.body}</div>
                </div>
              ) : (
                <span className="mt-4 inline-block rounded-full bg-[#FAFAFA] dark:bg-[#111111] border border-[#E8E8E8] dark:border-[#2A2A2A] text-[#888880] text-[10px] font-semibold px-3 py-1">
                  Awaiting answer
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-[#1A1A1A] border-[#E8E8E8] dark:border-[#222222] p-6 rounded-3xl">
          <DialogHeader><DialogTitle className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">Ask a question</DialogTitle></DialogHeader>
          <div className="pt-2">
            <textarea 
              rows={4} 
              value={text} 
              onChange={e => setText(e.target.value)} 
              placeholder="Ask the seller anything about this product…" 
              className="w-full mb-4 p-3 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-xs text-[#111111] dark:text-[#FAF5F2] outline-none resize-none"
            />
            <button onClick={submit} disabled={submitting} className="w-full flex items-center justify-center gap-1.5 px-5 py-3 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors disabled:opacity-50">
              {submitting ? "Posting…" : "Post Question"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
