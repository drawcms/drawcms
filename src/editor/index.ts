"use client";

// Main component
export { DrawCMSEditor } from "./DrawCMSEditor";
export type { DrawCMSEditorProps } from "./DrawCMSEditor";
export type { EditorMenuAction } from "./components/topbar/FileMenu";

// Hooks & Contexts
export { useEditorState } from "./hooks/useEditorState";
export type { UseEditorStateOptions } from "./hooks/useEditorState";
export { useReducedMotion, prefersReducedMotion } from "./hooks/useReducedMotion";
export { useMenuBehavior } from "./hooks/useMenuBehavior";
export {
  useNodeCallbacks,
  useAnimationState,
  NodeCallbacksContext,
  AnimationStateContext,
} from "./contexts";
export type { NodeCallbacksType, AnimationStateType } from "./contexts";

// Types
export type {
  AppNode,
  AppNodeData,
  AppEdge,
  EdgeBend,
  EdgeRoutingMode,
  TableRow,
  ListItem,
  EntityAttribute,
  Lane,
} from "./types";

// Constants
export {
  getNodeSize,
  UML_CLASS_TYPES,
  ER_ENTITY_TYPES,
  CONTAINER_TYPES,
  SWIMLANE_TYPES,
  ALL_CONTAINER_TYPES,
} from "./constants";

// Document format (DM-011)
export {
  DOCUMENT_SCHEMA_VERSION,
  DocumentValidationError,
  drawCMSDocumentSchema,
  parseDocument,
  safeParseDocument,
} from "./document/schema";
export type {
  DocumentAsset,
  DocumentCanvas,
  DocumentEdge,
  DocumentMeta,
  DocumentMotion,
  DocumentNode,
  DrawCMSDocument,
  DrawCMSDocumentV2,
} from "./document/schema";
export { createDocument, deriveAssets, deterministicStringify } from "./document/serialize";
export { DocumentMigrationError, detectDocumentVersion, migrateDocument } from "./document/migrate";

// Command boundary (DM-012)
export {
  addEdgeToSnapshotCommand,
  addNodeCommand,
  applyGraphEditOperations,
  connectCommand,
  copyFromSnapshot,
  createPaste,
  deleteEdgeFromSnapshot,
  deleteNodesFromSnapshot,
  deleteSelectionCommand,
  findDropContainer,
  groupSelectionCommand,
  groupNodesInSnapshot,
  GROUPABLE_CONTAINER_TYPES,
  lockNodesCommand,
  pasteCommand,
  reparentOnDragStop,
  reparentOnDragStopCommand,
  replaceNodeTypeCommand,
  reverseEdgeCommand,
  selectCascadeNodeIds,
  ungroupSelectionCommand,
  ungroupContainersInSnapshot,
  updateEdgeDataCommand,
  updateNodeDataCommand,
  updateNodePositionCommand,
} from "./commands/commands";
export type { EditorCommand, GraphEditOperation } from "./commands/commands";
export type { ClipboardPayload, EditorSnapshot, PasteOptions } from "./commands/operations";
export { CommandHistory } from "./commands/history";

// Plugin & host API (DM-013)
export { EDITOR_API_VERSION } from "./plugins/constants";
export { PluginRegistrationError } from "./plugins/errors";
export type { PluginErrorCode } from "./plugins/errors";
export { createPluginHost } from "./plugins/registry";
export type { ImportResult, PluginHost } from "./plugins/registry";
export { definePlugin } from "./plugins/types";
export type {
  EditorPlugin,
  ExporterContribution,
  ImporterContribution,
  InspectorContribution,
  SelectionSummary,
  ToolbarContribution,
} from "./plugins/types";
export { jsonToolsPlugin } from "./plugins/examples/json-tools";
export { coreFormatsPlugin } from "./plugins/builtins/core-formats";

// Interchange formats (DM-015, DM-016, DM-017)
export {
  createEmptyDocument,
  documentFileSlug,
  DocumentFileError,
  DRAWCMS_FILE_EXTENSION,
  parseDrawcmsFile,
  toDrawcmsFile,
} from "./io/files";
export type { ImportIssue, ImportOutcome } from "./io/types";
export { info as importInfo, warning as importWarning, isImportOutcome } from "./io/types";
export { importDrawio, DrawioParseError, parseDrawio } from "./io/drawio/parse";
export { ExcalidrawParseError, importExcalidraw, parseExcalidraw } from "./io/excalidraw/parse";

// Motion model (DM-019, reduced to narrative-only by DM-034) and capture
// planning (DM-022). Element animation lives on node/edge `data.preset`; see
// content/docs/decisions/003-single-motion-model.md.
export {
  createEmptyMotion,
  motionStateSchema,
  reconcileMotionTargets,
  sanitizeMotion,
} from "./motion/model";
export type { MotionState } from "./motion/model";
export { normalizeMotion } from "./motion/ops";
export {
  CaptureCancelledError,
  createCaptureToken,
  planFrames,
  progressAt,
} from "./motion/schedule";
export type { CaptureToken, FrameSchedule } from "./motion/schedule";
export { captureToGif } from "./motion/gif-capture";

