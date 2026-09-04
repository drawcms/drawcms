"use client";

import { useState } from "react";
import { X, Film, LayoutTemplate, FolderOpen, FilePlus2, ChevronRight } from "lucide-react";
import { TEMPLATES, GUIDED_TEMPLATE_ID } from "../document/templates";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

interface OnboardingOverlayProps {
  open: boolean;
  onClose: () => void;
  onChoose: (templateId: string, autoplay: boolean) => void;
  onImport: () => void;
  onBlank: () => void;
}

/**
 * First-launch chooser (DM-021): guided sample, templates, import, or blank.
 * Reopenable via the File menu; dismissal is persisted by the host.
 */
export function OnboardingOverlay({
  open,
  onClose,
  onChoose,
  onImport,
  onBlank,
}: OnboardingOverlayProps) {
  const [showTemplates, setShowTemplates] = useState(false);

  const choiceClass =
    "group flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors duration-100 hover:border-primary/30 hover:bg-accent";
  const iconClass =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <button
          onClick={onClose}
          aria-label="Close onboarding"
          className="absolute right-2 top-2 flex min-h-10 min-w-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={16} />
        </button>
        <DialogHeader>
          <DialogTitle>Welcome to DrawCMS</DialogTitle>
          <DialogDescription>
            Diagrams that explain motion. Pick a starting point — you can reopen this guide from
            File → Show guide anytime.
          </DialogDescription>
        </DialogHeader>

        {!showTemplates ? (
          <div className="mt-2 grid gap-2.5">
            <button
              className={choiceClass}
              onClick={() => onChoose(GUIDED_TEMPLATE_ID, true)}
              data-testid="onboarding-sample"
            >
              <span className={iconClass}>
                <Film size={20} />
              </span>
              <span className="flex-1">
                <span className="block font-medium text-foreground">See motion in action</span>
                <span className="block text-sm text-muted-foreground">
                  A guided architecture sample that animates itself — under a minute.
                </span>
              </span>
              <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary" />
            </button>

            <button className={choiceClass} onClick={() => setShowTemplates(true)}>
              <span className={iconClass}>
                <LayoutTemplate size={20} />
              </span>
              <span className="flex-1">
                <span className="block font-medium text-foreground">Start from a template</span>
                <span className="block text-sm text-muted-foreground">
                  Request flow, deployment, incident, or sequence diagram.
                </span>
              </span>
              <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary" />
            </button>

            <button
              className={choiceClass}
              onClick={() => {
                onImport();
                onClose();
              }}
            >
              <span className={iconClass}>
                <FolderOpen size={20} />
              </span>
              <span className="flex-1">
                <span className="block font-medium text-foreground">Import a file</span>
                <span className="block text-sm text-muted-foreground">
                  Bring an existing .drawio, .excalidraw, or .drawcms document.
                </span>
              </span>
              <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary" />
            </button>

            <button
              className={choiceClass}
              onClick={() => {
                onBlank();
                onClose();
              }}
            >
              <span className={iconClass}>
                <FilePlus2 size={20} />
              </span>
              <span className="flex-1">
                <span className="block font-medium text-foreground">Blank canvas</span>
                <span className="block text-sm text-muted-foreground">
                  Start drawing immediately.
                </span>
              </span>
              <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary" />
            </button>
          </div>
        ) : (
          <div className="mt-2">
            <button
              onClick={() => setShowTemplates(false)}
              className="mb-2 text-xs text-muted-foreground hover:text-muted-foreground"
            >
              ← Back
            </button>
            <div className="grid gap-2.5">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  className={choiceClass}
                  onClick={() => onChoose(template.id, true)}
                >
                  <span className={iconClass}>
                    <LayoutTemplate size={20} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium text-foreground">{template.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {template.description}
                    </span>
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-muted-foreground group-hover:text-primary"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
