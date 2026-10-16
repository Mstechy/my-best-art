import { createInstance } from "i18next";
import { initReactI18next, I18nextProvider } from "react-i18next";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/lib/i18n/locales/en.json";
import fr from "@/lib/i18n/locales/fr.json";
import LoginPage from "@/pages/auth/LoginPage";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    role: null,
    signIn: vi.fn().mockResolvedValue({ error: null }),
  }),
}));

async function renderLogin(language: "en" | "fr") {
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    lng: language,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </I18nextProvider>,
  );

  return i18n;
}

describe("authentication language", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the login screen in the selected language", async () => {
    await renderLogin("fr");

    expect(screen.getByRole("heading", { name: "Bon retour." })).toBeInTheDocument();
    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeInTheDocument();
  });

  it("updates login text when the language changes without leaving the page", async () => {
    const i18n = await renderLogin("fr");
    expect(screen.getByRole("button", { name: "Changer de langue" })).toBeInTheDocument();
    await act(async () => {
      await i18n.changeLanguage("en");
    });

    await waitFor(() => {
      expect(i18n.language).toBe("en");
      expect(screen.getByRole("heading", { name: "Welcome back." })).toBeInTheDocument();
    });
  });
});
