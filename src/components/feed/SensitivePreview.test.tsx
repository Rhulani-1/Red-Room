import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import SensitivePreviewSection from "./SensitivePreview";

// Stub scrollIntoView (not implemented in JSDOM)
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const ANNOUNCER_DEBOUNCE_MS = 200;

const getAnnouncer = () =>
  document.querySelector('[aria-live="polite"]') as HTMLElement;

const renderSection = () =>
  render(
    <SensitivePreviewSection
      isSensitive={true}
      postType="text"
      caption="hello world"
    />,
  );

describe("SensitivePreview live announcer", () => {
  it("starts on Hide preview (index 0)", () => {
    renderSection();
    act(() => {
      vi.advanceTimersByTime(ANNOUNCER_DEBOUNCE_MS);
    });
    expect(getAnnouncer().textContent).toMatch(/Showing Hide preview, 1 of 3/);
  });

  it("updates after dot tab tap (Blur)", () => {
    renderSection();
    const blurTab = screen.getByRole("tab", { name: /Show Blur preview/i });
    fireEvent.click(blurTab);
    act(() => {
      vi.advanceTimersByTime(ANNOUNCER_DEBOUNCE_MS);
    });
    expect(getAnnouncer().textContent).toMatch(/Showing Blur preview, 2 of 3/);
  });

  it("updates after dot tab tap (Show)", () => {
    renderSection();
    const showTab = screen.getByRole("tab", { name: /Show Show preview/i });
    fireEvent.click(showTab);
    act(() => {
      vi.advanceTimersByTime(ANNOUNCER_DEBOUNCE_MS);
    });
    expect(getAnnouncer().textContent).toMatch(/Showing Show preview, 3 of 3/);
  });

  it("updates with ArrowRight keyboard navigation", () => {
    renderSection();
    const firstSlide = screen.getAllByRole("group", { name: /1 of 3/ })[0];
    fireEvent.keyDown(firstSlide, { key: "ArrowRight" });
    act(() => {
      vi.advanceTimersByTime(ANNOUNCER_DEBOUNCE_MS);
    });
    expect(getAnnouncer().textContent).toMatch(/Showing Blur preview, 2 of 3/);
  });

  it("updates with End/Home keyboard navigation", () => {
    renderSection();
    const firstSlide = screen.getAllByRole("group", { name: /1 of 3/ })[0];
    fireEvent.keyDown(firstSlide, { key: "End" });
    act(() => {
      vi.advanceTimersByTime(ANNOUNCER_DEBOUNCE_MS);
    });
    expect(getAnnouncer().textContent).toMatch(/Showing Show preview, 3 of 3/);

    const lastSlide = screen.getAllByRole("group", { name: /3 of 3/ })[0];
    fireEvent.keyDown(lastSlide, { key: "Home" });
    act(() => {
      vi.advanceTimersByTime(ANNOUNCER_DEBOUNCE_MS);
    });
    expect(getAnnouncer().textContent).toMatch(/Showing Hide preview, 1 of 3/);
  });

  it("debounces rapid changes and announces only the settled slide", () => {
    renderSection();
    const hideTab = screen.getByRole("tab", { name: /Show Hide preview/i });
    const blurTab = screen.getByRole("tab", { name: /Show Blur preview/i });
    const showTab = screen.getByRole("tab", { name: /Show Show preview/i });

    // Rapidly flip between slides within the debounce window
    fireEvent.click(blurTab);
    act(() => { vi.advanceTimersByTime(50); });
    fireEvent.click(showTab);
    act(() => { vi.advanceTimersByTime(50); });
    fireEvent.click(hideTab);
    act(() => { vi.advanceTimersByTime(50); });
    fireEvent.click(showTab);

    // Before debounce settles, announcer should NOT yet reflect "Show"
    expect(getAnnouncer().textContent).not.toMatch(/Showing Show preview/);

    // Let it settle
    act(() => { vi.advanceTimersByTime(ANNOUNCER_DEBOUNCE_MS); });
    expect(getAnnouncer().textContent).toMatch(/Showing Show preview, 3 of 3/);
  });

  it("announcer stays in sync after scroll-snap settles (simulated scroll event)", () => {
    renderSection();
    // Simulate native scroll-snap by firing a scroll event on the carousel track.
    // We can't measure real layout in JSDOM, but we can verify the listener path
    // doesn't throw and the announcer remains consistent with the current activeIdx.
    const region = screen.getByRole("region", { name: /Viewer preview previews/i });

    // Move to slide 2 via tab, then simulate a scroll event (which triggers RAF + computeActive)
    fireEvent.click(screen.getByRole("tab", { name: /Show Blur preview/i }));
    fireEvent.scroll(region);
    act(() => { vi.advanceTimersByTime(ANNOUNCER_DEBOUNCE_MS); });

    // Announcer should reflect a valid slide (1, 2, or 3 of 3) without crashing.
    expect(getAnnouncer().textContent).toMatch(/Showing (Hide|Blur|Show) preview, [123] of 3/);
  });
});
