"use client";

import type { ImportIssue } from "../io/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface ImportReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceLabel: string;
  issues: ImportIssue[];
  replacingDirty: boolean;
  onConfirm: () => void;
}

/** Non-blocking import report: what the importer kept, approximated, or skipped. */
export function ImportReportDialog({
  open,
  onOpenChange,
  sourceLabel,
  issues,
  replacingDirty,
  onConfirm,
}: ImportReportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import ready</DialogTitle>
          <DialogDescription>
            Reviewing <span className="font-medium">{sourceLabel}</span>
          </DialogDescription>
        </DialogHeader>

        {issues.length > 0 ? (
          <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted p-3 text-sm">
            {issues.map((issue, index) => (
              <li key={index} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${issue.severity === "warning" ? "bg-warning" : "bg-primary"}`}
                />
                <span className="text-foreground">{issue.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Everything imported cleanly.</p>
        )}

        {replacingDirty && (
          <p className="text-sm text-warning">Importing replaces your current unsaved changes.</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Open imported diagram
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FileErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  recoveryHint?: string;
}

/** Invalid/unsupported document failures with recovery guidance (DM-015). */
export function FileErrorDialog({
  open,
  onOpenChange,
  title,
  message,
  recoveryHint,
}: FileErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        {recoveryHint && <p className="text-sm text-muted-foreground">{recoveryHint}</p>}
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Keep working with the current diagram
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmClearDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Guard before removing every node and edge from the canvas. */
export function ConfirmClearDialog({ open, onOpenChange, onConfirm }: ConfirmClearDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Clear the canvas?</DialogTitle>
          <DialogDescription>
            This removes every node and connection from the current diagram. The document name and
            settings are kept.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Clear canvas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmReplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionLabel: string;
  onConfirm: () => void;
  cloudProject?: boolean;
}

/** Guard before replacing a canvas that has unsaved changes (DM-015). */
export function ConfirmReplaceDialog({
  open,
  onOpenChange,
  actionLabel,
  onConfirm,
  cloudProject = false,
}: ConfirmReplaceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {cloudProject ? "Replace the current project?" : "Discard unsaved changes?"}
          </DialogTitle>
          <DialogDescription>
            {cloudProject
              ? "Importing a file replaces this canvas. Your saved version remains available in version history."
              : `${actionLabel} replaces the current diagram. Save a copy first if you need it.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Replace diagram
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
