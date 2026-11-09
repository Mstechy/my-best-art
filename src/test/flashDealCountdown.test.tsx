import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FlashDealCountdown from "@/components/FlashDealCountdown";

describe("FlashDealCountdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides an expired promotion instead of showing a zeroed timer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T12:00:00.000Z"));

    render(<FlashDealCountdown endAt="2026-11-09T11:59:59.000Z" />);

    expect(screen.queryByText("00d")).not.toBeInTheDocument();
    expect(screen.queryByText("00h")).not.toBeInTheDocument();
  });
});
