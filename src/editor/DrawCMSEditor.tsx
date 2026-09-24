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
  AnimationStateContext,
  EdgeRoutingCallbacksContext,
  ImageUploaderContext,
  NodeCallbacksContext,
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
import { hasOpenOverlay, isTypingTarget, matches, shortcutHint } from "./shortcuts";
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
import { resolveTemplateTarget, shouldAutoOpenOnboarding } from "./onboarding/policy";
import {
  loadElementPanelPreferences,
  saveElementPanelPreferences,
} from "./lib/element-panel-preferences";
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
  /** Hosts can observe completed local GIF/PNG exports. */
  onRenderedImage?: (result: {
    blob: Blob;
    format: "gif" | "png";
    width: number;
    height: number;
  }) => void;
  /** Host navigation rendered inside the shared editor toolbar. */
  topBarLeading?: React.ReactNode;
  /** Host persistence state rendered beside the document name. */
  topBarStatus?: React.ReactNode;
  /** Host actions rendered before the editor's export control. */
  topBarActions?: React.ReactNode;
  /** Host primary actions rendered after the editor's export control. */
  topBarTrailingActions?: React.ReactNode;
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
  /**
   * Host hook to rewrite the "Draw with ChatGPT" deep link at click time.
   * Authenticated hosts (cloud) use it to mint a one-time agent sign-in URL
   * in the background, so the single click carries the credential into the
   * agent browser. Absent (OSS) keeps the plain codex:// page deep link.
   */
  chatGptDeepLinkResolver?: (pageUrl: string) => Promise<string | null>;
  /**
   * Store a picked image file somewhere the host controls and return the URL
   * to reference it by.
   *
   * Without this the editor inlines the file as a base64 data URL, which is
   * fine for a local document but makes a hosted one grow by roughly 4/3 of
   * the file size — enough for one photo to exceed what a host will accept.
   * Throwing rejects the pick and surfaces the error message to the user; the
   * editor never falls back to inlining, because a host that supplies this has
   * already said it will not store the bytes inline.
   */
  onUploadImage?: (file: File) => Promise<string>;
  /**
   * Open a template as a NEW document instead of replacing the one on screen.
   *
   * Hosts that persist by document identity (cloud, where the editor is bound to
   * one diagram id and autosaves) must supply this. Without it the only way to
   * honour a template pick is to replace the open document, which the host then
   * saves over the user's diagram — the onboarding chooser is reopenable from
   * File → Show guide, so that is reachable at any time, not just on a blank
   * canvas.
   *
   * Only called when the current document has content; picking a template on an
   * empty canvas still loads in place, because there is nothing to lose and a
   * brand-new diagram is exactly where a template belongs.
   */
  onCreateFromTemplate?: (template: {
    id: string;
    name: string;
    document: DrawCMSDocument;
  }) => void | Promise<void>;
  /** Called after the editor has committed and yielded one animation frame. */
  onReady?: () => void;
  /**
   * Hands the host the animate-toggle controller (DM-108a): preset tweens —
   * the frames an animated GIF export varies between — only exist while the
   * toggle is on. Hosts driving headless export flows (e.g. "Embed to
   * GitHub") use it to force-animating around the capture and restore the
   * author's toggle state afterwards.
   */
  animationControl?: (control: {
    isAnimating: () => boolean;
    setAnimating: (value: boolean) => void;
  }) => void;
}

