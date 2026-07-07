import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

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

const gradientFor = (role: Props["role"]) => {
  switch (role) {
    case "seller": return "gradient-seller text-primary-foreground shadow-glow-seller";
    case "buyer": return "gradient-buyer text-primary-foreground shadow-glow-buyer";
    case "admin": return "gradient-admin text-primary-foreground";
    default: return "gradient-primary text-primary-foreground";
  }
};

export default function EmptyState({ icon: Icon, title, description, ctaLabel, ctaHref, onCta, role = "default", children }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${gradientFor(role)} mb-4`}>
        <Icon className="h-7 w-7" />
      </div>
      <p className="font-display font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-xs">{description}</p>}
      {ctaLabel && (ctaHref ? (
        <Link to={ctaHref} className="mt-4">
          <Button className={`gap-2 ${gradientFor(role)}`}>{ctaLabel}</Button>
        </Link>
      ) : (
        <Button onClick={onCta} className={`mt-4 gap-2 ${gradientFor(role)}`}>{ctaLabel}</Button>
      ))}
      {children}
    </div>
  );
}
