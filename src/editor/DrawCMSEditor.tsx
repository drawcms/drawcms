"use client";

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "./components/TopBar";
import { DEFAULT_COLLAPSED_CATEGORY_IDS } from "./components/sidebar-defaults";
import { DiagramCanvas } from "./components/DiagramCanvas";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./components/ui/dialog";
import {
  NodeCallbacksContext,
  AnimationStateContext,
  EdgeRoutingCallbacksContext,
} from "./contexts";
import { useEditorState } from "./hooks/useEditorState";
import { usePanelPresence } from "./hooks/usePanelPresence";
import type { AppNode, AppEdge, ListItem, EntityAttribute, Lane } from "./types";
import { migrateDocument } from "./document/migrate";
import { createDocument } from "./document/serialize";
import type { DocumentCanvas, DocumentMeta, DrawCMSDocument } from "./document/schema";
import { createPluginHost } from "./plugins/registry";
import type { EditorPlugin } from "./plugins/types";
import {
  createEmptyDocument,
  DocumentFileError,
  parseDrawcmsFile,
  toDrawcmsFile,
} from "./io/files";
import { isImportOutcome, type ImportIssue } from "./io/types";
import type { EditorMenuAction, FileMenuImporter } from "./components/topbar/FileMenu";
import type { GraphEditOperation } from "./commands/commands";
import { GROUPABLE_CONTAINER_TYPES } from "./commands/commands";
import { ALL_CONTAINER_TYPES } from "./constants";
import type { ContextMenuSection } from "./components/CanvasContextMenu";
import {
  ArrowLeftRight,
  BoxSelect,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Group,
  ListPlus,
  Lock,
  LockOpen,
  MonitorPlay,
  Plus,
  Replace,
  Scissors,
  SquareDashed,
  Trash2,
  Ungroup,
  X,
} from "lucide-react";
import { createEmptyMotion, type MotionState } from "./motion/model";
import { normalizeMotion } from "./motion/ops";
import { reconcileMotionTargets } from "./motion/model";
import {
  createEmptyStory,
  type StoryScene,
  type StoryState,
  type StoryStep,
  type StoryTarget,
} from "./story/model";
import { addStoryStep, updateStoryStep } from "./story/ops";
import { resolveStoryTargets } from "./story/active-flow";
import { dismissOnboarding, isOnboardingDismissed, reopenOnboarding } from "./onboarding/state";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { useDrawCMSWebMCP } from "./webmcp/use-webmcp";
import type { DrawCMSWebMCPAdapter } from "./webmcp/tools";

const LazySidebarLeft = lazy(() =>
  import("./components/SidebarLeft").then((module) => ({ default: module.SidebarLeft })),
);
const LazyCollapsedElementsRail = lazy(() =>
  import("./components/SidebarLeft").then((module) => ({
    default: module.CollapsedElementsRail,
  })),
);
const LazySidebarRight = lazy(() =>
  import("./components/SidebarRight").then((module) => ({ default: module.SidebarRight })),
);
const LazyMotionPresetsPanel = lazy(() =>
  import("./components/MotionPresetsPanel").then((module) => ({
    default: module.MotionPresetsPanel,
  })),
);
const LazyNameDialog = lazy(() =>
  import("./components/NameDialog").then((module) => ({ default: module.NameDialog })),
);
const LazyConfirmReplaceDialog = lazy(() =>
  import("./components/FileDialogs").then((module) => ({
    default: module.ConfirmReplaceDialog,
  })),
);
const LazyConfirmClearDialog = lazy(() =>
  import("./components/FileDialogs").then((module) => ({
    default: module.ConfirmClearDialog,
  })),
);
const LazyFileErrorDialog = lazy(() =>
  import("./components/FileDialogs").then((module) => ({ default: module.FileErrorDialog })),
);
const LazyImportReportDialog = lazy(() =>
  import("./components/FileDialogs").then((module) => ({
    default: module.ImportReportDialog,
  })),
);
const LazyOnboardingOverlay = lazy(() =>
  import("./components/OnboardingOverlay").then((module) => ({
    default: module.OnboardingOverlay,
  })),
);
const LazyGuideBar = lazy(() =>
  import("./components/GuideBar").then((module) => ({ default: module.GuideBar })),
);
const LazySequenceDock = lazy(() =>
  import("./components/SequenceDock").then((module) => ({ default: module.SequenceDock })),
);
const LazySequenceInspector = lazy(() =>
  import("./components/SequenceInspector").then((module) => ({
    default: module.SequenceInspector,
  })),
);
const LazyCanvasContextMenu = lazy(() =>
  import("./components/CanvasContextMenu").then((module) => ({
    default: module.CanvasContextMenu,
  })),
);
const LazyReplaceElementDialog = lazy(() =>
  import("./components/ReplaceElementDialog").then((module) => ({
    default: module.ReplaceElementDialog,
  })),
);
const LazyStoryStepDialog = lazy(() =>
  import("./components/StoryStepDialog").then((module) => ({
    default: module.StoryStepDialog,
  })),
);

const BUILT_IN_IMPORTERS: FileMenuImporter[] = [
  {
    id: "drawio",
    label: "draw.io diagram (.drawio, .xml)",
    fileExtensions: [".drawio", ".xml"],
  },
  {
    id: "excalidraw",
    label: "Excalidraw scene (.excalidraw)",
    fileExtensions: [".excalidraw", ".excalidrawlib"],
  },
];

function waitForInterfaceUpdate(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      queueMicrotask(resolve);
    }
  });
}

function EditorPanelPlaceholder({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`h-full animate-pulse rounded-lg border border-border bg-card motion-reduce:animate-none ${className}`}
    />
  );
}