export function DrawCMSEditor({
  initialNodes,
  initialEdges,
  initialDocument,
  className,
  minZoom,
  plugins,
  onChange,
  onDocumentChange,
  variant = "full",
  onRenderedVideo,
  onRenderedImage,
  topBarLeading,
  topBarStatus,
  topBarActions,
  topBarTrailingActions,
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
  chatGptDeepLinkResolver,
  onUploadImage,
  onCreateFromTemplate,
  onReady,
  animationControl,
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

  /**
   * Did the editor mount with an empty canvas? Derived from the same mount-time
   * snapshot the graph is seeded from, so it cannot race the document load.
   *
   * This gates the first-launch chooser. Dismissal is a per-browser localStorage
   * flag, not a per-document one, so on its own it let the chooser auto-open over
   * an already-saved diagram on any browser that had never dismissed it — a fresh
   * profile, a second machine, cleared storage. Picking anything there replaced
   * the open document, and a host that autosaves by diagram id persisted that
   * immediately: the user's diagram silently became the sample.
   */
  const mountedEmpty =
    (initialState?.nodes.length ?? initialNodes?.length ?? 0) === 0 &&
    (initialState?.edges.length ?? initialEdges?.length ?? 0) === 0;

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
  /** Bumped on each save or export, so the guide can tell the reader did it. */
  const [savedOrExported, setSavedOrExported] = useState(0);
  /**
   * Deliberate presses of the Animate toggle and the Steps button. The guide
   * needs these separately from the states they change, because loading a
   * template turns motion on and opens the Steps panel by itself — and clicking
   * empty canvas closes the panel again. Counting the presses is the only
   * signal that means "the reader did this".
   */
  const [animateToggles, setAnimateToggles] = useState(0);
  const [stepsPanelOpens, setStepsPanelOpens] = useState(0);
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
  // Element-panel personalization (pinned groups + each group's rail tool) is a
  // client-only preference. Initialize from the SSR-safe defaults and hydrate
  // from localStorage after mount to avoid a hydration mismatch, matching the
  // onboarding-state pattern. `elementPanelHydrated` is state (not a ref) so the
  // persist effect below skips every render until hydration has actually been
  // committed — otherwise its first run would clobber the saved layout with the
  // initial defaults before the loaded values render.
  const [elementPanelHydrated, setElementPanelHydrated] = useState(false);
  useEffect(() => {
    const stored = loadElementPanelPreferences();
    setCollapsedElementGroups(stored.visibleCategoryIds);
    setCollapsedElementTools(stored.selectedShapeIds);
    setElementPanelHydrated(true);
  }, []);
  useEffect(() => {
    if (!elementPanelHydrated) return;
    saveElementPanelPreferences({
      visibleCategoryIds: collapsedElementGroups,
      selectedShapeIds: collapsedElementTools,
    });
  }, [elementPanelHydrated, collapsedElementGroups, collapsedElementTools]);
  // DM-032: honors prefers-reduced-motion — samples never autoplay when the
  // user opts out of motion; playback stays available via explicit controls.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (variant === "presentation") {
      setShowOnboarding(false);
      setOnboardingReady(true);
      return;
    }
    setShowOnboarding(
      shouldAutoOpenOnboarding({
        variant,
        dismissed: isOnboardingDismissed(),
        documentIsEmpty: mountedEmpty,
      }),
    );
    setOnboardingReady(true);
  }, [variant, mountedEmpty]);

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

  // Filled in by the canvas once it is mounted; read lazily so a palette click
  // always sees the current pan and zoom.
  const viewportCenterRef = useRef<(() => { x: number; y: number } | null) | null>(null);
  const getViewportCenter = useCallback(() => viewportCenterRef.current?.() ?? null, []);
  const registerViewportCenter = useCallback(
    (getCenter: (() => { x: number; y: number } | null) | null) => {
      viewportCenterRef.current = getCenter;
    },
    [],
  );

  const state = useEditorState({
    initialNodes: initialState?.nodes ?? initialNodes,
    initialEdges: initialState?.edges ?? initialEdges,
    getViewportCenter,
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

  // Hand the animate-toggle controller to the host once per mount (DM-108a).
  // The ref indirection keeps the callbacks reading fresh toggle state on
  // every invocation without re-running the handoff.
  const animationControlRef = useRef(animationControl);
  animationControlRef.current = animationControl;
  const stateForControlRef = useRef(state);
  stateForControlRef.current = state;
  useEffect(() => {
    const callback = animationControlRef.current;
    if (!callback) return;
    callback({
      isAnimating: () => stateForControlRef.current.isGlobalAnimating,
      setAnimating: (value) => stateForControlRef.current.setIsGlobalAnimating(value),
    });
  }, []);

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
  const [replaceLabel, setReplaceLabel] = useState("This action");
  const [confirmClear, setConfirmClear] = useState(false);

  const guardReplace = useCallback(
    (
      action: () => void,
      options?: {
        /** Copy for the confirmation, e.g. "Loading a template". */
        label?: string;
        /**
         * Confirm whenever the canvas has content, even on a saved local
         * document. File → New and import keep the older, looser rule; loading a
         * template opts in, because a template pick is easy to make by accident
         * from the reopenable guide and there is no undo for a whole-document
         * replacement.
         */
        confirmWhenNotEmpty?: boolean;
      },
    ) => {
      const hasContent = nodesRef.current.length > 0 || edgesRef.current.length > 0;
      const cloudProjectHasContent = documentMenuMode === "cloud" && hasContent;
      if (dirty || cloudProjectHasContent || (options?.confirmWhenNotEmpty && hasContent)) {
        pendingReplaceRef.current = action;
        setReplaceLabel(options?.label ?? "This action");
        setConfirmReplace(true);
      } else {
        action();
      }
    },
    [dirty, documentMenuMode, nodesRef, edgesRef],
  );

  const handleNewDocument = useCallback(() => {
    guardReplace(() => applyDocument(createEmptyDocument()), { label: "Starting a new diagram" });
  }, [guardReplace, applyDocument]);

  const handleClearCanvas = useCallback(() => {
    setConfirmClear(true);
  }, []);

  /**
   * Load a template chosen from the onboarding guide.
   *
   * Three outcomes, in order of preference:
   *   1. empty canvas → load in place; nothing can be lost.
   *   2. content + host can create documents → hand the template to the host as a
   *      NEW document and leave the open one untouched.
   *   3. content + no host support → confirm before replacing.
   *
   * Previously this called applyDocument() unconditionally, bypassing the same
   * guardReplace() that File → New and import already used. On a host that
   * autosaves by diagram id that silently overwrote the open diagram, name
   * included, and autoplay kept it dirty so it saved repeatedly.
   */
  const handleChooseTemplate = useCallback(
    async (templateId: string, autoplay: boolean) => {
      const { findTemplate } = await import("./document/templates");
      const template = findTemplate(templateId);
      const document = template?.build();
      if (!document || !template) {
        dismissOnboarding();
        setShowOnboarding(false);
        return;
      }

      const loadHere = () => {
        applyDocument(document);
        // Start the motion loop, but leave the Steps panel closed. The right
        // rail holds one panel at a time and the Steps panel outranks the
        // inspector, so pre-opening it meant selecting an element right after
        // loading a template showed no properties and no Motion tab at all.
        // The Steps button is still one click away.
        if (autoplay && !reducedMotion) setIsGlobalAnimating(true);
      };

      const hasContent = nodesRef.current.length > 0 || edgesRef.current.length > 0;
      const target = resolveTemplateTarget({
        documentIsEmpty: !hasContent,
        hostCanCreateDocument: Boolean(onCreateFromTemplate),
      });
      if (target === "new-document") {
        await onCreateFromTemplate?.({ id: template.id, name: template.name, document });
      } else if (target === "confirm-replace") {
        guardReplace(loadHere, {
          label: `Loading the ${template.name} template`,
          confirmWhenNotEmpty: true,
        });
      } else {
        loadHere();
      }

      dismissOnboarding();
      setShowOnboarding(false);
    },
    [
      applyDocument,
      guardReplace,
      onCreateFromTemplate,
      reducedMotion,
      setIsGlobalAnimating,
      nodesRef,
      edgesRef,
    ],
  );

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
        guardReplace(
          () => {
            if (issues.length > 0) {
              setImportReport({
                sourceLabel: fileName,
                issues,
                apply: () => applyDocument(document),
              });
            } else {
              applyDocument(document);
            }
          },
          { label: "Importing a file" },
        );

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
      setSavedOrExported((count) => count + 1);
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
      setSavedOrExported((count) => count + 1);
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
    () => resolveStoryTargets(presentationPlayback.targets, state.edges, state.nodes),
    [presentationPlayback.targets, state.edges, state.nodes],
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
  // Live signals for the hands-on guide: it compares these against a snapshot
  // taken when it mounted, so it can tell an element the reader just added from
  // one the loaded template already had.
  const guideSignals = useMemo(
    () => ({
      nodeCount: state.nodes.length,
      edgeCount: state.edges.length,
      // Fingerprint rather than a count, so swapping the preset on an element
      // that already animated still registers as the reader doing the step.
      motionSignature: [
        ...state.nodes.map((node) => `n:${node.id}:${node.data?.preset ?? ""}`),
        ...state.edges.map((edge) => `e:${edge.id}:${edge.data?.preset ?? ""}`),
      ].join("|"),
      storyStepCount: storyState.scenes.reduce((total, scene) => total + scene.steps.length, 0),
      selection: state.selectedNodeId
        ? `n:${state.selectedNodeId}`
        : state.selectedEdgeId
          ? `e:${state.selectedEdgeId}`
          : "",
      isAnimating: state.isGlobalAnimating,
      animateToggles,
      stepsPanelOpens,
      savedOrExported,
    }),
    [
      state.nodes,
      state.edges,
      state.selectedNodeId,
      state.selectedEdgeId,
      state.isGlobalAnimating,
      storyState,
      animateToggles,
      stepsPanelOpens,
      savedOrExported,
    ],
  );
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
    setStepsPanelOpens((count) => count + 1);
    setStepMenu(null);
  };

  /**
   * The top bar's Animate toggle. Wrapped rather than passed straight through so
   * the press itself is counted for the guide; `setIsGlobalAnimating` is also
   * called by template autoplay and by the agent control surface, neither of
   * which is the reader pressing the button.
   */
  const toggleGlobalAnimation = (value: boolean) => {
    setAnimateToggles((count) => count + 1);
    setIsGlobalAnimating(value);
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
    targets: StoryTarget[];
  }) => {
    if (!stepDialog) return;
    const next =
      stepDialog.mode === "edit" && stepDialog.step
        ? updateStoryStep(storyState, stepDialog.sceneId, stepDialog.step.id, {
            ...input,
            targets: input.targets,
          })
        : addStoryStep(storyState, stepDialog.sceneId, {
            ...input,
            targets: input.targets,
          });
    handleStoryChange(next);
    setStepsPanelOpen(true);
  };

  // ── Right-click context menu (node / edge / pane) ──
  const buildContextMenuSections = (): ContextMenuSection[] => {
    if (!stepMenu) return [];
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
              shortcut: shortcutHint("paste"),
              disabled: !state.clipboardHasContent,
              // Right-click carries a point, so paste lands where the user aimed
              // rather than beside whatever was originally copied.
              onSelect: run(() => state.paste(stepMenu.flowPosition)),
            },
            {
              id: "add-node",
              label: "Add element here",
              icon: Plus,
              shortcut: shortcutHint("addElement"),
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
              shortcut: shortcutHint("selectAll"),
              disabled: state.nodes.length === 0,
              onSelect: run(state.selectAll),
            },
            {
              id: "deselect",
              label: "Deselect",
              icon: SquareDashed,
              shortcut: shortcutHint("deselect"),
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
            shortcut: shortcutHint("addAsStep"),
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
          shortcut: shortcutHint("cut"),
          onSelect: run(state.cutSelection),
        },
        {
          id: "copy",
          label: "Copy",
          icon: Copy,
          shortcut: shortcutHint("copy"),
          onSelect: run(state.copySelection),
        },
        {
          id: "paste",
          label: "Paste",
          icon: ClipboardPaste,
          shortcut: shortcutHint("paste"),
          disabled: !state.clipboardHasContent,
          onSelect: run(state.paste),
        },
        {
          id: "duplicate",
          label: "Duplicate",
          icon: CopyPlus,
          shortcut: shortcutHint("duplicate"),
          onSelect: run(state.duplicateSelection),
        },
        {
          id: "delete",
          label: "Delete",
          icon: Trash2,
          shortcut: shortcutHint("delete"),
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
            shortcut: shortcutHint("replace"),
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
            shortcut: shortcutHint("group"),
            disabled: groupableCount < 2,
            onSelect: run(state.groupSelection),
          },
          {
            id: "ungroup",
            label: "Ungroup",
            icon: Ungroup,
            shortcut: shortcutHint("ungroup"),
            disabled: ungroupableCount === 0,
            onSelect: run(state.ungroupSelection),
          },
          {
            id: "toggle-lock",
            label: allLocked ? "Unlock" : "Lock",
            icon: allLocked ? LockOpen : Lock,
            shortcut: shortcutHint("toggleLock"),
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
            shortcut: shortcutHint("reverseEdge"),
            disabled: !state.selectedEdgeId,
            onSelect: run(state.reverseSelectedEdge),
          },
        ],
      });
    }
    return sections;
  };

  const contextMenuSections = stepMenu ? buildContextMenuSections() : [];

  // Two context-menu actions need editor-level state the state hook does not own
  // (the replace dialog and the active story scene), so their bindings live here
  // rather than in `useEditorState`'s handler.
  const activeSceneId = activeStoryScene?.id ?? null;
  useEffect(() => {
    if (isPresentation) return;
    const handler = (event: KeyboardEvent) => {
      if (isTypingTarget(event) || hasOpenOverlay()) return;
      const selectedNodes = state.nodes.filter((node) => node.selected);
      if (matches(event, "replace")) {
        const node = selectedNodes[0];
        if (!node || selectedNodes.length !== 1 || node.data?.locked === true) return;
        event.preventDefault();
        setReplaceDialog({ nodeId: node.id, type: String(node.data.type) });
        return;
      }
      if (matches(event, "addAsStep")) {
        if (!activeSceneId) return;
        const targets: StoryTarget[] = [
          ...selectedNodes.map((node) => ({ targetId: node.id, targetKind: "node" as const })),
          ...state.edges
            .filter((edge) => edge.selected)
            .map((edge) => ({ targetId: edge.id, targetKind: "edge" as const })),
        ];
        if (targets.length === 0) return;
        event.preventDefault();
        setStepDialog({ mode: "create", sceneId: activeSceneId, targets });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPresentation, activeSceneId, state.nodes, state.edges]);

  return (
    <div
      ref={editorRootRef}
      className={`dm-editor-root flex h-full w-full flex-col overflow-hidden bg-background font-sans text-foreground ${className || ""}`}
    >
      {showTopBar && (
        <TopBar
          isAnimating={state.isGlobalAnimating}
          setIsAnimating={toggleGlobalAnimation}
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
          onRenderedImage={onRenderedImage}
          leading={topBarLeading}
          status={topBarStatus}
          actions={topBarActions}
          trailingActions={topBarTrailingActions}
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
          <ImageUploaderContext.Provider value={onUploadImage ?? null}>
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
                    chatGptDeepLinkResolver={chatGptDeepLinkResolver}
                    minZoom={minZoom}
                    registerViewportCenter={registerViewportCenter}
                    activeStoryTargets={isPresentation ? activePresentationTargets : undefined}
                  />
                </AnimationStateContext.Provider>
              </EdgeRoutingCallbacksContext.Provider>
            </NodeCallbacksContext.Provider>
          </ImageUploaderContext.Provider>
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
                    onUploadImage={onUploadImage}
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
            <LazyGuideBar key={guideReset} signals={guideSignals} />
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
            actionLabel={replaceLabel}
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
