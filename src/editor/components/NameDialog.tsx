"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface NameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialValue: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
}

/** Shared prompt for renaming and "Save as…". */
export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  initialValue,
  submitLabel,
  onSubmit,
}: NameDialogProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setValue(initialValue);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const name = value.trim();
            if (!name) return;
            onSubmit(name);
            onOpenChange(false);
          }}
          className="space-y-4"
        >
          <label className="block text-sm">
            <span className="sr-only">Document name</span>
            <input
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              maxLength={120}
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
