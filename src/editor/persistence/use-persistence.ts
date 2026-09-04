"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createPersistenceController,
  type PersistenceController,
  type PersistenceStatus,
} from "./controller";
import type { DocumentPersistenceAdapter, PersistenceError } from "./types";

export interface UseDocumentPersistenceOptions {
  debounceMs?: number;
  savedIdleDelayMs?: number;
  /** Surface adapter failures (e.g. to render conflict UIs). */
  onError?: (error: PersistenceError) => void;
}

/**
 * One persistence controller per adapter. Adapter identity (not props
 * identity) controls the controller lifecycle, keeping in-flight saves alive
 * across host re-renders.
 */
export function useDocumentPersistence(
  adapter: DocumentPersistenceAdapter | null,
  options?: UseDocumentPersistenceOptions,
): PersistenceController & { status: PersistenceStatus } {
  const [status, setStatus] = useState<PersistenceStatus>("idle");

  const controller = useMemo(
    () =>
      adapter
        ? createPersistenceController(adapter, {
            debounceMs: options?.debounceMs,
            savedIdleDelayMs: options?.savedIdleDelayMs,
            onStatus: (next, error) => {
              setStatus(next);
              if (error) options?.onError?.(error);
            },
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- adapter identity drives lifecycle
    [adapter],
  );
  const activeControllerRef = useRef<PersistenceController | null>(null);

  useEffect(() => {
    activeControllerRef.current = controller;
    setStatus(controller?.getStatus() ?? "idle");
    return () => {
      if (activeControllerRef.current === controller) activeControllerRef.current = null;

      // React Strict Mode immediately replays mount effects in development.
      // Defer disposal by one microtask so the replay can reclaim the same
      // memoized controller; a real unmount or adapter change leaves a
      // different active value and safely destroys the old controller.
      void Promise.resolve().then(() => {
        if (activeControllerRef.current !== controller) controller?.destroy();
      });
    };
  }, [controller]);

  return useMemo(() => Object.assign(controllerStub(controller), { status }), [controller, status]);
}

const nullController: PersistenceController = {
  schedule: () => {},
  flush: async () => {},
  saveNow: async () => {},
  getPendingDocument: () => null,
  hasPendingChanges: () => false,
  getStatus: () => "idle",
  destroy: () => {},
};

function controllerStub(controller: PersistenceController | null): PersistenceController {
  return controller ?? nullController;
}
