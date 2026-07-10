import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LucideIcon, ArrowRight } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
  role?: "seller" | "buyer" | "admin" | "default";
  children?: ReactNode;
}

const iconBgFor = (role: Props["role"]) => {
  switch (role) {
    case "seller": return "bg-[#F6C75D]/15 text-[#5C3A00] dark:text-[#F6C75D]";
    case "buyer":  return "bg-blue-50 dark:bg-blue-900/20 text-blue-500";
    case "admin":  return "bg-red-50 dark:bg-red-900/20 text-red-500";
    default:       return "bg-[#F2F3F5] dark:bg-[#1A1A1A] text-[#888880] dark:text-[#A0A0A0]";
  }
};

export default function EmptyState({ icon: Icon, title, description, ctaLabel, ctaHref, onCta, role = "default", children }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl mb-4 ${iconBgFor(role)}`}>
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">{title}</p>
      {description && (
        <p className="mt-1.5 text-xs text-[#888880] dark:text-[#A0A0A0] max-w-xs leading-relaxed">{description}</p>
      )}
      {ctaLabel && (
        ctaHref ? (
          <Link to={ctaHref} className="mt-5">
            <button className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
              {ctaLabel} <ArrowRight className="h-3 w-3" />
            </button>
          </Link>
        ) : (
          <button
            onClick={onCta}
            className="mt-5 flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors"
          >
            {ctaLabel} <ArrowRight className="h-3 w-3" />
          </button>
        )
      )}
      {children}
    </div>
  );
}
