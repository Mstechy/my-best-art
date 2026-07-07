import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MessageSquare, Shield, ScaleIcon } from "lucide-react";
import { toast } from "sonner";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import SiteFooter from "@/components/SiteFooter";
import AnimatedSection from "@/components/AnimatedSection";

const contacts = [
  { icon: MessageSquare, label: "Support", email: "support@markethub.com", desc: "Order help and general questions" },
  { icon: Shield, label: "Privacy", email: "privacy@markethub.com", desc: "Data and privacy requests" },
  { icon: ScaleIcon, label: "Legal", email: "legal@markethub.com", desc: "Policy and legal matters" },
];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || message.trim().length < 10) {
      toast.error("Please fill all fields with valid info (message ≥ 10 chars).");
      return;
    }
    setSubmitting(true);
    const subject = encodeURIComponent(`MarketHub contact from ${name.trim()}`);
    const body = encodeURIComponent(`${message.trim()}\n\n— ${name.trim()} <${email.trim()}>`);
    window.location.href = `mailto:support@markethub.com?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Opening your email client…");
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketplaceNavbar />
      <main className="flex-1 mx-auto max-w-5xl w-full px-4 lg:px-8 py-12">
        <AnimatedSection variant="fade-up">
          <h1 className="font-display text-4xl font-bold text-foreground">Contact MarketHub</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            We're here to help with orders, disputes, or any questions about using the platform.
          </p>
        </AnimatedSection>

        <div className="grid gap-6 lg:grid-cols-3 mt-8">
          {contacts.map((c, i) => (
            <AnimatedSection key={c.label} variant="fade-up" delay={i * 60}>
              <a href={`mailto:${c.email}`} className="block rounded-2xl border border-border/60 bg-card p-5 card-hover">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
                  <c.icon className="h-5 w-5" />
                </div>
                <p className="font-display text-base font-semibold text-foreground">{c.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
                <p className="mt-3 text-sm text-primary truncate">{c.email}</p>
              </a>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection variant="fade-up" delay={200}>
          <form onSubmit={submit} className="mt-10 rounded-2xl border border-border/60 bg-card p-6 space-y-4">
            <h2 className="font-display text-xl font-semibold text-foreground flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Send us a message
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Your name</label>
                <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} className="mt-1 h-11" />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value.slice(0, 200))} className="mt-1 h-11" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Message</label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 2000))} rows={6} className="mt-1" />
              <p className="text-right text-[10px] text-muted-foreground mt-1">{message.length}/2000</p>
            </div>
            <Button type="submit" disabled={submitting} className="gradient-primary text-primary-foreground">
              {submitting ? "Sending…" : "Send message"}
            </Button>
          </form>
        </AnimatedSection>
      </main>
      <SiteFooter />
    </div>
  );
}
