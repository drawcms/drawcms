// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollapsedElementsRail, SidebarLeft } from "./SidebarLeft";
import { SidebarRight } from "./SidebarRight";
import { MotionPresetsPanel } from "./MotionPresetsPanel";
import { FileMenu } from "./topbar/FileMenu";
import { ExportMenu } from "./topbar/ExportMenu";
import { TopBar } from "./TopBar";

// vitest runs without globals, so register cleanup explicitly.
afterEach(cleanup);

/**
 * DM-032 automated checks: the interactive surfaces that used to be
 * mouse-only divs are now semantic, named, focusable, and keyboard-operable.
 */

describe("SidebarLeft accessibility", () => {
  it("renders every shape as a named, focusable button (not a clickable div)", () => {
    render(<SidebarLeft onAddNode={() => {}} />);
    const rectangle = screen.getByRole("button", { name: "Add Rectangle to canvas" });
    expect(rectangle.tagName).toBe("BUTTON");
    expect(rectangle.getAttribute("draggable")).toBe("true");
    rectangle.focus();
    expect(document.activeElement).toBe(rectangle);
  });

  it("adds shapes from the keyboard", async () => {
    const user = userEvent.setup();
    const onAddNode = vi.fn();
    render(<SidebarLeft onAddNode={onAddNode} />);
    const circle = screen.getByRole("button", { name: "Add Circle to canvas" });
    circle.focus();
    await user.keyboard("{Enter}");
    expect(onAddNode).toHaveBeenCalledWith("circle", "Circle");
  });

  it("names the collapse button and exposes section expansion state", () => {
    render(<SidebarLeft onAddNode={() => {}} onCollapse={() => {}} />);
    const collapse = screen.getByRole("button", { name: "Hide elements panel" });
    expect(collapse.className).toContain("top-1/2");
    expect(collapse.className).toContain("-right-5");
    const basic = screen.getByRole("button", { name: "Basic" });
    expect(basic.getAttribute("aria-expanded")).toBe("true");
    const aws = screen.getByRole("button", { name: "AWS" });
    expect(aws.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("CollapsedElementsRail accessibility", () => {
  it("starts compact with eight default tools, a group picker, and a centered side handle", () => {
    render(<CollapsedElementsRail onAddNode={() => {}} onExpand={() => {}} />);

    const expand = screen.getByRole("button", { name: "Expand elements panel" });
    expect(expand.className).toContain("top-1/2");
    expect(expand.className).toContain("-right-5");
    screen.getByRole("button", { name: "Basic elements, Star selected" });
    screen.getByRole("button", { name: "Search icons" });
    screen.getByRole("button", { name: "Arrows elements, Right Arrow selected" });
    screen.getByRole("button", { name: "Flowchart elements, Decision selected" });
    screen.getByRole("button", { name: "Sequence elements, Participant selected" });
    screen.getByRole("button", { name: "Architecture elements, Backend Service selected" });
    screen.getByRole("button", { name: "UML elements, Actor selected" });
    screen.getByRole("button", { name: "Containers elements, Folder selected" });
    screen.getByRole("button", { name: "Choose element groups" });
    expect(screen.queryByRole("button", { name: "AWS elements, EC2 selected" })).toBeNull();
  });

  it("adds and removes optional groups from the rail", async () => {
    const user = userEvent.setup();
    render(<CollapsedElementsRail onAddNode={() => {}} onExpand={() => {}} />);

    const groupPicker = screen.getByRole("button", { name: "Choose element groups" });
    await user.click(groupPicker);
    const picker = screen.getByRole("dialog", { name: "Choose element groups" });
    expect(picker.getAttribute("data-slot")).toBe("popover-content");
    expect(
      (screen.getByRole("button", { name: "Basic group, always shown" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "AWS group, hidden" }));
    await user.keyboard("{Escape}");
    screen.getByRole("button", { name: "AWS elements, EC2 selected" });

    await user.click(groupPicker);
    await user.click(screen.getByRole("button", { name: "AWS group, shown" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "AWS elements, EC2 selected" })).toBeNull();
  });

  it("adds a semantic data flow element and promotes it to the group tool", async () => {
    const user = userEvent.setup();
    const onAddNode = vi.fn();
    render(<CollapsedElementsRail onAddNode={onAddNode} onExpand={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Choose element groups" }));
    await user.click(screen.getByRole("button", { name: "Data Flow group, hidden" }));
    await user.keyboard("{Escape}");
    await user.click(
      screen.getByRole("button", {
        name: "Data Flow elements, Transform selected",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Add Stream to canvas" }));

    expect(onAddNode).toHaveBeenCalledWith("data-stream", "Stream");
    screen.getByRole("button", { name: "Data Flow elements, Stream selected" });
  });

  it("inserts sequence tools with useful diagram labels instead of catalogue names", async () => {
    const user = userEvent.setup();
    const onAddNode = vi.fn();
    render(<CollapsedElementsRail onAddNode={onAddNode} onExpand={() => {}} />);

    await user.click(
      screen.getByRole("button", {
        name: "Sequence elements, Participant selected",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Connect Message between participants" }));

    expect(onAddNode).toHaveBeenCalledWith("sequence-message", "request()");
    screen.getByRole("button", { name: "Sequence elements, Message selected" });
  });

  it("opens a group picker, adds the chosen shape, and keeps it on the rail", async () => {
    const user = userEvent.setup();
    const onAddNode = vi.fn();
    render(<CollapsedElementsRail onAddNode={onAddNode} onExpand={() => {}} />);

    const basicTool = screen.getByRole("button", {
      name: "Basic elements, Star selected",
    });
    await user.click(basicTool);

    const picker = screen.getByRole("dialog", { name: "Basic elements" });
    expect(picker.getAttribute("data-slot")).toBe("popover-content");
    expect(picker.className).toContain("w-80");
    expect(
      screen.getByRole("button", { name: "Add Star to canvas" }).getAttribute("aria-pressed"),
    ).toBe("true");
    await user.click(screen.getByRole("button", { name: "Add Circle to canvas" }));

    expect(onAddNode).toHaveBeenCalledWith("circle", "Circle");
    expect(screen.queryByRole("dialog")).toBeNull();
    screen.getByRole("button", { name: "Basic elements, Circle selected" });
  });

  it("closes the picker with Escape and returns focus to the group tool", async () => {
    const user = userEvent.setup();
    render(<CollapsedElementsRail onAddNode={() => {}} onExpand={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Choose element groups" }));
    await user.click(screen.getByRole("button", { name: "AWS group, hidden" }));
    await user.keyboard("{Escape}");
    const awsTool = screen.getByRole("button", {
      name: "AWS elements, EC2 selected",
    });
    await user.click(awsTool);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(awsTool);
  });

  it("closes compact element pickers when the canvas is dismissed", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CollapsedElementsRail onAddNode={() => {}} onExpand={() => {}} dismissSignal={0} />,
    );

    await user.click(screen.getByRole("button", { name: "Basic elements, Star selected" }));
    screen.getByRole("dialog", { name: "Basic elements" });

    rerender(<CollapsedElementsRail onAddNode={() => {}} onExpand={() => {}} dismissSignal={1} />);

    expect(screen.queryByRole("dialog", { name: "Basic elements" })).toBeNull();
  });

  it("shows a recoverable empty state when a group search has no matches", async () => {
    const user = userEvent.setup();
    render(<CollapsedElementsRail onAddNode={() => {}} onExpand={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Choose element groups" }));
    await user.click(screen.getByRole("button", { name: "AWS group, hidden" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "AWS elements, EC2 selected" }));
    await user.type(screen.getByRole("searchbox", { name: "Search AWS elements" }), "xyz");

    screen.getByText("No matching elements");
    screen.getByText("Try another name or keyword.");
  });

  it("keeps the chosen representative after the full panel is expanded and collapsed", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [expanded, setExpanded] = useState(false);
      const [selectedShapeIds, setSelectedShapeIds] = useState<Record<string, string>>({});
      const [visibleCategoryIds, setVisibleCategoryIds] = useState(["general"]);
      return expanded ? (
        <button type="button" onClick={() => setExpanded(false)}>
          Collapse elements panel
        </button>
      ) : (
        <CollapsedElementsRail
          onAddNode={() => {}}
          onExpand={() => setExpanded(true)}
          selectedShapeIds={selectedShapeIds}
          visibleCategoryIds={visibleCategoryIds}
          onSelectedShapeChange={(categoryId, shapeId) =>
            setSelectedShapeIds((current) => ({ ...current, [categoryId]: shapeId }))
          }
          onVisibleCategoryIdsChange={setVisibleCategoryIds}
        />
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Basic elements, Star selected" }));
    await user.click(screen.getByRole("button", { name: "Add Circle to canvas" }));
    await user.click(screen.getByRole("button", { name: "Expand elements panel" }));
    await user.click(screen.getByRole("button", { name: "Collapse elements panel" }));

    screen.getByRole("button", { name: "Basic elements, Circle selected" });
  });
});

describe("MotionPresetsPanel accessibility", () => {
  it("renders preset cards as toggle buttons with aria-pressed", () => {
    render(<MotionPresetsPanel selectedPreset="Spin" onSelectPreset={() => {}} type="node" />);
    const spin = screen.getByRole("button", { name: "Spin" });
    expect(spin.tagName).toBe("BUTTON");
    expect(spin.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Bounce" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("selects presets from the keyboard", async () => {
    const user = userEvent.setup();
    const onSelectPreset = vi.fn();
    render(
      <MotionPresetsPanel selectedPreset={null} onSelectPreset={onSelectPreset} type="node" />,
    );
    screen.getByRole("button", { name: "Pulse" }).focus();
    await user.keyboard("{Enter}");
    expect(onSelectPreset).toHaveBeenCalledWith("Pulse Node");
  });

  it("offers a sequence-specific edge preset", async () => {
    const user = userEvent.setup();
    const onSelectPreset = vi.fn();
    render(
      <MotionPresetsPanel selectedPreset={null} onSelectPreset={onSelectPreset} type="edge" />,
    );

    const sequenceFlow = screen.getByRole("button", { name: "Sequence Flow" });
    sequenceFlow.focus();
    await user.keyboard("{Enter}");
    expect(onSelectPreset).toHaveBeenCalledWith("Sequence Flow");
  });
});

describe("Motion preset controls", () => {
  it("opens the preset picker and exposes preview state without a timeline", async () => {
    const user = userEvent.setup();
    const setShowPresets = vi.fn();
    const setIsPreviewing = vi.fn();
    render(
      <SidebarRight
        selectedNodeId="node-1"
        selectedEdgeId={null}
        selectedPreset="Bounce"
        showPresets={false}
        setShowPresets={setShowPresets}
        isPreviewing={false}
        setIsPreviewing={setIsPreviewing}
        selectedLabel="Node"
        onLabelChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Motion" }));
    await user.click(screen.getByRole("button", { name: "Bounce" }));
    expect(setShowPresets).toHaveBeenCalledWith(true);

    const preview = screen.getByRole("button", { name: "Preview selected motion" });
    expect(preview.getAttribute("aria-pressed")).toBe("false");
    await user.click(preview);
    expect(setIsPreviewing).toHaveBeenCalledWith(true);
    expect(screen.queryByText(/timeline/i)).toBeNull();
  });
});

describe("Element label editing", () => {
  it("provides a labeled multiline field and preserves line breaks", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [label, setLabel] = useState("Node");
      return (
        <SidebarRight
          selectedNodeId="node-1"
          selectedEdgeId={null}
          selectedPreset={null}
          showPresets={false}
          setShowPresets={() => {}}
          isPreviewing={false}
          setIsPreviewing={() => {}}
          selectedLabel={label}
          onLabelChange={setLabel}
        />
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: "Text" }));
    const labelField = screen.getByRole("textbox", { name: "Label" });
    expect(labelField.tagName).toBe("TEXTAREA");
    await user.clear(labelField);
    await user.type(labelField, "Trusted service{Enter}boundary");
    expect((labelField as HTMLTextAreaElement).value).toBe("Trusted service\nboundary");
    screen.getByText(/Line breaks are preserved/);
  });
});

describe("Edge routing controls", () => {
  it("switches routing modes and resets the bend with keyboard-accessible controls", async () => {
    const user = userEvent.setup();
    const onRoutingModeChange = vi.fn();
    const onResetEdgeBend = vi.fn();
    render(
      <SidebarRight
        selectedNodeId={null}
        selectedEdgeId="edge-1"
        selectedPreset={null}
        showPresets={false}
        setShowPresets={() => {}}
        isPreviewing={false}
        setIsPreviewing={() => {}}
        selectedLabel="Request"
        onLabelChange={() => {}}
        routingMode="curve"
        onRoutingModeChange={onRoutingModeChange}
        onResetEdgeBend={onResetEdgeBend}
      />,
    );

    const curve = screen.getByRole("radio", { name: "curve" });
    expect((curve as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole("radio", { name: "elbow" }));
    expect(onRoutingModeChange).toHaveBeenCalledWith("elbow");
    await user.click(screen.getByRole("button", { name: "Reset bend" }));
    expect(onResetEdgeBend).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("slider", { name: "Sequence message scale" })).toBeNull();
  });
});

describe("FileMenu accessibility", () => {
  const props = {
    importers: [{ id: "drawio", label: "Import draw.io", fileExtensions: [".drawio"] }],
    onNew: () => {},
    onOpenDrawcms: () => {},
    onSave: () => {},
    onSaveAs: () => {},
    onClear: () => {},
    onImport: () => {},
    onShowGuide: () => {},
  };

  it("focuses the first menu item when opened", async () => {
    const user = userEvent.setup();
    render(<FileMenu {...props} />);
    await user.click(screen.getByRole("button", { name: /^file$/i }));
    expect(screen.getByRole("menu", { name: "File" })).toBeTruthy();
    const items = screen.getAllByRole("menuitem");
    expect(items[0].textContent).toContain("New diagram");
    expect(document.activeElement).toBe(items[0]);
  });

  it("moves focus with arrow keys", async () => {
    const user = userEvent.setup();
    render(<FileMenu {...props} />);
    await user.click(screen.getByRole("button", { name: /^file$/i }));
    const items = screen.getAllByRole("menuitem");
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(items[items.length - 1]);
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(items[0]);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<FileMenu {...props} />);
    const trigger = screen.getByRole("button", { name: /^file$/i });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("activates menu items from the keyboard", async () => {
    const user = userEvent.setup();
    const onNew = vi.fn();
    render(<FileMenu {...props} onNew={onNew} />);
    await user.click(screen.getByRole("button", { name: /^file$/i }));
    await user.keyboard("{Enter}");
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("dismisses on an outside canvas click even when the canvas stops propagation", async () => {
    const user = userEvent.setup();
    render(
      <>
        <FileMenu {...props} />
        <button type="button" onPointerDown={(event) => event.stopPropagation()}>
          Canvas background
        </button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "File" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Canvas background" }));

    expect(screen.queryByRole("menu", { name: "File" })).toBeNull();
  });

  it("uses cloud project language without presenting autosave as a file save", async () => {
    const user = userEvent.setup();
    const onHistory = vi.fn();
    render(
      <FileMenu
        {...props}
        mode="cloud"
        actions={[
          {
            id: "new-project",
            label: "New project",
            description: "Start separately",
            onSelect: () => {},
            placement: "start",
          },
          {
            id: "history",
            label: "Version history",
            onSelect: onHistory,
          },
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "File" });
    await user.click(trigger);
    screen.getByRole("menu", { name: "File" });
    screen.getByRole("menuitem", { name: /new project/i });
    screen.getByRole("menuitem", { name: /import into project/i });
    screen.getByRole("menuitem", { name: /download backup/i });
    expect(screen.queryByRole("menuitem", { name: /^save/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /new diagram/i })).toBeNull();

    await user.click(screen.getByRole("menuitem", { name: /version history/i }));
    expect(onHistory).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("ExportMenu dismissal", () => {
  it("dismisses on an outside canvas click even when the canvas stops propagation", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ExportMenu
          nodes={[]}
          documentName="Diagram"
          isAnimating={false}
          setIsAnimating={() => {}}
          exporterEntries={[]}
          onExportArtifact={() => {}}
        />
        <button type="button" onPointerDown={(event) => event.stopPropagation()}>
          Canvas background
        </button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Canvas background" }));

    expect(screen.queryByRole("menu", { name: "Export" })).toBeNull();
  });

  it("keeps paid exports visible but locked with an upgrade CTA", async () => {
    const user = userEvent.setup();
    render(
      <ExportMenu
        nodes={[]}
        documentName="Diagram"
        isAnimating={false}
        setIsAnimating={() => {}}
        exporterEntries={[]}
        onExportArtifact={() => {}}
        canExportSvg={false}
        canExportMp4={false}
        paidExportUpgradeHref="/dashboard/billing"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export" }));

    screen.getByRole("menuitem", { name: /export as png/i });
    screen.getByRole("menuitem", { name: /export as gif/i });
    expect(
      (screen.getByRole("menuitem", { name: /export as svg/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("menuitem", { name: /export as mp4/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByRole("menuitem", { name: "Upgrade to Pro" }).getAttribute("href")).toBe(
      "/dashboard/billing",
    );
    expect(screen.queryByRole("menuitem", { name: /export as pdf/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /export as webm/i })).toBeNull();
  });

  it("supports host-branded lock copy for an OSS-to-Cloud upsell", async () => {
    const user = userEvent.setup();
    render(
      <ExportMenu
        nodes={[]}
        documentName="Diagram"
        isAnimating={false}
        setIsAnimating={() => {}}
        exporterEntries={[]}
        onExportArtifact={() => {}}
        canExportSvg={false}
        canExportMp4={false}
        paidExportUpgradeHref="https://cloud.example/editor"
        paidExportBadgeLabel="Cloud"
        paidExportUpgradeMessage="SVG and MP4 export are available in DrawCMS Cloud."
        paidExportUpgradeLabel="Try DrawCMS Cloud"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export" }));

    expect(screen.queryAllByText("Cloud").length).toBeGreaterThan(0);
    screen.getByText("SVG and MP4 export are available in DrawCMS Cloud.");
    expect(screen.getByRole("menuitem", { name: "Try DrawCMS Cloud" }).getAttribute("href")).toBe(
      "https://cloud.example/editor",
    );
  });

  it("falls back to plain text when no upgrade destination is configured", async () => {
    const user = userEvent.setup();
    render(
      <ExportMenu
        nodes={[]}
        documentName="Diagram"
        isAnimating={false}
        setIsAnimating={() => {}}
        exporterEntries={[]}
        onExportArtifact={() => {}}
        canExportSvg={false}
        canExportMp4={false}
        paidExportUpgradeFallback="Set NEXT_PUBLIC_CLOUD_URL to unlock SVG and MP4 export."
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export" }));

    screen.getByText("Set NEXT_PUBLIC_CLOUD_URL to unlock SVG and MP4 export.");
    expect(screen.queryByRole("menuitem", { name: /upgrade/i })).toBeNull();
  });
});

describe("TopBar host chrome", () => {
  it("dismisses navigation menus from unused top-bar space", async () => {
    const user = userEvent.setup();
    render(
      <TopBar
        isAnimating={false}
        setIsAnimating={() => {}}
        nodes={[]}
        documentName="Diagram"
        dirty={false}
        importers={[]}
        artifactExporters={[]}
        onRenameDocument={() => {}}
        onNewDocument={() => {}}
        onOpenDrawcms={() => {}}
        onSaveDocument={() => {}}
        onClearCanvas={() => {}}
        onImport={() => {}}
        onExportArtifact={() => {}}
        onShowGuide={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "File" }));
    fireEvent.pointerDown(screen.getByRole("banner"));
    expect(screen.queryByRole("menu", { name: "File" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.pointerDown(screen.getByRole("banner"));
    expect(screen.queryByRole("menu", { name: "Export" })).toBeNull();
  });

  it("removes export from restricted viewer surfaces", () => {
    render(
      <TopBar
        isAnimating={false}
        setIsAnimating={() => {}}
        nodes={[]}
        documentName="Public diagram"
        dirty={false}
        importers={[]}
        artifactExporters={[]}
        onRenameDocument={() => {}}
        onNewDocument={() => {}}
        onOpenDrawcms={() => {}}
        onSaveDocument={() => {}}
        onClearCanvas={() => {}}
        onImport={() => {}}
        onExportArtifact={() => {}}
        onShowGuide={() => {}}
        presentation
        showExport={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
  });

  it("integrates host navigation, persistence state, and actions into one toolbar", () => {
    render(
      <TopBar
        isAnimating={false}
        setIsAnimating={() => {}}
        nodes={[]}
        documentName="Cloud diagram"
        dirty
        importers={[]}
        artifactExporters={[]}
        onRenameDocument={() => {}}
        onNewDocument={() => {}}
        onOpenDrawcms={() => {}}
        onSaveDocument={() => {}}
        onClearCanvas={() => {}}
        onImport={() => {}}
        onExportArtifact={() => {}}
        onShowGuide={() => {}}
        leading={<a href="/dashboard">Back to dashboard</a>}
        status={<span role="status">Saved to cloud</span>}
        actions={<button type="button">Share</button>}
      />,
    );

    expect(screen.getAllByRole("banner")).toHaveLength(1);
    screen.getByRole("link", { name: "Back to dashboard" });
    screen.getByRole("status", { name: "" });
    screen.getByRole("button", { name: "Share" });
    screen.getByRole("button", { name: "Animate all presets" });
    expect(screen.queryByText("Unsaved changes")).toBeNull();
  });

  it("toggles every preset from the Animate control", async () => {
    const user = userEvent.setup();
    const setIsAnimating = vi.fn();
    render(
      <TopBar
        isAnimating={false}
        setIsAnimating={setIsAnimating}
        nodes={[]}
        documentName="Diagram"
        dirty={false}
        importers={[]}
        artifactExporters={[]}
        onRenameDocument={() => {}}
        onNewDocument={() => {}}
        onOpenDrawcms={() => {}}
        onSaveDocument={() => {}}
        onClearCanvas={() => {}}
        onImport={() => {}}
        onExportArtifact={() => {}}
        onShowGuide={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Animate all presets" }));
    expect(setIsAnimating).toHaveBeenCalledWith(true);
  });

  it("keeps cloud File before the document name and right-side actions", async () => {
    const user = userEvent.setup();
    const onDownloadPresentation = vi.fn();
    render(
      <TopBar
        isAnimating={false}
        setIsAnimating={() => {}}
        nodes={[]}
        documentName="Cloud diagram"
        dirty={false}
        importers={[]}
        artifactExporters={[]}
        onRenameDocument={() => {}}
        onNewDocument={() => {}}
        onOpenDrawcms={() => {}}
        onSaveDocument={() => {}}
        onClearCanvas={() => {}}
        onImport={() => {}}
        onExportArtifact={() => {}}
        onShowGuide={() => {}}
        actions={<button type="button">Share</button>}
        documentMenuMode="cloud"
        exportMenuActions={[
          {
            id: "download-presentation",
            label: "Download presentation",
            onSelect: onDownloadPresentation,
          },
        ]}
      />,
    );

    const file = screen.getByRole("button", { name: "File" });
    const documentName = screen.getByRole("button", { name: "Cloud diagram" });
    const animate = screen.getByRole("button", { name: "Animate all presets" });
    const share = screen.getByRole("button", { name: "Share" });
    const exportButton = screen.getByRole("button", { name: "Export" });
    for (const laterControl of [documentName, animate, share, exportButton]) {
      expect(file.compareDocumentPosition(laterControl)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }

    await user.click(exportButton);
    await user.click(screen.getByRole("menuitem", { name: /download presentation/i }));
    expect(onDownloadPresentation).toHaveBeenCalledTimes(1);
  });
});
