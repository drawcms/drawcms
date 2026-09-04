import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDocument } from "../document/serialize";
import type { DrawCMSDocument } from "../document/schema";
import { createPersistenceController, type PersistenceStatus } from "./controller";
import { createLocalStorageAdapter } from "./local-storage";
import { createMemoryAdapter } from "./memory";
import { PersistenceError, type DocumentPersistenceAdapter } from "./types";

const docWith = (label: string): DrawCMSDocument =>
  createDocument({
    nodes: [
      {
        id: "a",
        position: { x: 0, y: 0 },
        data: { label, type: "rect" },
        type: "customShape",
      },
    ],
    edges: [],
    meta: { name: label },
  });

const docWithGeometry = (nodeX: number, bend: { x: number; y: number }): DrawCMSDocument =>
  createDocument({
    nodes: [
      {
        id: "a",
        position: { x: nodeX, y: 0 },
        data: { label: "Source", type: "rect" },
        type: "customShape",
      },
      {
        id: "b",
        position: { x: 240, y: 120 },
        data: { label: "Target", type: "rect" },
        type: "customShape",
      },
    ],
    edges: [
      {
        id: "edge-ab",
        source: "a",
        target: "b",
        type: "custom",
        data: { routingMode: "curve", bend },
      },
    ],
    meta: { name: "Geometry" },
  });

describe("createMemoryAdapter", () => {
  it("does not create a revision when saving unchanged content", async () => {
    const adapter = createMemoryAdapter(null, { now: () => "2026-08-11T00:00:00.000Z" });
    const first = await adapter.save(docWith("one"));
    const again = await adapter.save(docWith("one"));
    expect(again).toBe(first);
    expect(again.revision).toBe("mem-1");
    expect(again.savedAt).toBe("2026-08-11T00:00:00.000Z");
  });

  it("bumps the revision only for changed content", async () => {
    const adapter = createMemoryAdapter(null, { now: () => "2026-08-11T00:00:00.000Z" });
    await adapter.save(docWith("one"));
    const second = await adapter.save(docWith("two"));
    expect(second.revision).toBe("mem-2");
    expect(await adapter.load()).toEqual(docWith("two"));
  });
});

describe("createLocalStorageAdapter", () => {
  it("reports an empty backend outside the browser instead of crashing", async () => {
    const adapter = createLocalStorageAdapter();
    await expect(adapter.load()).resolves.toBeNull();
  });
});

