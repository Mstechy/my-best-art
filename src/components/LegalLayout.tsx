import { ReactNode } from "react";
import MarketplaceNavbar from "./MarketplaceNavbar";
import SiteFooter from "./SiteFooter";
import AnimatedSection from "./AnimatedSection";

interface Props {
  title: string;
  updated?: string;
  children: ReactNode;
}

export default function LegalLayout({ title, updated, children }: Props) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketplaceNavbar />
      <main className="flex-1 mx-auto max-w-3xl w-full px-4 lg:px-8 py-12">
        <AnimatedSection variant="fade-up">
          <h1 className="font-display text-4xl font-bold text-foreground">{title}</h1>
          {updated && <p className="mt-2 text-sm text-muted-foreground">{updated}</p>}
        </AnimatedSection>
        <AnimatedSection variant="fade-up" delay={80}>
          <article className="prose prose-invert max-w-none mt-8 space-y-6 text-sm leading-relaxed text-foreground/90 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground [&_ul]:space-y-1 [&_a]:text-primary">
            {children}
          </article>
        </AnimatedSection>
      </main>
      <SiteFooter />
    </div>
  );
}
