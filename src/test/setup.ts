import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn(),
});

class ResizeObserverMock {
  observe = vi.fn();

  unobserve = vi.fn();

  disconnect = vi.fn();
}

Object.defineProperty(window, "ResizeObserver", {
  configurable: true,
  writable: true,
  value: ResizeObserverMock,
});

const emptyClientRect = {
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  toJSON: () => "",
  top: 0,
  width: 0,
  x: 0,
  y: 0,
};

Object.defineProperty(Range.prototype, "getBoundingClientRect", {
  configurable: true,
  value: vi.fn(() => emptyClientRect),
});

Object.defineProperty(Range.prototype, "getClientRects", {
  configurable: true,
  value: vi.fn(() => []),
});