describe("createPersistenceController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces schedules into a single save of the latest document", async () => {
    const adapter = createMemoryAdapter();
    const save = vi.spyOn(adapter, "save");
    const controller = createPersistenceController(adapter, { debounceMs: 2000 });

    controller.schedule(docWith("one"));
    controller.schedule(docWith("one-b"));
    await vi.advanceTimersByTimeAsync(1999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith(docWith("one-b"));
  });

  it("marks saved and settles back to idle", async () => {
    const statuses: PersistenceStatus[] = [];
    const controller = createPersistenceController(createMemoryAdapter(), {
      debounceMs: 100,
      savedIdleDelayMs: 500,
      onStatus: (next) => statuses.push(next),
    });

    controller.schedule(docWith("one"));
    await vi.advanceTimersByTimeAsync(101);
    expect(statuses).toEqual(["dirty", "saving", "saved"]);
    await vi.advanceTimersByTimeAsync(500);
    expect(statuses).toEqual(["dirty", "saving", "saved", "idle"]);
    expect(controller.hasPendingChanges()).toBe(false);
  });

  it("reports pending edits immediately before the debounce elapses", () => {
    const statuses: PersistenceStatus[] = [];
    const controller = createPersistenceController(createMemoryAdapter(), {
      debounceMs: 2000,
      onStatus: (next) => statuses.push(next),
    });

    controller.schedule(docWith("one"));

    expect(controller.getStatus()).toBe("dirty");
    expect(controller.hasPendingChanges()).toBe(true);
    expect(statuses).toEqual(["dirty"]);
  });

  it("skips scheduling content identical to the last save", async () => {
    const adapter = createMemoryAdapter();
    const save = vi.spyOn(adapter, "save");
    const controller = createPersistenceController(adapter, { debounceMs: 100 });

    controller.schedule(docWith("one"));
    await vi.advanceTimersByTimeAsync(101);
    expect(save).toHaveBeenCalledTimes(1);

    controller.schedule(docWith("one"));
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(controller.hasPendingChanges()).toBe(false);
  });

  it("cancels a queued intermediate edit when the document returns to the last save", async () => {
    const adapter = createMemoryAdapter();
    const save = vi.spyOn(adapter, "save");
    const controller = createPersistenceController(adapter, { debounceMs: 100 });

    controller.schedule(docWith("saved"));
    await controller.flush();
    controller.schedule(docWith("discarded"));
    controller.schedule(docWith("saved"));
    await vi.advanceTimersByTimeAsync(101);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith(docWith("saved"));
    expect(controller.hasPendingChanges()).toBe(false);
    expect(controller.getStatus()).toBe("saved");
  });

  it("restores the last save after an in-flight intermediate edit completes", async () => {
    let releaseIntermediate!: (value: { revision: string; savedAt: string }) => void;
    const adapter: DocumentPersistenceAdapter = {
      id: "in-flight-revert",
      load: async () => null,
      save: vi
        .fn()
        .mockResolvedValueOnce({ revision: "r1", savedAt: "now" })
        .mockImplementationOnce(() => new Promise((resolve) => (releaseIntermediate = resolve)))
        .mockResolvedValueOnce({ revision: "r3", savedAt: "now" }),
    };
    const controller = createPersistenceController(adapter, { debounceMs: 100 });

    controller.schedule(docWith("saved"));
    await controller.flush();
    controller.schedule(docWith("discarded"));
    await vi.advanceTimersByTimeAsync(101);
    controller.schedule(docWith("saved"));
    releaseIntermediate({ revision: "r2", savedAt: "now" });
    await vi.advanceTimersByTimeAsync(0);

    expect(adapter.save).toHaveBeenCalledTimes(3);
    expect(adapter.save).toHaveBeenLastCalledWith(docWith("saved"));
    expect(controller.hasPendingChanges()).toBe(false);
  });

  it("coalesces rapid node moves and edge bends into the final geometry", async () => {
    const adapter = createMemoryAdapter();
    const save = vi.spyOn(adapter, "save");
    const controller = createPersistenceController(adapter, { debounceMs: 100 });
    const finalDocument = docWithGeometry(96, { x: 72, y: -28 });

    controller.schedule(docWithGeometry(24, { x: 12, y: 18 }));
    controller.schedule(docWithGeometry(64, { x: 48, y: -12 }));
    controller.schedule(finalDocument);
    await vi.advanceTimersByTimeAsync(101);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith(finalDocument);
    expect(controller.hasPendingChanges()).toBe(false);
  });

  it("coalesces edits made during an in-flight save into one follow-up save", async () => {
    let release!: (value: { revision: string; savedAt: string }) => void;
    const adapter: DocumentPersistenceAdapter = {
      id: "fake",
      load: async () => null,
      save: vi
        .fn()
        .mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
        .mockResolvedValue({ revision: "r2", savedAt: "now" }),
    };
    const controller = createPersistenceController(adapter, { debounceMs: 100 });

    controller.schedule(docWith("one"));
    await vi.advanceTimersByTimeAsync(101);
    expect(adapter.save).toHaveBeenCalledTimes(1);

    controller.schedule(docWith("two"));
    release({ revision: "r1", savedAt: "now" });
    await vi.advanceTimersByTimeAsync(0);

    expect(adapter.save).toHaveBeenCalledTimes(2);
    expect(adapter.save).toHaveBeenLastCalledWith(docWith("two"));
    expect(controller.hasPendingChanges()).toBe(false);
  });

  it("drains an edit queued while the previous save is settling", async () => {
    const adapter = createMemoryAdapter();
    const save = vi.spyOn(adapter, "save");
    const controllerRef: { current: ReturnType<typeof createPersistenceController> | null } = {
      current: null,
    };
    let queueSecondEdit = true;
    const controller = createPersistenceController(adapter, {
      debounceMs: 100,
      onStatus: (status) => {
        if (status !== "saved" || !queueSecondEdit) return;
        queueSecondEdit = false;
        void Promise.resolve().then(() => controllerRef.current?.schedule(docWith("two")));
      },
    });
    controllerRef.current = controller;

    controller.schedule(docWith("one"));
    await controller.flush();
    await vi.advanceTimersByTimeAsync(0);

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(docWith("two"));
    expect(controller.hasPendingChanges()).toBe(false);
  });

  it("flush waits for edits queued during an in-flight save", async () => {
    let releaseFirst!: (value: { revision: string; savedAt: string }) => void;
    let releaseSecond!: (value: { revision: string; savedAt: string }) => void;
    const adapter: DocumentPersistenceAdapter = {
      id: "manual-flush",
      load: async () => null,
      save: vi
        .fn()
        .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))
        .mockImplementationOnce(() => new Promise((resolve) => (releaseSecond = resolve))),
    };
    const controller = createPersistenceController(adapter, { debounceMs: 100 });

    controller.schedule(docWith("one"));
    await vi.advanceTimersByTimeAsync(101);
    controller.schedule(docWith("two"));
    const flushed = controller.flush();
    let settled = false;
    void flushed.then(() => {
      settled = true;
    });

    releaseFirst({ revision: "r1", savedAt: "now" });
    await vi.advanceTimersByTimeAsync(0);
    expect(adapter.save).toHaveBeenCalledTimes(2);
    expect(settled).toBe(false);

    releaseSecond({ revision: "r2", savedAt: "now" });
    await flushed;
    expect(settled).toBe(true);
    expect(controller.hasPendingChanges()).toBe(false);
    expect(controller.getStatus()).toBe("saved");
  });

  it("surfaces adapter failures as recoverable errors and allows a retry", async () => {
    const statuses: { status: PersistenceStatus; error: PersistenceError | null }[] = [];
    const adapter: DocumentPersistenceAdapter = {
      id: "flaky",
      load: async () => null,
      save: vi
        .fn()
        .mockRejectedValueOnce(new PersistenceError("NETWORK", "offline", true))
        .mockResolvedValue({ revision: "r1", savedAt: "now" }),
    };
    const controller = createPersistenceController(adapter, {
      debounceMs: 100,
      onStatus: (status, error) => statuses.push({ status, error }),
    });

    controller.schedule(docWith("one"));
    await vi.advanceTimersByTimeAsync(101);
    expect(statuses.at(-1)).toEqual({
      status: "error",
      error: expect.objectContaining({ code: "NETWORK", recoverable: true }),
    });
    expect(controller.hasPendingChanges()).toBe(true);
    expect(controller.getPendingDocument()).toEqual(docWith("one"));

    await controller.flush();
    expect(statuses.at(-1)?.status).toBe("saved");
    expect(adapter.save).toHaveBeenCalledTimes(2);
    expect(controller.hasPendingChanges()).toBe(false);
  });

  it("wraps non-persistence throws as recoverable UNKNOWN errors", async () => {
    const errors: (PersistenceError | null)[] = [];
    const adapter: DocumentPersistenceAdapter = {
      id: "broken",
      load: async () => null,
      save: async () => {
        throw new Error("boom");
      },
    };
    const controller = createPersistenceController(adapter, {
      debounceMs: 50,
      onStatus: (_status, error) => errors.push(error),
    });
    controller.schedule(docWith("one"));
    await vi.advanceTimersByTimeAsync(51);
    expect(errors.at(-1)).toEqual(
      expect.objectContaining({ code: "UNKNOWN", recoverable: true, message: "boom" }),
    );
  });

  it("ignores work after destroy", async () => {
    const adapter = createMemoryAdapter();
    const save = vi.spyOn(adapter, "save");
    const controller = createPersistenceController(adapter, { debounceMs: 100 });
    controller.schedule(docWith("one"));
    controller.destroy();
    controller.schedule(docWith("two"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
  });
});
