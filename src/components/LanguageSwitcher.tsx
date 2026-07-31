import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { LANGUAGE_NAMES, type SupportedLanguage } from "@/lib/i18n/config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const currentLang = i18n.language?.split("-")[0] || "en";
  const supported = Object.keys(LANGUAGE_NAMES) as SupportedLanguage[];

  const switchLanguage = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 rounded-full p-0"
          aria-label="Switch language"
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        {supported.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => switchLanguage(lang)}
            className={`cursor-pointer text-sm ${currentLang === lang ? "font-bold text-primary" : ""}`}
          >
            {LANGUAGE_NAMES[lang]}
            {currentLang === lang && " ✓"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}