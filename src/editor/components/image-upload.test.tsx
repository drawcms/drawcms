// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SidebarRight } from "./SidebarRight";
import { dataUrlToFile } from "../contexts";

afterEach(cleanup);

type InspectorProps = Parameters<typeof SidebarRight>[0];

function renderImageInspector(overrides: Partial<InspectorProps> = {}) {
  const onStyleChange = vi.fn();
  const props: InspectorProps = {
    selectedNodeId: "node-1",
    selectedEdgeId: null,
    selectedPreset: null,
    showPresets: false,
    setShowPresets: () => {},
    isPreviewing: false,
    setIsPreviewing: () => {},
    selectedLabel: "Picture",
    onLabelChange: () => {},
    nodeType: "image",
    imageUrl: "",
    onStyleChange,
    ...overrides,
  };
  render(<SidebarRight {...props} />);
  return { onStyleChange };
}

const pickFile = (bytes = "hello") => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([bytes], "photo.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
  return { input, file };
};

describe("picking an image file", () => {
  it("inlines a data URL when the host offers no storage", async () => {
    const { onStyleChange } = renderImageInspector();
    pickFile();

    await waitFor(() => expect(onStyleChange).toHaveBeenCalled());
    const [[patch]] = onStyleChange.mock.calls;
    expect(String(patch.imageUrl)).toMatch(/^data:/);
  });

  it("stores the host's URL instead of the bytes when it can upload", async () => {
    const onUploadImage = vi.fn().mockResolvedValue("https://files.example.com/img/abc.png");
    const { onStyleChange } = renderImageInspector({ onUploadImage });
    const { file } = pickFile();

    await waitFor(() => expect(onStyleChange).toHaveBeenCalled());
    expect(onUploadImage).toHaveBeenCalledWith(file);
    // The document must carry a reference, never a megabyte of base64.
    expect(onStyleChange).toHaveBeenCalledWith({
      imageUrl: "https://files.example.com/img/abc.png",
    });
  });

  it("reports a failed upload and does not fall back to inlining", async () => {
    const onUploadImage = vi.fn().mockRejectedValue(new Error("Workspace storage is full."));
    const { onStyleChange } = renderImageInspector({ onUploadImage });
    pickFile();

    await screen.findByText("Workspace storage is full.");
    // Silently inlining here would rebuild the document the host just rejected.
    expect(onStyleChange).not.toHaveBeenCalled();
  });

  it("clears the input so the same file can be retried after a failure", async () => {
    const onUploadImage = vi.fn().mockRejectedValue(new Error("Upload failed."));
    renderImageInspector({ onUploadImage });
    const { input } = pickFile();

    await screen.findByText("Upload failed.");
    expect(input.value).toBe("");
  });

  it("shows progress while the host is uploading", async () => {
    let release: (url: string) => void = () => {};
    const onUploadImage = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    renderImageInspector({ onUploadImage });
    pickFile();

    await screen.findByText("Uploading…");
    expect((document.querySelector('input[type="file"]') as HTMLInputElement).disabled).toBe(true);

    release("https://files.example.com/img/abc.png");
    await waitFor(() => expect(screen.queryByText("Uploading…")).toBeNull());
  });
});

describe("dataUrlToFile", () => {
  it("converts a canvas data URL into an uploadable File", async () => {
    // 1x1 transparent PNG.
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF/qkAAAAAASUVORK5CYII=";
    const file = await dataUrlToFile(dataUrl, "crop.png");

    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("crop.png");
    expect(file.type).toBe("image/png");
    expect(file.size).toBeGreaterThan(0);
  });
});
