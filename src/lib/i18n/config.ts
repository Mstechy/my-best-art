import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { readMigrated } from "@/lib/legacyBrandStorage";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

const SUPPORTED_LANGUAGES = ["en", "fr"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  fr: "Français",
};

// One-time rebrand migration: the chosen language used to be cached under the
// pre-Tradibu key. The detector below only reads the current key, so the value
// is copied forward (and the legacy entry dropped) before init runs.
if (typeof window !== "undefined") {
  readMigrated("tradibu_language", "markethub_language");
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "fr"],
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "tradibu_language",
    },
    interpolation: {
      escapeValue: false,
    },
    returnObjects: false,
  });

i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
});

export default i18n;