import { Link } from "react-router-dom";
import { Sparkles, Flame, Tag, Zap, Truck, Gift } from "lucide-react";

const ICONS = { sparkles: Sparkles, flame: Flame, tag: Tag, zap: Zap, truck: Truck, gift: Gift } as const;
type IconKey = keyof typeof ICONS;

interface MarqueeItem {
  label: string;
  promo: string;
  icon: IconKey;
}

const ITEMS: MarqueeItem[] = [
  { label: "20% Off Summer Sale", promo: "summer20", icon: "sparkles" },
  { label: "Hot Deals — Up to 50% Off", promo: "hot50", icon: "flame" },
  { label: "Free Shipping on Orders $50+", promo: "freeship", icon: "truck" },
  { label: "New Arrivals This Week", promo: "new", icon: "zap" },
  { label: "Bundle & Save 15%", promo: "bundle15", icon: "tag" },
  { label: "Gift Cards Now Available", promo: "gifts", icon: "gift" },
];

function Track({ items }: { items: MarqueeItem[] }) {
  return (
    <div className="flex shrink-0 items-center gap-8 px-4">
      {items.map((it, i) => {
        const Icon = ICONS[it.icon];
        return (
          <Link
            key={`${it.promo}-${i}`}
            to={`/marketplace?promo=${encodeURIComponent(it.promo)}`}
            className="group inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium text-primary-foreground/95 hover:text-primary-foreground transition-colors"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-90 group-hover:opacity-100" />
            <span className="group-hover:underline underline-offset-4">{it.label}</span>
            <span aria-hidden="true" className="opacity-40">•</span>
          </Link>
        );
      })}
    </div>
  );
}

export default function MarqueeBanner() {
  return (
    <div
      className="group relative overflow-hidden border-y border-primary/30 bg-gradient-to-r from-primary via-primary to-accent"
      aria-label="Promotions"
    >
      <div className="flex w-max animate-[marquee_40s_linear_infinite] py-2.5 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        <Track items={ITEMS} />
        <Track items={ITEMS} />
      </div>
      <style>{`@keyframes marquee { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50%,0,0); } }`}</style>
    </div>
  );
}