export interface DrawCMSEditorProps {
  initialNodes?: AppNode[];
  initialEdges?: AppEdge[];
  /**
   * A versioned document to open (migrated when needed). Takes precedence over
   * initialNodes/initialEdges. Documents are consumed on mount — load a new
   * document by remounting with a React `key`.
   */
  initialDocument?: unknown;
  className?: string;
  /** Smallest camera zoom, useful for fitting wide presentation embeds. */
  minZoom?: number;
  plugins?: EditorPlugin[];
  onChange?: (nodes: AppNode[], edges: AppEdge[]) => void;
  /** Document-level change stream for persistence adapters (DM-014). */
  onDocumentChange?: (document: DrawCMSDocument) => void;
  /**
   * "presentation" (DM-023): read-oriented chrome — no authoring panel or
   * file lifecycle controls.
   */
  variant?: "full" | "presentation";
  /** Hosts can observe a completed local MP4 export. */
  onRenderedVideo?: (result: {
    blob: Blob;
    format: "mp4";
    durationSeconds: number;
    width: number;
    height: number;
  }) => void;
  /** Host navigation rendered inside the shared editor toolbar. */
  topBarLeading?: React.ReactNode;
  /** Host persistence state rendered beside the document name. */
  topBarStatus?: React.ReactNode;
  /** Host actions rendered before the editor's export control. */
  topBarActions?: React.ReactNode;
  /** Host overlay rendered inside the canvas region (e.g. a watermark badge). */
  canvasOverlay?: React.ReactNode;
  /** Cloud mode replaces desktop file language and moves the menu after Export. */
  documentMenuMode?: "local" | "cloud";
  /** Hide editor chrome for host-controlled presentation embeds. */
  showTopBar?: boolean;
  /** Hide export controls when the host does not permit downloading the document. */
  showExport?: boolean;
  /** Host project/reference actions rendered inside the document menu. */
  topBarMenuActions?: EditorMenuAction[];
  /** Host output actions rendered inside the Export menu. */
  topBarExportMenuActions?: EditorMenuAction[];
  /** Optional host attribution rendered into PNG, SVG, GIF, and MP4 exports. */
  exportWatermark?: string;
  /**
   * Local hosts can surface the hosted cloud save experience inside File.
   * Renders a Cloud CTA in the menu; omit to keep the editor fully local.
   */
  cloudSaveHref?: string;
  /** Hosts can reserve SVG and MP4 exports for paid plans. */
  canExportSvg?: boolean;
  canExportMp4?: boolean;
  /** Host billing destination used when paid exports are locked. */
  paidExportUpgradeHref?: string;
  /** Inline badge shown on each locked format (e.g. "Pro", "Cloud"). */
  paidExportBadgeLabel?: string;
  /** Callout copy shown above the upgrade CTA. */
  paidExportUpgradeMessage?: string;
  /** CTA button label when {@link paidExportUpgradeHref} is set. */
  paidExportUpgradeLabel?: string;
  /** Text shown instead of a CTA button when no upgrade destination is configured. */
  paidExportUpgradeFallback?: string;
  /**
   * Expose this authoring editor as browser-native WebMCP tools. Unsupported
   * browsers ignore the option and retain the ordinary editor experience.
   */
  webMcp?: boolean;
  /** Called after the editor has committed and yielded one animation frame. */
  onReady?: () => void;
}

