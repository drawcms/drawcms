import { vi } from "vitest";

/**
 * jsdom has no layout engine, and React Flow refuses to initialise (so
 * `onInit` never fires and `screenToFlowPosition` never works) until it has
 * measured its wrapper. These are the shims React Flow's own testing guide
 * prescribes: a ResizeObserver that reports a size, a non-zero bounding rect,
 * and the matrix/SVG APIs its transform maths reads.
 *
 * Call from `beforeAll` in any test that renders `<ReactFlow>` and needs real
 * canvas coordinates.
 */
export function installReactFlowJsdomShims(width = 1200, height = 800): void {
  class ResizeObserverStub {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback(
        [{ target, contentRect: { width, height } as DOMRectReadOnly } as ResizeObserverEntry],
        this as never,
      );
    }
    unobserve() {}
    disconnect() {}
  }

  class DOMMatrixReadOnlyStub {
    m22: number;
    constructor(transform?: string) {
      const scale = transform?.match(/matrix\(([^)]+)\)/)?.[1].split(",")[3];
      this.m22 = scale ? Number(scale) : 1;
    }
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal("DOMMatrixReadOnly", DOMMatrixReadOnlyStub);

  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };

  (SVGElement.prototype as unknown as { getBBox: () => object }).getBBox = () => ({
    x: 0,
    y: 0,
    width,
    height,
  });
}
