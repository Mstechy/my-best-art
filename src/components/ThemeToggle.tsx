import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPreferredTheme, saveTheme } from "@/lib/theme";

export default function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(() => getPreferredTheme() === "dark");

  const toggleTheme = () => {
    const nextDark = !dark;
    setDark(nextDark);
    saveTheme(nextDark ? "dark" : "light");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={className}
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