export function DrawCMSEditor({
  initialNodes,
  initialEdges,
  initialDocument,
  className,
  minZoom = 0.5,
  plugins,
  onChange,
  onDocumentChange,
  variant = "full",
  onRenderedVideo,
  topBarLeading,
  topBarStatus,
  topBarActions,
  canvasOverlay,
  documentMenuMode = "local",
  showTopBar = true,
  showExport = true,
  topBarMenuActions,
  topBarExportMenuActions,
  exportWatermark,
  cloudSaveHref,
  canExportSvg,
  canExportMp4,
  paidExportUpgradeHref,
  paidExportBadgeLabel,
  paidExportUpgradeMessage,
  paidExportUpgradeLabel,
  paidExportUpgradeFallback,
  webMcp = false,
  onReady,
}: DrawCMSEditorProps) {
  useEffect(() => {
    if (!onReady) return;
    const frame = requestAnimationFrame(onReady);
    return () => cancelAnimationFrame(frame);
  }, [onReady]);

  // Initial values are consumed once at mount; a new document is loaded by
  // remounting the editor under a different key.
  const initialState = useMemo(
    (): {
      nodes: AppNode[];
      edges: AppEdge[];
      meta: DocumentMeta;
      canvas: DocumentCanvas;
      motion: MotionState;
    } | null => {
      if (initialDocument !== undefined && initialDocument !== null) {
        const document = migrateDocument(initialDocument);
        return {
          nodes: document.nodes as unknown as AppNode[],
          edges: document.edges as unknown as AppEdge[],
          meta: document.meta,
          canvas: document.canvas,
          motion: document.motion,
        };
      }
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-time snapshot by design
    [],
  );
  const docMetaRef = useRef<Partial<DocumentMeta> | undefined>(initialState?.meta);
  const docCanvasRef = useRef<DocumentCanvas>(initialState?.canvas ?? {});

  const host = useMemo(() => createPluginHost(plugins ?? []), [plugins]);

  // ── Document identity + dirty tracking (DM-015) ──
  const [documentName, setDocumentName] = useState(initialState?.meta.name || "Untitled diagram");
  const documentNameRef = useRef(documentName);
  useEffect(() => {
    documentNameRef.current = documentName;
  }, [documentName]);
  const [dirty, setDirty] = useState(false);
  const skipDirtyOnceRef = useRef(false);

  // Element animation stays in the motion model. Narrative story steps live in
  // motion.story so cloud's existing JSON document column remains compatible.
  const [motionState, setMotionState] = useState<MotionState>(
    () => initialState?.motion ?? createEmptyMotion(),
  );
  const motionRef = useRef(motionState);
  useEffect(() => {
    motionRef.current = motionState;
  }, [motionState]);
  // Storage-backed onboarding state is resolved after hydration so the server
  // and first client render always agree (hosts may server-render the editor).
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [guideReset, setGuideReset] = useState(0);
  const [stepsPanelOpen, setStepsPanelOpen] = useState(false);
  const [canvasDismissSignal, setCanvasDismissSignal] = useState(0);
  const [stepMenu, setStepMenu] = useState<{
    x: number;
    y: number;
    kind: "node" | "edge" | "pane";
    flowPosition?: { x: number; y: number };
    targets: StoryTarget[];
  } | null>(null);
  const [replaceDialog, setReplaceDialog] = useState<{ nodeId: string; type: string } | null>(null);
  const [stepDialog, setStepDialog] = useState<{
    mode: "create" | "edit";
    sceneId: string;
    targets: StoryTarget[];
    step?: StoryStep;
  } | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DrawCMSDocument | null>(null);
  const [presentationPlayback, setPresentationPlayback] = useState<{
    targets: StoryTarget[];
    playing: boolean;
    looping: boolean;
  }>({ targets: [], playing: false, looping: true });
  const [collapsedElementTools, setCollapsedElementTools] = useState<Record<string, string>>({});
  const [collapsedElementGroups, setCollapsedElementGroups] = useState<string[]>(
    DEFAULT_COLLAPSED_CATEGORY_IDS,
  );
  // DM-032: honors prefers-reduced-motion — samples never autoplay when the
  // user opts out of motion; playback stays available via explicit controls.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (variant === "presentation") {
      setShowOnboarding(false);
      setOnboardingReady(true);
      return;
    }
    setShowOnboarding(!isOnboardingDismissed());
    setOnboardingReady(true);
  }, [variant]);

  const buildDocument = useCallback(
    (nodes: AppNode[], edges: AppEdge[]): DrawCMSDocument =>
      createDocument({
        nodes,
        edges,
        meta: { ...docMetaRef.current, name: documentNameRef.current },
        canvas: docCanvasRef.current,
        motion: motionRef.current,
      }),
    [],
  );

  const state = useEditorState({
    initialNodes: initialState?.nodes ?? initialNodes,
    initialEdges: initialState?.edges ?? initialEdges,
    onChange: (nodes, edges) => {
      onChange?.(nodes, edges);
      const reconciledMotion = reconcileMotionTargets(
        motionRef.current,
        new Set(nodes.map((node) => node.id)),
        new Set(edges.map((edge) => edge.id)),
      );
      if (reconciledMotion !== motionRef.current) {
        // Keep the ref ahead of the persistence snapshot so a delete and its
        // orphaned motion/story targets are saved atomically.
        motionRef.current = reconciledMotion;
        setMotionState(reconciledMotion);
      }
      onDocumentChange?.(buildDocument(nodes, edges));
      // loadSnapshot-driven changes reopen saved state, they are not edits.
      if (skipDirtyOnceRef.current) skipDirtyOnceRef.current = false;
      else setDirty(true);
    },
  });

  // Elements panel collapse/expand: state flips immediately, the panel stays
  // mounted while its width transition (w-72 <-> w-12) plays out.
  const leftPanelPresence = usePanelPresence(state.showLeftPanel);

  // Stable snapshot refs + loader for document actions (rename/save/import/export).
  const {
    nodesRef,
    edgesRef,
    loadSnapshot,
    setIsGlobalAnimating,
    applyElementMotionPatches,
    applyGraphEdit,
  } = state;

  const knownIds = useCallback(
    () => ({
      nodeIds: new Set(nodesRef.current.map((node) => node.id)),
      edgeIds: new Set(edgesRef.current.map((edge) => edge.id)),
    }),
    [nodesRef, edgesRef],
  );

  const handleMotionChange = useCallback(
    (next: MotionState) => {
      const { nodeIds, edgeIds } = knownIds();
      const normalized = normalizeMotion(next, nodeIds, edgeIds);
      // Keep the ref ahead of React state so the persistence callback contains
      // the exact step edit that triggered it rather than the previous snapshot.
      motionRef.current = normalized;
      setMotionState(normalized);
      setDirty(true);
      onDocumentChange?.(buildDocument(nodesRef.current, edgesRef.current));
    },
    [knownIds, onDocumentChange, buildDocument, nodesRef, edgesRef],
  );

  const storyState = useMemo<StoryState>(
    () => motionState.story ?? createEmptyStory(),
    [motionState],
  );

  const handleStoryChange = useCallback(
    (next: StoryState) => handleMotionChange({ ...motionRef.current, story: next }),
    [handleMotionChange],
  );

  const applyDocument = useCallback(
    (document: DrawCMSDocument) => {
      skipDirtyOnceRef.current = true;
      docMetaRef.current = document.meta;
      docCanvasRef.current = document.canvas;
      setDocumentName(document.meta.name);
      motionRef.current = document.motion;
      setMotionState(document.motion);
      setStepsPanelOpen(false);
      setStepMenu(null);
      setStepDialog(null);
      loadSnapshot(document.nodes as unknown as AppNode[], document.edges as unknown as AppEdge[]);
      setDirty(false);
    },
    [loadSnapshot],
  );

  const webMcpAdapter = useMemo<DrawCMSWebMCPAdapter>(
    () => ({
      getDocument: () => buildDocument(nodesRef.current, edgesRef.current),
      replaceDocument: async (document) => {
        applyDocument(document);
        // An agent-authored replacement is an edit, even though it shares the
        // validated whole-document loader used by file imports.
        setDirty(true);
        await waitForInterfaceUpdate();
      },
      setElementMotion: async (patches) => {
        // Goes through the same undo-recording, id-addressed patch path a
        // human edit would use — see hooks/useEditorState.ts
        // applyElementMotionPatches.
        applyElementMotionPatches(patches);
        await waitForInterfaceUpdate();
      },
      replaceStory: async (story) => {
        // Reuses the human editing funnel (normalization, dirty tracking,
        // persistence) rather than writing motion state directly.
        handleStoryChange(story);
        await waitForInterfaceUpdate();
      },
      applyGraphEdit: async (operations) => {
        // Same pushHistory-then-mutate path a human edit would use — see
        // hooks/useEditorState.ts applyGraphEdit. Unlike replaceDocument,
        // this batch stays undoable.
        applyGraphEdit(operations);
        await waitForInterfaceUpdate();
      },
    }),
    [
      applyDocument,
      buildDocument,
      edgesRef,
      nodesRef,
      applyElementMotionPatches,
      applyGraphEdit,
      handleStoryChange,
    ],
  );
  useDrawCMSWebMCP(webMcp && variant === "full", webMcpAdapter);

  const handleChooseTemplate = useCallback(
    async (templateId: string, autoplay: boolean) => {
      const { findTemplate } = await import("./document/templates");
      const template = findTemplate(templateId);
      const document = template?.build();
      if (document) {
        applyDocument(document);
        if (autoplay) {
          setStepsPanelOpen(true);
          if (!reducedMotion) setIsGlobalAnimating(true);
        }
      }
      dismissOnboarding();
      setShowOnboarding(false);
    },
    [applyDocument, reducedMotion, setIsGlobalAnimating],
  );

  const handleDismissOnboarding = useCallback(() => {
    dismissOnboarding();
    setShowOnboarding(false);
  }, []);

  const handleShowGuide = useCallback(() => {
    reopenOnboarding();
    setGuideReset((value) => value + 1);
    setShowOnboarding(true);
  }, []);

  const editorRootRef = useRef<HTMLDivElement>(null);

  // ── Dialogs + file pipeline ──
  const [nameDialog, setNameDialog] = useState<"rename" | null>(null);
  const [fileError, setFileError] = useState<{
    title: string;
    message: string;
    hint?: string;
  } | null>(null);
  const [importReport, setImportReport] = useState<{
    sourceLabel: string;
    issues: ImportIssue[];
    apply: () => void;
  } | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const pendingReplaceRef = useRef<(() => void) | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const guardReplace = useCallback(
    (action: () => void) => {
      const cloudProjectHasContent =
        documentMenuMode === "cloud" &&
        (nodesRef.current.length > 0 || edgesRef.current.length > 0);
      if (dirty || cloudProjectHasContent) {
        pendingReplaceRef.current = action;
        setConfirmReplace(true);
      } else {
        action();
      }
    },
    [dirty, documentMenuMode, nodesRef, edgesRef],
  );

  const handleNewDocument = useCallback(() => {
    guardReplace(() => applyDocument(createEmptyDocument()));
  }, [guardReplace, applyDocument]);

  const handleClearCanvas = useCallback(() => {
    setConfirmClear(true);
  }, []);

  // Deleting every node goes through the same undo-recording path as a human
  // deletion, so one Cmd+Z restores the cleared graph. Orphaned motion/story
  // targets are reconciled by the onChange pipeline.
  const handleConfirmClearCanvas = useCallback(() => {
    const operations = nodesRef.current.map((node): GraphEditOperation => ({
      op: "deleteNode",
      nodeId: node.id,
    }));
    applyGraphEdit(operations);
  }, [applyGraphEdit, nodesRef]);

  const handleRename = useCallback(
    (name: string) => {
      if (name === documentNameRef.current) return;
      // Keep the snapshot ref ahead of React state so this rename—not the
      // previous name—is included in the persistence callback below.
      documentNameRef.current = name;
      docMetaRef.current = { ...docMetaRef.current, name };
      setDocumentName(name);
      setDirty(true);
      onDocumentChange?.(buildDocument(nodesRef.current, edgesRef.current));
    },
    [onDocumentChange, buildDocument, nodesRef, edgesRef],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImporterRef = useRef<FileMenuImporter | null>(null);

  const openFilePicker = useCallback((importer: FileMenuImporter | null) => {
    pendingImporterRef.current = importer;
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = importer
      ? importer.fileExtensions.join(",")
      : ".drawcms,.json,.drawio,.xml,.excalidraw,.excalidrawlib";
    input.value = "";
    input.click();
  }, []);

  const handleFileText = useCallback(
    async (content: string, fileName: string) => {
      const forced = pendingImporterRef.current;
      pendingImporterRef.current = null;
      const lower = fileName.toLowerCase();

      const finishImport = (document: DrawCMSDocument, issues: ImportIssue[]) =>
        guardReplace(() => {
          if (issues.length > 0) {
            setImportReport({
              sourceLabel: fileName,
              issues,
              apply: () => applyDocument(document),
            });
          } else {
            applyDocument(document);
          }
        });

      try {
        const importerId =
          forced?.id ??
          (lower.endsWith(".drawio") || lower.endsWith(".xml")
            ? "drawio"
            : lower.endsWith(".excalidraw") || lower.endsWith(".excalidrawlib")
              ? "excalidraw"
              : null);
        if (importerId === "drawio" || importerId === "excalidraw") {
          const outcome =
            importerId === "drawio"
              ? (await import("./io/drawio/parse")).importDrawio(content)
              : (await import("./io/excalidraw/parse")).importExcalidraw(content);
          if (isImportOutcome(outcome)) {
            finishImport(migrateDocument(outcome.document), outcome.issues ?? []);
          } else {
            finishImport(migrateDocument(outcome), []);
          }
          return;
        }
        if (importerId) {
          const { document, issues } = host.importDocument(importerId, content);
          finishImport(document, issues);
          return;
        }
        finishImport(parseDrawcmsFile(content), []);
      } catch (error) {
        if (error instanceof DocumentFileError) {
          setFileError({
            title: "Could not open that file",
            message: error.message,
            hint: error.recoveryHint,
          });
        } else {
          setFileError({
            title: "Import failed",
            message: error instanceof Error ? error.message : String(error),
            hint: "Check that the file matches the chosen format, or open a .drawcms file instead.",
          });
        }
      }
    },
    [host, guardReplace, applyDocument],
  );

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveDocument = useCallback(
    (name?: string) => {
      if (name && name !== documentNameRef.current) {
        documentNameRef.current = name;
        docMetaRef.current = { ...docMetaRef.current, name };
        setDocumentName(name);
      }
      const { filename, content } = toDrawcmsFile(
        buildDocument(nodesRef.current, edgesRef.current),
      );
      downloadBlob(new Blob([content], { type: "application/json" }), filename);
      // A cloud backup is an export, not the persistence event represented by
      // the host save indicator.
      if (documentMenuMode === "local") setDirty(false);
    },
    [buildDocument, nodesRef, edgesRef, documentMenuMode],
  );

  const handleExportArtifact = useCallback(
    (exporterId: string) => {
      const artifact = host.exportDocument(
        exporterId,
        buildDocument(nodesRef.current, edgesRef.current),
      );
      downloadBlob(
        typeof artifact.content === "string"
          ? new Blob([artifact.content], { type: artifact.mimeType })
          : artifact.content,
        artifact.filename,
      );
    },
    [host, buildDocument, nodesRef, edgesRef],
  );

  const importers = [
    ...BUILT_IN_IMPORTERS,
    ...host
      .listImporters()
      .filter(
        (importer) =>
          importer.id !== "drawcms-json" &&
          !BUILT_IN_IMPORTERS.some((builtIn) => builtIn.id === importer.id),
      )
      .map(({ id, label, fileExtensions }): FileMenuImporter => ({ id, label, fileExtensions })),
  ];
  const artifactExporters = host
    .listExporters()
    .filter((exporter) => exporter.id !== "drawcms-file")
    .map(({ id, label }) => ({ id, label }));

  const selection = { nodeId: state.selectedNodeId, edgeId: state.selectedEdgeId };
  const isPresentation = variant === "presentation";
  const resolvedPresentationTargets = useMemo(
    () => resolveStoryTargets(presentationPlayback.targets, state.edges),
    [presentationPlayback.targets, state.edges],
  );
  const activePresentationTargets = useMemo<StoryTarget[]>(
    () => [
      ...resolvedPresentationTargets.nodeIds.map((targetId) => ({
        targetId,
        targetKind: "node" as const,
      })),
      ...resolvedPresentationTargets.edgeIds.map((targetId) => ({
        targetId,
        targetKind: "edge" as const,
      })),
    ],
    [resolvedPresentationTargets],
  );
  const presentationAnimationState = useMemo(
    () => ({
      ...state.animationState,
      isGlobalAnimating: presentationPlayback.looping && !reducedMotion,
      activeStoryNodeIds: resolvedPresentationTargets.nodeIds,
      activeStoryEdgeIds: resolvedPresentationTargets.edgeIds,
      isStoryStepPlaying: presentationPlayback.playing,
      prefersReducedMotion: reducedMotion,
    }),
    [
      presentationPlayback.looping,
      presentationPlayback.playing,
      reducedMotion,
      resolvedPresentationTargets,
      state.animationState,
    ],
  );

  // Edge preset animations read the per-edge `data.isAnimating` flag, which
  // the editor normally derives from the Animate toggle. In presentation mode
  // there is no toggle, so looping playback sets the flag on every edge.
  const presentationEdges = useMemo(() => {
    if (!isPresentation || !presentationPlayback.looping) return state.flowEdges;
    return state.flowEdges.map((edge) => ({
      ...edge,
      data: { ...edge.data, isAnimating: true },
    }));
  }, [isPresentation, presentationPlayback.looping, state.flowEdges]);
  const leftToolbar = isPresentation ? [] : host.toolbarFor("left");
  const rightToolbar = isPresentation ? [] : host.toolbarFor("right");
  const inspectors = isPresentation ? [] : host.visibleInspectors(selection);
  const knownNodes = state.nodes.map((node) => ({
    id: node.id,
    label: (node.data.label as string) || node.id,
  }));
  const knownEdges = state.edges.map((edge) => ({
    id: edge.id,
    label: (edge.label as string) || (edge.data?.label as string) || edge.id,
  }));
  const selectedTargets = useMemo<StoryTarget[]>(() => {
    const targets: StoryTarget[] = [
      ...state.nodes
        .filter((node) => node.selected)
        .map((node) => ({ targetId: node.id, targetKind: "node" as const })),
      ...state.edges
        .filter((edge) => edge.selected)
        .map((edge) => ({ targetId: edge.id, targetKind: "edge" as const })),
    ];
    if (targets.length > 0) return targets;
    if (state.selectedNodeId) {
      return [{ targetId: state.selectedNodeId, targetKind: "node" }];
    }
    if (state.selectedEdgeId) {
      return [{ targetId: state.selectedEdgeId, targetKind: "edge" }];
    }
    return [];
  }, [state.edges, state.nodes, state.selectedEdgeId, state.selectedNodeId]);
  const hasRightPanel =
    !isPresentation &&
    (stepsPanelOpen || state.selectedNodeId !== null || state.selectedEdgeId !== null);
  const activeStoryScene =
    storyState.scenes.find((scene) => scene.id === storyState.activeSceneId) ??
    storyState.scenes[0];

  const openSteps = () => {
    state.setShowPresets(false);
    setStepsPanelOpen(true);
    setStepMenu(null);
  };

  const dismissCanvasOverlays = () => {
    state.setShowPresets(false);
    state.cancelSequenceEdgeTool();
    setStepMenu(null);
    setStepsPanelOpen(false);
    setCanvasDismissSignal((current) => current + 1);
  };

  const openPresentationPreview = () => {
    setPreviewDocument(buildDocument(nodesRef.current, edgesRef.current));
  };

  const handleActivePresentationStep = useCallback(
    ({
      step,
      playing,
      mode,
    }: {
      scene: StoryScene | null;
      step: StoryStep | null;
      playing: boolean;
      mode: "loop" | "steps";
    }) => {
      setPresentationPlayback({
        targets: step?.targets ?? [],
        playing,
        looping: mode === "loop",
      });
    },
    [],
  );

  const openCreateStep = (targets: StoryTarget[]) => {
    if (!activeStoryScene || targets.length === 0) return;
    setStepDialog({ mode: "create", sceneId: activeStoryScene.id, targets });
    setStepMenu(null);
  };

  const openEditStep = (sceneId: string, step: StoryStep) => {
    setStepDialog({ mode: "edit", sceneId, targets: step.targets, step });
  };

  const submitStepDialog = (input: {
    title: string;
    description?: string;
    durationMs?: number;
  }) => {
    if (!stepDialog) return;
    const next =
      stepDialog.mode === "edit" && stepDialog.step
        ? updateStoryStep(storyState, stepDialog.sceneId, stepDialog.step.id, {
            ...input,
            targets: stepDialog.targets,
          })
        : addStoryStep(storyState, stepDialog.sceneId, {
            ...input,
            targets: stepDialog.targets,
          });
    handleStoryChange(next);
    setStepsPanelOpen(true);
  };

  // ── Right-click context menu (node / edge / pane) ──
  const buildContextMenuSections = (): ContextMenuSection[] => {
    if (!stepMenu) return [];
    const mod = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl+";
    const run = (action: () => void) => () => {
      setStepMenu(null);
      action();
    };
    const selectedNodeIds = state.nodes.filter((node) => node.selected).map((node) => node.id);
    const selectedEdgeIds = state.edges.filter((edge) => edge.selected).map((edge) => edge.id);
    const hasSelection =
      Boolean(state.selectedNodeId || state.selectedEdgeId) ||
      selectedNodeIds.length + selectedEdgeIds.length > 0;

    if (stepMenu.kind === "pane") {
      return [
        {
          id: "pane-edit",
          items: [
            {
              id: "paste",
              label: "Paste",
              icon: ClipboardPaste,
              shortcut: `${mod}V`,
              disabled: !state.clipboardHasContent,
              onSelect: run(state.paste),
            },
            {
              id: "add-node",
              label: "Add element here",
              icon: Plus,
              disabled: !stepMenu.flowPosition,
              onSelect: run(() => {
                if (stepMenu.flowPosition) {
                  state.handleAddNode("rounded-rect", "New element", stepMenu.flowPosition);
                }
              }),
            },
            {
              id: "select-all",
              label: "Select all",
              icon: BoxSelect,
              shortcut: `${mod}A`,
              disabled: state.nodes.length === 0,
              onSelect: run(state.selectAll),
            },
            {
              id: "deselect",
              label: "Deselect",
              icon: SquareDashed,
              disabled: !hasSelection,
              onSelect: run(state.deselectAll),
            },
          ],
        },
      ];
    }

    const selectedNodes = state.nodes.filter((node) => selectedNodeIds.includes(node.id));
    const allLocked =
      selectedNodes.length > 0 && selectedNodes.every((node) => node.data?.locked === true);
    const groupableCount = selectedNodes.filter(
      (node) => !node.parentId && !ALL_CONTAINER_TYPES.has(String(node.data.type)),
    ).length;
    const ungroupableCount = selectedNodes.filter((node) =>
      GROUPABLE_CONTAINER_TYPES.has(String(node.data.type)),
    ).length;

    const sections: ContextMenuSection[] = [];
    if (activeStoryScene) {
      sections.push({
        id: "story",
        items: [
          {
            id: "add-as-step",
            label: "Add as step",
            icon: ListPlus,
            onSelect: run(() => openCreateStep(stepMenu.targets)),
          },
        ],
      });
    }
    sections.push({
      id: "edit",
      items: [
        {
          id: "cut",
          label: "Cut",
          icon: Scissors,
          shortcut: `${mod}X`,
          onSelect: run(state.cutSelection),
        },
        {
          id: "copy",
          label: "Copy",
          icon: Copy,
          shortcut: `${mod}C`,
          onSelect: run(state.copySelection),
        },
        {
          id: "paste",
          label: "Paste",
          icon: ClipboardPaste,
          shortcut: `${mod}V`,
          disabled: !state.clipboardHasContent,
          onSelect: run(state.paste),
        },
        {
          id: "duplicate",
          label: "Duplicate",
          icon: CopyPlus,
          shortcut: `${mod}D`,
          onSelect: run(state.duplicateSelection),
        },
        {
          id: "delete",
          label: "Delete",
          icon: Trash2,
          shortcut: "⌫",
          danger: true,
          onSelect: run(state.deleteSelection),
        },
      ],
    });
    if (stepMenu.kind === "node") {
      sections.push({
        id: "swap",
        items: [
          {
            id: "replace",
            label: "Replace…",
            icon: Replace,
            disabled: selectedNodes.length !== 1 || allLocked,
            onSelect: run(() => {
              const node = selectedNodes[0];
              if (node) setReplaceDialog({ nodeId: node.id, type: String(node.data.type) });
            }),
          },
        ],
      });
      sections.push({
        id: "arrange",
        label: "Arrange",
        items: [
          {
            id: "group",
            label: "Group",
            icon: Group,
            disabled: groupableCount < 2,
            onSelect: run(state.groupSelection),
          },
          {
            id: "ungroup",
            label: "Ungroup",
            icon: Ungroup,
            disabled: ungroupableCount === 0,
            onSelect: run(state.ungroupSelection),
          },
          {
            id: "toggle-lock",
            label: allLocked ? "Unlock" : "Lock",
            icon: allLocked ? LockOpen : Lock,
            disabled: selectedNodes.length === 0,
            onSelect: run(state.toggleLockSelection),
          },
        ],
      });
    } else {
      sections.push({
        id: "arrange",
        label: "Arrange",
        items: [
          {
            id: "reverse",
            label: "Reverse direction",
            icon: ArrowLeftRight,
            disabled: !state.selectedEdgeId,
            onSelect: run(state.reverseSelectedEdge),
          },
        ],
      });
    }
    return sections;
  };

  const contextMenuSections = stepMenu ? buildContextMenuSections() : [];

  return (
    <div
      ref={editorRootRef}
      className={`dm-editor-root flex h-full w-full flex-col overflow-hidden bg-background font-sans text-foreground ${className || ""}`}
    >
      {showTopBar && (
        <TopBar
          isAnimating={state.isGlobalAnimating}
          setIsAnimating={state.setIsGlobalAnimating}
          nodes={state.nodes}
          documentName={documentName}
          dirty={dirty}
          importers={importers}
          artifactExporters={artifactExporters}
          onRenameDocument={handleRename}
          onNewDocument={handleNewDocument}
          onOpenDrawcms={() => openFilePicker(null)}
          onSaveDocument={() => handleSaveDocument()}
          cloudSaveHref={cloudSaveHref}
          onClearCanvas={handleClearCanvas}
          onImport={(importer) => openFilePicker(importer)}
          onExportArtifact={handleExportArtifact}
          onShowGuide={handleShowGuide}
          presentation={isPresentation}
          onRenderedVideo={onRenderedVideo}
          leading={topBarLeading}
          status={topBarStatus}
          actions={topBarActions}
          showExport={showExport}
          documentMenuMode={documentMenuMode}
          menuActions={topBarMenuActions}
          exportMenuActions={topBarExportMenuActions}
          exportWatermark={exportWatermark}
          canExportSvg={canExportSvg}
          canExportMp4={canExportMp4}
          paidExportUpgradeHref={paidExportUpgradeHref}
          paidExportBadgeLabel={paidExportBadgeLabel}
          paidExportUpgradeMessage={paidExportUpgradeMessage}
          paidExportUpgradeLabel={paidExportUpgradeLabel}
          paidExportUpgradeFallback={paidExportUpgradeFallback}
          onDismissOverlays={isPresentation ? undefined : dismissCanvasOverlays}
        />
      )}
      <div className="flex-1 relative overflow-hidden">
        {/* Keep authored content outside the fixed-width inspectors so panel
            chrome never intercepts nodes positioned at the fitted edge. */}
        <div
          className={`absolute inset-y-0 ${
            !isPresentation && state.showLeftPanel ? "left-0 sm:left-[300px]" : "left-0"
          } ${hasRightPanel ? "right-0 lg:right-[300px]" : "right-0"}`}
        >
          <NodeCallbacksContext.Provider value={state.nodeCallbacksRef.current}>
            <EdgeRoutingCallbacksContext.Provider
              value={isPresentation ? null : state.edgeRoutingCallbacks}
            >
              <AnimationStateContext.Provider
                value={isPresentation ? presentationAnimationState : state.animationState}
              >
                <DiagramCanvas
                  nodes={state.flowNodes}
                  edges={isPresentation ? presentationEdges : state.flowEdges}
                  onNodesChange={state.onNodesChange}
                  onEdgesChange={state.onEdgesChange}
                  onConnect={state.onConnect}
                  setSelectedNodeId={state.setSelectedNodeId}
                  setSelectedEdgeId={state.setSelectedEdgeId}
                  onBlankCanvasClick={isPresentation ? undefined : dismissCanvasOverlays}
                  onRequestContextMenu={isPresentation ? undefined : setStepMenu}
                  onOpenSteps={isPresentation ? undefined : openSteps}
                  onAddNode={isPresentation ? undefined : state.handleAddNode}
                  onNodeDragStop={isPresentation ? undefined : state.handleNodeDragStop}
                  activeSequenceEdgeTool={isPresentation ? null : state.activeSequenceEdgeTool}
                  onSequenceEdgeNodeClick={
                    isPresentation ? undefined : state.handleSequenceEdgeNodeClick
                  }
                  onCancelSequenceEdgeTool={
                    isPresentation ? undefined : state.cancelSequenceEdgeTool
                  }
                  extraNodeTypes={host.nodeTypes}
                  extraEdgeTypes={host.edgeTypes}
                  readOnly={isPresentation}
                  webMcp={!isPresentation && webMcp}
                  minZoom={minZoom}
                  activeStoryTargets={isPresentation ? activePresentationTargets : undefined}
                />
              </AnimationStateContext.Provider>
            </EdgeRoutingCallbacksContext.Provider>
          </NodeCallbacksContext.Provider>
        </div>

        {/* Host overlay rendered inside the canvas region, above the story dock. */}
        {canvasOverlay && (
          <div className="pointer-events-none absolute inset-0 z-40">{canvasOverlay}</div>
        )}

        {/* Workstation panels share one compact, bordered chrome system. */}
        <div className="pointer-events-none relative z-30 flex h-full gap-2 p-2">
          {!isPresentation && (
            <div
              className={`h-full transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${
                leftPanelPresence.open
                  ? "pointer-events-auto w-72"
                  : `w-12 ${
                      leftPanelPresence.mounted
                        ? "pointer-events-none dm-left-panel-exiting"
                        : "pointer-events-auto"
                    }`
              }`}
            >
              <Suspense fallback={<EditorPanelPlaceholder className="w-72" />}>
                {leftPanelPresence.open || leftPanelPresence.mounted ? (
                  <LazySidebarLeft
                    onAddNode={state.handleAddNode}
                    onAddIcon={state.handleAddIcon}
                    onCollapse={() => state.setShowLeftPanel(false)}
                  />
                ) : (
                  <LazyCollapsedElementsRail
                    onAddNode={state.handleAddNode}
                    onAddIcon={state.handleAddIcon}
                    onExpand={() => state.setShowLeftPanel(true)}
                    dismissSignal={canvasDismissSignal}
                    selectedShapeIds={collapsedElementTools}
                    visibleCategoryIds={collapsedElementGroups}
                    onSelectedShapeChange={(categoryId, shapeId) =>
                      setCollapsedElementTools((current) => ({
                        ...current,
                        [categoryId]: shapeId,
                      }))
                    }
                    onVisibleCategoryIdsChange={setCollapsedElementGroups}
                  />
                )}
              </Suspense>
            </div>
          )}
          <div className="flex-1" />
          {leftToolbar.length > 0 && (
            <div className="pointer-events-auto flex flex-col gap-2">
              {leftToolbar.map((contribution) => (
                <contribution.component key={contribution.id} />
              ))}
            </div>
          )}
          {(rightToolbar.length > 0 || inspectors.length > 0) && (
            <div className="pointer-events-auto flex flex-col gap-2 self-start">
              {rightToolbar.map((contribution) => (
                <contribution.component key={contribution.id} />
              ))}
              {inspectors.map((contribution) => (
                <contribution.component key={contribution.id} selection={selection} />
              ))}
            </div>
          )}
          {!isPresentation && stepsPanelOpen && (
            <div className="pointer-events-auto h-full">
              <Suspense fallback={<EditorPanelPlaceholder className="w-72" />}>
                <LazySequenceInspector
                  story={storyState}
                  knownNodes={knownNodes}
                  knownEdges={knownEdges}
                  selectedTargets={selectedTargets}
                  onChange={handleStoryChange}
                  onCreateStep={openCreateStep}
                  onEditStep={openEditStep}
                  onPreview={openPresentationPreview}
                  onClose={() => setStepsPanelOpen(false)}
                />
              </Suspense>
            </div>
          )}
          {!isPresentation && !stepsPanelOpen && (state.selectedNodeId || state.selectedEdgeId) && (
            <div className="pointer-events-auto flex gap-2 h-full">
              {state.showPresets && (
                <Suspense fallback={<EditorPanelPlaceholder className="w-64" />}>
                  <LazyMotionPresetsPanel
                    selectedPreset={state.selectedPreset}
                    onSelectPreset={state.handleSelectPreset}
                    type={state.panelType as "node" | "edge"}
                  />
                </Suspense>
              )}
              <div className={state.showPresets ? "hidden md:contents" : "contents"}>
                <Suspense fallback={<EditorPanelPlaceholder className="w-72" />}>
                  <LazySidebarRight
                    selectedNodeId={state.selectedNodeId}
                    selectedEdgeId={state.selectedEdgeId}
                    selectedPreset={state.selectedPreset}
                    showPresets={state.showPresets}
                    setShowPresets={state.setShowPresets}
                    isPreviewing={state.isPreviewingSelected}
                    setIsPreviewing={state.setIsPreviewingSelected}
                    selectedLabel={state.selectedLabel}
                    onLabelChange={state.handleLabelChange}
                    routingMode={state.selectedRoutingMode}
                    onRoutingModeChange={state.handleEdgeRoutingModeChange}
                    onResetEdgeBend={state.handleResetEdgeBend}
                    nodeType={state.currentNode?.data?.type}
                    fillColor={state.currentNode?.data?.fillColor || "#ffffff"}
                    strokeColor={state.currentNode?.data?.strokeColor || "#4b5563"}
                    strokeWidth={state.currentNode?.data?.strokeWidth ?? 1}
                    opacity={state.currentNode?.data?.opacity ?? 1}
                    fontSize={
                      state.currentNode?.data?.fontSize ??
                      (state.currentNode?.data?.type === "text" ? 20 : 14)
                    }
                    fontWeight={
                      state.currentNode?.data?.fontWeight ||
                      (state.currentNode?.data?.type === "text" ? "400" : "500")
                    }
                    textColor={state.currentNode?.data?.textColor || "#1f2937"}
                    textAlign={
                      state.currentNode?.data?.textAlign ||
                      (state.currentNode?.data?.type === "text" ? "left" : "center")
                    }
                    fontFamily={
                      state.currentNode?.data?.fontFamily as "sans" | "hand" | "mono" | undefined
                    }
                    fontStyle={
                      state.currentNode?.data?.fontStyle as "normal" | "italic" | undefined
                    }
                    textDecoration={
                      state.currentNode?.data?.textDecoration as "none" | "underline" | undefined
                    }
                    lineHeight={state.currentNode?.data?.lineHeight as number | undefined}
                    textAutoResize={state.currentNode?.data?.textAutoResize as boolean | undefined}
                    borderRadius={state.currentNode?.data?.borderRadius as number | undefined}
                    headerColor={state.currentNode?.data?.headerColor as string | undefined}
                    imageUrl={state.currentNode?.data?.imageUrl as string | undefined}
                    originalImageUrl={
                      state.currentNode?.data?._originalImageUrl as string | undefined
                    }
                    cropX={state.currentNode?.data?.cropX as number | undefined}
                    cropY={state.currentNode?.data?.cropY as number | undefined}
                    cropW={state.currentNode?.data?.cropW as number | undefined}
                    cropH={state.currentNode?.data?.cropH as number | undefined}
                    naturalW={state.currentNode?.data?._naturalW as number | undefined}
                    naturalH={state.currentNode?.data?._naturalH as number | undefined}
                    onStyleChange={state.handleStyleChange}
                    motionSpeed={
                      (state.currentNode?.data?.motionSpeed ??
                        state.currentEdge?.data?.motionSpeed ??
                        0.25) as number
                    }
                    motionLoop={
                      (state.currentNode?.data?.motionLoop ??
                        state.currentEdge?.data?.motionLoop ??
                        true) as boolean
                    }
                    tableRows={state.currentNode?.data?.rows}
                    onUpdateRows={state.handleUpdateRows}
                    umlAttributes={state.currentNode?.data?.attributes as ListItem[] | undefined}
                    umlMethods={state.currentNode?.data?.methods as ListItem[] | undefined}
                    onUpdateList={state.handleUpdateList}
                    entityAttributes={
                      state.currentNode?.data?.entityAttributes as EntityAttribute[] | undefined
                    }
                    onUpdateEntityAttributes={state.handleUpdateEntityAttributes}
                    lanes={state.currentNode?.data?.lanes as Lane[] | undefined}
                    onUpdateLanes={state.handleUpdateLanes}
                  />
                </Suspense>
              </div>
            </div>
          )}
        </div>
        {!isPresentation && onboardingReady && !showOnboarding && (
          <Suspense fallback={null}>
            <LazyGuideBar key={guideReset} />
          </Suspense>
        )}
      </div>

      {isPresentation && (
        <Suspense fallback={<div className="h-20 shrink-0 border-t border-border bg-card" />}>
          <LazySequenceDock
            story={storyState}
            knownNodes={knownNodes}
            knownEdges={knownEdges}
            onActiveStepChange={handleActivePresentationStep}
          />
        </Suspense>
      )}

      <Dialog
        open={previewDocument !== null}
        onOpenChange={(open) => !open && setPreviewDocument(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="flex h-[90dvh] max-h-[54rem] w-[calc(100%_-_2rem)] max-w-7xl flex-col gap-0 overflow-hidden rounded-xl bg-card p-0 sm:max-w-7xl"
        >
          <DialogTitle className="sr-only">Presentation preview</DialogTitle>
          <DialogDescription className="sr-only">
            Preview the presentation exactly as viewers will see it in shared pages and embeds.
          </DialogDescription>
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 pr-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
              <MonitorPlay size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Presentation preview</p>
              <p className="truncate text-xs text-muted-foreground">{documentName}</p>
            </div>
            <DialogClose
              render={
                <button
                  type="button"
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              }
            >
              <X size={17} aria-hidden="true" />
              <span className="sr-only">Close presentation preview</span>
            </DialogClose>
          </header>
          <div className="min-h-0 flex-1">
            {previewDocument && (
              <DrawCMSEditor
                key={`${previewDocument.meta.updatedAt ?? "preview"}-${previewDocument.nodes.length}-${previewDocument.edges.length}`}
                initialDocument={previewDocument}
                variant="presentation"
                showTopBar={false}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {!isPresentation && stepMenu && (
        <Suspense fallback={null}>
          <LazyCanvasContextMenu
            x={stepMenu.x}
            y={stepMenu.y}
            kind={stepMenu.kind}
            itemCount={stepMenu.targets.length}
            sceneTitle={activeStoryScene?.title ?? null}
            sections={contextMenuSections}
            onClose={() => setStepMenu(null)}
          />
        </Suspense>
      )}

      {!isPresentation && replaceDialog && (
        <Suspense fallback={null}>
          <LazyReplaceElementDialog
            currentType={replaceDialog.type}
            onOpenChange={(open) => !open && setReplaceDialog(null)}
            onChoose={(type) => {
              state.replaceNode(replaceDialog.nodeId, type);
              setReplaceDialog(null);
            }}
          />
        </Suspense>
      )}

      {stepDialog && (
        <Suspense fallback={null}>
          <LazyStoryStepDialog
            open
            mode={stepDialog.mode}
            initialTitle={
              stepDialog.step?.title ?? `Step ${(activeStoryScene?.steps.length ?? 0) + 1}`
            }
            initialDescription={stepDialog.step?.description}
            initialDurationMs={stepDialog.step?.durationMs}
            targets={stepDialog.targets}
            knownNodes={knownNodes}
            knownEdges={knownEdges}
            onOpenChange={(open) => !open && setStepDialog(null)}
            onSubmit={submitStepDialog}
          />
        </Suspense>
      )}

      {/* Hidden file input feeding open/import */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        data-testid="drawcms-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => void handleFileText(String(reader.result ?? ""), file.name);
          reader.readAsText(file);
        }}
      />

      <Suspense fallback={null}>
        {nameDialog && (
          <LazyNameDialog
            open
            onOpenChange={(open) => !open && setNameDialog(null)}
            title="Rename document"
            description="This name is used for saved files and recovery."
            initialValue={documentName}
            submitLabel="Rename"
            onSubmit={handleRename}
          />
        )}
        {fileError && (
          <LazyFileErrorDialog
            open
            onOpenChange={(open) => !open && setFileError(null)}
            title={fileError.title}
            message={fileError.message}
            recoveryHint={fileError.hint}
          />
        )}
        {importReport && (
          <LazyImportReportDialog
            open
            onOpenChange={(open) => !open && setImportReport(null)}
            sourceLabel={importReport.sourceLabel}
            issues={importReport.issues}
            replacingDirty={documentMenuMode === "local" && dirty}
            onConfirm={() => importReport.apply()}
          />
        )}
        {confirmReplace && (
          <LazyConfirmReplaceDialog
            open
            onOpenChange={setConfirmReplace}
            actionLabel="This action"
            cloudProject={documentMenuMode === "cloud"}
            onConfirm={() => pendingReplaceRef.current?.()}
          />
        )}
        {confirmClear && (
          <LazyConfirmClearDialog
            open
            onOpenChange={setConfirmClear}
            onConfirm={handleConfirmClearCanvas}
          />
        )}
        {!isPresentation && onboardingReady && showOnboarding && (
          <LazyOnboardingOverlay
            open
            onClose={handleDismissOnboarding}
            onChoose={handleChooseTemplate}
            onImport={() => openFilePicker(null)}
            onBlank={() => {}}
          />
        )}
      </Suspense>
    </div>
  );
}
