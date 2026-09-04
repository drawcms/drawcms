"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
  naturalW?: number;
  naturalH?: number;
  onApply: (result: {
    croppedImageUrl: string;
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
    _naturalW: number;
    _naturalH: number;
  }) => void;
}

type HandleType =
  | "move"
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

const MIN_CROP = 10;

export function ImageCropDialog({
  open,
  onOpenChange,
  imageUrl,
  cropX: initCropX,
  cropY: initCropY,
  cropW: initCropW,
  cropH: initCropH,
  naturalW: initNatW,
  naturalH: initNatH,
  onApply,
}: ImageCropDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgNatW, setImgNatW] = useState(initNatW || 0);
  const [imgNatH, setImgNatH] = useState(initNatH || 0);
  const [containerSize, setContainerSize] = useState({ w: 560, h: 380 });

  const [lx, setLx] = useState(initCropX ?? 0);
  const [ly, setLy] = useState(initCropY ?? 0);
  const [lw, setLw] = useState(initCropW ?? 0);
  const [lh, setLh] = useState(initCropH ?? 0);

  const initializedRef = useRef(false);

  const displayScale =
    imgNatW > 0 && imgNatH > 0
      ? Math.min(containerSize.w / imgNatW, containerSize.h / imgNatH, 1)
      : 1;

  const displayW = imgNatW * displayScale;
  const displayH = imgNatH * displayScale;

  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      setImgNatW(nw);
      setImgNatH(nh);

      if (!initializedRef.current) {
        initializedRef.current = true;
        if (!initCropW || !initCropH) {
          setLx(0);
          setLy(0);
          setLw(nw);
          setLh(nh);
        } else {
          setLx(initCropX ?? 0);
          setLy(initCropY ?? 0);
          setLw(initCropW);
          setLh(initCropH);
        }
      }
    },
    [initCropX, initCropY, initCropW, initCropH],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const clampCrop = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const nw = imgNatW || 1;
      const nh = imgNatH || 1;
      const cw = Math.max(MIN_CROP, Math.min(w, nw));
      const ch = Math.max(MIN_CROP, Math.min(h, nh));
      const cx = Math.max(0, Math.min(x, nw - cw));
      const cy = Math.max(0, Math.min(y, nh - ch));
      return { cx, cy, cw, ch };
    },
    [imgNatW, imgNatH],
  );

  // ── Drag logic ──
  const dragRef = useRef<{
    type: HandleType;
    startMouseX: number;
    startMouseY: number;
    startCrop: { x: number; y: number; w: number; h: number };
  } | null>(null);

  const startDrag = useCallback(
    (e: React.MouseEvent, handleType: HandleType) => {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        type: handleType,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startCrop: { x: lx, y: ly, w: lw, h: lh },
      };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const { type, startMouseX, startMouseY, startCrop } = dragRef.current;
        const dx = (ev.clientX - startMouseX) / displayScale;
        const dy = (ev.clientY - startMouseY) / displayScale;

        let nx = startCrop.x;
        let ny = startCrop.y;
        let nw = startCrop.w;
        let nh = startCrop.h;

        if (type === "move") {
          nx = startCrop.x + dx;
          ny = startCrop.y + dy;
        } else {
          if (type.includes("left")) {
            nx = startCrop.x + dx;
            nw = startCrop.w - dx;
          }
          if (type.includes("right")) {
            nw = startCrop.w + dx;
          }
          if (type.includes("top")) {
            ny = startCrop.y + dy;
            nh = startCrop.h - dy;
          }
          if (type.includes("bottom")) {
            nh = startCrop.h + dy;
          }
        }

        const { cx, cy, cw, ch } = clampCrop(nx, ny, nw, nh);
        setLx(Math.round(cx));
        setLy(Math.round(cy));
        setLw(Math.round(cw));
        setLh(Math.round(ch));
      };

      const onMouseUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [lx, ly, lw, lh, displayScale, clampCrop],
  );

  const handleReset = useCallback(() => {
    setLx(0);
    setLy(0);
    setLw(imgNatW);
    setLh(imgNatH);
  }, [imgNatW, imgNatH]);

  const handleApply = useCallback(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = lw;
      canvas.height = lh;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, lx, ly, lw, lh, 0, 0, lw, lh);
      const croppedImageUrl = canvas.toDataURL("image/png");
      onApply({
        croppedImageUrl,
        cropX: lx,
        cropY: ly,
        cropW: lw,
        cropH: lh,
        _naturalW: imgNatW,
        _naturalH: imgNatH,
      });
    };
    img.src = imageUrl;
  }, [lx, ly, lw, lh, imgNatW, imgNatH, imageUrl, onApply]);

  // Display coordinates
  const dCropX = lx * displayScale;
  const dCropY = ly * displayScale;
  const dCropW = lw * displayScale;
  const dCropH = lh * displayScale;

  const offsetX = (containerSize.w - displayW) / 2;
  const offsetY = (containerSize.h - displayH) / 2;

  const isFullImage = lx === 0 && ly === 0 && lw === imgNatW && lh === imgNatH;

  // Handle styles matching the app's node resizer handles (white bg, blue/violet border)
  const cornerHandle =
    "absolute z-30 h-2.5 w-2.5 rounded-full border-[1.5px] border-primary bg-card";
  const edgeHandle = "absolute z-30 h-2 w-2 rounded-full border-[1.5px] border-primary bg-card";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
          <DialogDescription>
            Drag to reposition, resize using handles.
            {imgNatW > 0 && (
              <>
                {" "}
                Original: {imgNatW} x {imgNatH}px
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Canvas area */}
        <div
          ref={containerRef}
          className="relative rounded-lg overflow-hidden select-none border border-border"
          style={{ height: 380, background: "#f3f4f6" }}
        >
          {/* Full image dimmed */}
          <img
            src={imageUrl}
            alt="Crop preview"
            draggable={false}
            className="absolute pointer-events-none"
            style={{
              left: offsetX,
              top: offsetY,
              width: displayW,
              height: displayH,
              opacity: 0.35,
            }}
            onLoad={handleImageLoad}
          />

          {/* Light overlay masks (4 regions around crop) */}
          {imgNatW > 0 && (
            <>
              <div
                className="absolute bg-card/50 pointer-events-none z-10"
                style={{ left: offsetX, top: offsetY, width: displayW, height: dCropY }}
              />
              <div
                className="absolute bg-card/50 pointer-events-none z-10"
                style={{
                  left: offsetX,
                  top: offsetY + dCropY + dCropH,
                  width: displayW,
                  height: displayH - dCropY - dCropH,
                }}
              />
              <div
                className="absolute bg-card/50 pointer-events-none z-10"
                style={{ left: offsetX, top: offsetY + dCropY, width: dCropX, height: dCropH }}
              />
              <div
                className="absolute bg-card/50 pointer-events-none z-10"
                style={{
                  left: offsetX + dCropX + dCropW,
                  top: offsetY + dCropY,
                  width: displayW - dCropX - dCropW,
                  height: dCropH,
                }}
              />
            </>
          )}

          {/* Bright crop region */}
          {imgNatW > 0 && (
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              className="absolute pointer-events-none z-20"
              style={{
                left: offsetX,
                top: offsetY,
                width: displayW,
                height: displayH,
                clipPath: `inset(${dCropY}px ${displayW - dCropX - dCropW}px ${displayH - dCropY - dCropH}px ${dCropX}px)`,
              }}
            />
          )}

          {/* Crop border — blue dashed to match the app's selection style */}
          {imgNatW > 0 && (
            <div
              className="pointer-events-none absolute z-20 rounded-sm border-[1.5px] border-dashed border-primary"
              style={{
                left: offsetX + dCropX,
                top: offsetY + dCropY,
                width: dCropW,
                height: dCropH,
              }}
            />
          )}

          {/* Rule of thirds grid — subtle blue */}
          {imgNatW > 0 && dCropW > 80 && dCropH > 80 && (
            <svg
              className="absolute z-20 pointer-events-none"
              style={{
                left: offsetX + dCropX,
                top: offsetY + dCropY,
                width: dCropW,
                height: dCropH,
              }}
            >
              <line
                x1={dCropW / 3}
                y1={0}
                x2={dCropW / 3}
                y2={dCropH}
                stroke="rgba(59,130,246,0.2)"
                strokeWidth="0.5"
              />
              <line
                x1={(2 * dCropW) / 3}
                y1={0}
                x2={(2 * dCropW) / 3}
                y2={dCropH}
                stroke="rgba(59,130,246,0.2)"
                strokeWidth="0.5"
              />
              <line
                x1={0}
                y1={dCropH / 3}
                x2={dCropW}
                y2={dCropH / 3}
                stroke="rgba(59,130,246,0.2)"
                strokeWidth="0.5"
              />
              <line
                x1={0}
                y1={(2 * dCropH) / 3}
                x2={dCropW}
                y2={(2 * dCropH) / 3}
                stroke="rgba(59,130,246,0.2)"
                strokeWidth="0.5"
              />
            </svg>
          )}

          {/* Move handle (entire crop region) */}
          {imgNatW > 0 && (
            <div
              className="absolute z-25 cursor-move"
              style={{
                left: offsetX + dCropX,
                top: offsetY + dCropY,
                width: dCropW,
                height: dCropH,
              }}
              onMouseDown={(e) => startDrag(e, "move")}
            />
          )}

          {/* Corner handles */}
          {imgNatW > 0 && (
            <>
              <div
                className={`${cornerHandle} cursor-nw-resize`}
                style={{ left: offsetX + dCropX - 5, top: offsetY + dCropY - 5 }}
                onMouseDown={(e) => startDrag(e, "top-left")}
              />
              <div
                className={`${cornerHandle} cursor-ne-resize`}
                style={{ left: offsetX + dCropX + dCropW - 5, top: offsetY + dCropY - 5 }}
                onMouseDown={(e) => startDrag(e, "top-right")}
              />
              <div
                className={`${cornerHandle} cursor-sw-resize`}
                style={{ left: offsetX + dCropX - 5, top: offsetY + dCropY + dCropH - 5 }}
                onMouseDown={(e) => startDrag(e, "bottom-left")}
              />
              <div
                className={`${cornerHandle} cursor-se-resize`}
                style={{ left: offsetX + dCropX + dCropW - 5, top: offsetY + dCropY + dCropH - 5 }}
                onMouseDown={(e) => startDrag(e, "bottom-right")}
              />

              {/* Edge midpoint handles */}
              <div
                className={`${edgeHandle} cursor-n-resize`}
                style={{ left: offsetX + dCropX + dCropW / 2 - 4, top: offsetY + dCropY - 4 }}
                onMouseDown={(e) => startDrag(e, "top")}
              />
              <div
                className={`${edgeHandle} cursor-s-resize`}
                style={{
                  left: offsetX + dCropX + dCropW / 2 - 4,
                  top: offsetY + dCropY + dCropH - 4,
                }}
                onMouseDown={(e) => startDrag(e, "bottom")}
              />
              <div
                className={`${edgeHandle} cursor-w-resize`}
                style={{ left: offsetX + dCropX - 4, top: offsetY + dCropY + dCropH / 2 - 4 }}
                onMouseDown={(e) => startDrag(e, "left")}
              />
              <div
                className={`${edgeHandle} cursor-e-resize`}
                style={{
                  left: offsetX + dCropX + dCropW - 4,
                  top: offsetY + dCropY + dCropH / 2 - 4,
                }}
                onMouseDown={(e) => startDrag(e, "right")}
              />
            </>
          )}

          {/* Crop size pill */}
          {imgNatW > 0 && (
            <div
              className="absolute z-30 pointer-events-none flex items-center justify-center"
              style={{
                left: offsetX + dCropX,
                top: offsetY + dCropY + dCropH + 4,
                width: dCropW,
              }}
            >
              <span className="text-[10px] text-muted-foreground bg-card/80 border border-border px-1.5 py-0.5 rounded tabular-nums">
                {lw} x {lh}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!isFullImage && (
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          )}
          <Button onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
