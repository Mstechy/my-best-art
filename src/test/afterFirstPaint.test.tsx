/**
 * Regression guard for AfterFirstPaint.
 *
 * The audit that motivated this component showed 88% of Largest Contentful
 * Paint was Render Delay - the hero image had decoded in 263 ms and still did
 * not paint for over five seconds because the main thread was busy. The fix was
 * to stop the realtime notification subscription and the analytics beacon from
 * mounting during boot.
 *
 * That optimisation is invisible in a unit test but easy to undo by accident:
 * swapping `load` for a timer, or dropping the "already loaded" branch, would
 * put the work back on the critical path with no test failing. These tests pin
 * the two halves of the contract - deferred on a cold load, immediate once the
 * document has finished loading.
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AfterFirstPaint from "@/components/AfterFirstPaint";

/**
 * jsdom implements requestAnimationFrame as a timer, so a stub that runs the
 * callback synchronously makes the double-frame hop deterministic and lets the
 * test assert the real ordering instead of racing a fake clock.
 */
function installFrameStub() {
  const original = window.requestAnimationFrame;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof window.requestAnimationFrame;
  return () => {
    window.requestAnimationFrame = original;
  };
}

function setReadyState(value: DocumentReadyState) {
  Object.defineProperty(document, "readyState", { value, configurable: true });
}

describe("AfterFirstPaint", () => {
  let restoreFrames: () => void;

  beforeEach(() => {
    restoreFrames = installFrameStub();
  });

  afterEach(() => {
    restoreFrames();
    setReadyState("complete");
  });

  it("holds children back until the document has loaded and painted", () => {
    setReadyState("loading");
    render(
      <AfterFirstPaint>
        <div>realtime work</div>
      </AfterFirstPaint>
    );

    // Mounted, but nothing is on screen yet: this is the whole point.
    expect(screen.queryByText("realtime work")).toBeNull();

    act(() => {
      window.dispatchEvent(new Event("load"));
    });

    expect(screen.getByText("realtime work")).toBeInTheDocument();
  });

  it("mounts children immediately when the document already finished loading", () => {
    // A client-side navigation after the first view must not be held back,
    // otherwise offer toasts and analytics would stay dead for the session.
    setReadyState("complete");
    render(
      <AfterFirstPaint>
        <div>realtime work</div>
      </AfterFirstPaint>
    );

    expect(screen.getByText("realtime work")).toBeInTheDocument();
  });

  it("does not leave a load listener behind after unmount", () => {
    setReadyState("loading");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(
      <AfterFirstPaint>
        <div>realtime work</div>
      </AfterFirstPaint>
    );

    unmount();

    const removedLoad = removeSpy.mock.calls.some(([event]) => event === "load");
    expect(removedLoad).toBe(true);
    removeSpy.mockRestore();
  });
});
