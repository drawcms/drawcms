"use client";

import { useEffect, useRef } from "react";
import {
  registerDrawCMSWebMCPTools,
  resolveWebMCPModelContext,
  type DrawCMSWebMCPAdapter,
} from "./tools";

/**
 * Progressive enhancement: unsupported browsers simply render the ordinary
 * editor, while supporting browsers receive tools for this editor's lifetime.
 */
export function useDrawCMSWebMCP(enabled: boolean, adapter: DrawCMSWebMCPAdapter): void {
  const adapterRef = useRef(adapter);

  useEffect(() => {
    adapterRef.current = adapter;
  }, [adapter]);

  useEffect(() => {
    if (!enabled) return;
    const modelContext = resolveWebMCPModelContext();
    if (!modelContext) return;

    return registerDrawCMSWebMCPTools(modelContext, {
      getDocument: () => adapterRef.current.getDocument(),
      replaceDocument: (document) => adapterRef.current.replaceDocument(document),
      setElementMotion: (patches) => adapterRef.current.setElementMotion(patches),
      replaceStory: (story) => adapterRef.current.replaceStory(story),
      applyGraphEdit: (operations) => adapterRef.current.applyGraphEdit(operations),
    });
  }, [enabled]);
}