// Narrative presentation model (independent from element motion presets)
export {
  createEmptyStory,
  sanitizeStory,
  storyFromLegacyMotion,
  storySceneSchema,
  storyStateSchema,
  storyStepSchema,
  storyTargetSchema,
  STORY_STEP_DEFAULT_DURATION_MS,
  STORY_STEP_MAX_DURATION_MS,
  STORY_STEP_MIN_DURATION_MS,
} from "./story/model";
export type { StoryScene, StoryState, StoryStep, StoryTarget } from "./story/model";
export {
  addStoryScene,
  addStoryStep,
  moveStoryScene,
  moveStoryStep,
  removeStoryScene,
  removeStoryStep,
  setActiveStoryScene,
  updateStoryScene,
  updateStoryStep,
} from "./story/ops";
export {
  findStoryPlaybackEntryIndex,
  flattenStoryPlayback,
  playableStoryScenes,
} from "./story/playback";
export type { StoryPlaybackEntry } from "./story/playback";

// Onboarding (DM-021)
export {
  dismissOnboarding,
  isOnboardingDismissed,
  loadGuideStep,
  reopenOnboarding,
  saveGuideStep,
} from "./onboarding/state";
export { findTemplate, GUIDED_TEMPLATE_ID, TEMPLATES } from "./document/templates";
export type { TemplateDefinition } from "./document/templates";

// Persistence (DM-014)
export { isPersistenceError, PersistenceError } from "./persistence/types";
export type {
  DocumentPersistenceAdapter,
  PersistenceErrorCode,
  SaveReceipt,
} from "./persistence/types";
export { createMemoryAdapter } from "./persistence/memory";
export { createLocalStorageAdapter } from "./persistence/local-storage";
export { createPersistenceController } from "./persistence/controller";
export type {
  PersistenceController,
  PersistenceControllerOptions,
  PersistenceStatus,
} from "./persistence/controller";
export { useDocumentPersistence } from "./persistence/use-persistence";
export type { UseDocumentPersistenceOptions } from "./persistence/use-persistence";

// Browser-native agent tools (WebMCP progressive enhancement)
export {
  WEBMCP_EDGE_TYPES,
  WEBMCP_EDGE_MOTION_PRESETS,
  WEBMCP_NODE_MOTION_PRESETS,
  WEBMCP_NODE_TYPES,
  createDocumentFromWebMCP,
  createDrawCMSWebMCPTools,
  registerDrawCMSWebMCPTools,
  resolveWebMCPModelContext,
} from "./webmcp/tools";
export type {
  DrawCMSWebMCPAdapter,
  RegisterDrawCMSWebMCPOptions,
  WebMCPModelContext,
  WebMCPToolAnnotations,
  WebMCPToolDefinition,
} from "./webmcp/tools";
export {
  VISUAL_DIAGRAM_TYPES,
  VISUAL_ELEMENT_REGISTRY,
  VISUAL_MOTION_REGISTRY,
  VISUAL_RELATIONSHIP_REGISTRY,
  getVisualElementGrammar,
  getVisualMotionGrammar,
  inferVisualDiagramType,
  recommendVisualGrammar,
  validateDiagramVisualGrammar,
} from "./webmcp/visual-grammar";
export type {
  VisualDiagramType,
  VisualElementGrammar,
  VisualElementKind,
  VisualGrammarIssue,
  VisualMotionGrammar,
  VisualRelationshipGrammar,
  WebMCPBuildSupport,
} from "./webmcp/visual-grammar";
export { useDrawCMSWebMCP } from "./webmcp/use-webmcp";

// Sub-components
export { DiagramCanvas } from "./components/DiagramCanvas";
export { TopBar } from "./components/TopBar";
export { SidebarLeft } from "./components/SidebarLeft";
export { SidebarRight } from "./components/SidebarRight";
export { MotionPresetsPanel } from "./components/MotionPresetsPanel";
export { ShapeBackground } from "./components/shapes/ShapeBackground";
export {
  SEMANTIC_ELEMENT_GROUPS,
  SEMANTIC_SHAPE_TYPES,
  SEMANTIC_CONTAINER_TYPES,
  getSemanticNodeSize,
  getSemanticStyleDefaults,
} from "./components/shapes/semantic-elements";

// Utilities
export { exportToPng, exportToSvg, downloadDataUrl, ExportError } from "./lib/export";
export { exportToGif } from "./lib/gif-export";
export {
  loadExportPreferences,
  saveExportPreferences,
  type ExportPreferences,
} from "./lib/export-preferences";
export { isCloudIconType, getCloudIcon, ALL_CLOUD_ICONS } from "./components/shapes/cloud-icons";
