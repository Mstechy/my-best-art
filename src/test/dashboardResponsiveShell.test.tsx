/**
 * Responsive + accessibility contract for the dashboard shell.
 *
 * Every /admin, /seller and /buyer page renders inside <DashboardLayout>
 * (see AdminRoute / SellerRoute / BuyerRoute in App.tsx), so this single
 * component decides whether the back office is usable on a phone:
 *   - below `lg` the sidebar is off-canvas, reached through a labelled button,
 *     and dismissed by tapping the overlay or a nav link, and
 *   - from `lg` up the same sidebar is permanently pinned and the content
 *     column is offset by its 240px width (`lg:pl-60`), so nothing is covered.
 *
 * jsdom cannot measure layout, so the viewport-specific classes are asserted
 * directly. The interactions are driven through accessible roles and labels,
 * which is also what proves the mobile trigger is reachable without sight.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import DashboardLayout from "@/components/DashboardLayout";

/** Mutable so each test can render the shell for a different stored role. */
const state = vi.hoisted(() => ({ role: "seller" as string | null }));

vi.mock("@/integrations/supabase/client", () => {
  /** Chainable stub: queries and realtime channels never settle or throw. */
  const chain: unknown = new Proxy(function () {}, {
    get: (_target, prop) =>
      prop === "then" ? () => new Promise(() => {}) : chain,
    apply: () => chain,
  });
  return { supabase: chain };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "staff@example.com" },
    session: null,
    profile: {
      id: "profile-1",
      user_id: "user-1",
      email: "staff@example.com",
      full_name: "Test Staff",
      avatar_url: null,
      is_verified: true,
      is_banned: false,
      is_frozen: false,
      is_approved: true,
      country: null,
      preferred_currency: null,
    },
    role: state.role,
    loading: false,
    signUp: async () => ({ error: null }),
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    refetchProfile: async () => {},
  }),
}));

vi.mock("@/hooks/useUnreadMessages", () => ({ useUnreadMessages: () => 0 }));

function renderShell(role: string | null = "seller") {
  state.role = role;
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DashboardLayout>
        <p>Dashboard body</p>
      </DashboardLayout>
    </MemoryRouter>,
  );
}

function sidebar() {
  const element = document.getElementById("dashboard-sidebar");
  if (!element) throw new Error("dashboard sidebar (#dashboard-sidebar) is not rendered");
  return element;
}

/** The tap-out overlay is the shell's only element with a scrim colour. */
function overlay() {
  const root = sidebar().parentElement;
  if (!root) throw new Error("dashboard shell root is not rendered");
  return Array.from(root.children).find((child) => child.className.includes("bg-black/40")) as HTMLElement | undefined;
}

describe("dashboard shell across viewports", () => {
  it("keeps the sidebar off-canvas below lg and pinned from lg up", () => {
    renderShell();

    const drawer = sidebar();
    expect(drawer.className).toContain("w-60");
    expect(drawer.className).toContain("-translate-x-full");
    expect(drawer.className).toContain("lg:translate-x-0");

    // The trigger exists but is mobile-only, and announces what it controls.
    const trigger = screen.getByRole("button", { name: /open dashboard navigation/i });
    expect(trigger.className).toContain("lg:hidden");
    expect(trigger).toHaveAttribute("aria-controls", "dashboard-sidebar");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    // Desktop content is offset by the sidebar width so nothing is covered.
    expect(screen.getByRole("main").parentElement?.className).toContain("lg:pl-60");
    expect(screen.getByText("Dashboard body")).toBeInTheDocument();
  });

  it("opens from the mobile trigger, closes on the overlay and on the close button", () => {
    renderShell();
    const trigger = screen.getByRole("button", { name: /open dashboard navigation/i });

    fireEvent.click(trigger);
    expect(sidebar().className).toContain("translate-x-0");
    expect(sidebar().className).not.toContain("-translate-x-full");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Overlay is part of the mobile experience only.
    expect(overlay()?.className).toContain("lg:hidden");
    fireEvent.click(overlay() as HTMLElement);
    expect(sidebar().className).toContain("-translate-x-full");

    // The in-drawer close button is labelled for screen readers.
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: /close dashboard navigation/i }));
    expect(sidebar().className).toContain("-translate-x-full");
  });

  it("closes the drawer after a nav link is tapped", () => {
    renderShell("seller");

    fireEvent.click(screen.getByRole("button", { name: /open dashboard navigation/i }));
    fireEvent.click(screen.getByRole("link", { name: "Products" }));

    expect(sidebar().className).toContain("-translate-x-full");
  });

  it("renders the navigation that matches the signed-in role", () => {
    renderShell("seller");
    expect(screen.getByRole("link", { name: "Store Profile" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Site Pages" })).not.toBeInTheDocument();

    cleanup();
    renderShell("admin");
    expect(screen.getByRole("link", { name: "Site Pages" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Store Profile" })).not.toBeInTheDocument();
  });
});
