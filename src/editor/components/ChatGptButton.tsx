"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, Sparkles, SquareArrowOutUpRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";

function OpenAiLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className ?? "size-4 shrink-0"}
      aria-hidden="true"
    >
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.073zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997z" />
    </svg>
  );
}

interface ChatGptLink {
  href: string;
  connected: boolean;
}

export interface ChatGptButtonProps {
  /**
   * Host-supplied deep-link resolver. Receives the page URL stamped with the
   * webmcpconnected flag and returns the link to hand to the agent (or null
   * to fall back to the built-in codex:// deep link). Authenticated hosts use
   * this to mint a one-time agent sign-in URL in the background so the click
   * itself can carry the credential into the isolated agent browser.
   */
  resolveDeepLink?: (pageUrl: string) => Promise<string | null>;
}

/** sessionStorage key so the auto-opened hint returns next session, not next reload. */
const PROMPT_HINT_SEEN_KEY = "drawcms.webmcp.prompt-hint-seen";

function buildPageUrl(): { pageUrl: string; connected: boolean } {
  const url = new URL(window.location.href);
  const connected = url.searchParams.get("webmcpconnected") === "true";
  url.hash = "";
  url.searchParams.set("webmcpconnected", "true");
  return { pageUrl: url.toString(), connected };
}

function hasSeenPromptHint(): boolean {
  try {
    return window.sessionStorage.getItem(PROMPT_HINT_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markPromptHintSeen(): void {
  try {
    window.sessionStorage.setItem(PROMPT_HINT_SEEN_KEY, "1");
  } catch {
    // Storage denied (private mode) — the hint simply re-opens per load.
  }
}

/**
 * Standalone dark pill beside the canvas controls: deep links into the
 * ChatGPT desktop app (codex://browser) pointed at this editor page with the
 * WebMCP connected flag set. When the page itself was opened through that
 * link, the entry becomes a "Connected" status whose prompt guide opens by
 * itself once per session — most agents need the "use webmcp to …" prefix to
 * call the page's tools instead of answering in chat.
 */
export function ChatGptButton({ resolveDeepLink }: ChatGptButtonProps = {}) {
  const [link, setLink] = useState<ChatGptLink | null>(null);
  const [resolving, setResolving] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Null until the mount check ran, so SSR/tests never mismatch hydration.
  const [hintSeen, setHintSeen] = useState<boolean | null>(null);
  // Captured on mount and reused by the click handler so resolving never
  // re-reads window.location (hosts may replace it mid-session).
  const pageUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Reading window.location is mount-only external state; defer the update
    // one microtask so the effect body stays synchronous-setState-free.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const { pageUrl, connected } = buildPageUrl();
      pageUrlRef.current = pageUrl;
      setLink({
        href: `codex://browser?url=${encodeURIComponent(pageUrl)}`,
        connected,
      });
      if (connected) {
        const seen = hasSeenPromptHint();
        setHintSeen(seen);
        if (!seen) setGuideOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!link) return null;

  const pillClass =
    "relative flex min-h-10 items-center gap-2 overflow-hidden rounded-full bg-zinc-950 px-3.5 py-2 text-sm font-semibold text-white shadow-md";

  if (link.connected) {
    const dismissGuide = () => {
      setGuideOpen(false);
      markPromptHintSeen();
      setHintSeen(true);
    };

    const copyTemplate = async () => {
      try {
        await navigator.clipboard.writeText("use webmcp to …");
        setCopied(true);
        markPromptHintSeen();
        setHintSeen(true);
      } catch {
        // Clipboard can be denied; the text remains selectable below.
      }
    };

    return (
      <Popover
        open={guideOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setGuideOpen(true);
            return;
          }
          dismissGuide();
        }}
      >
        <PopoverTrigger
          className={`${pillClass} transition-colors duration-100 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
          aria-label={
            hintSeen
              ? "ChatGPT connected — show the prompt guide for using WebMCP tools"
              : "ChatGPT connected — new: show the prompt guide for using WebMCP tools"
          }
        >
          <OpenAiLogo />
          <span className="hidden sm:inline">Connected</span>
          {/* Pulse until the guide has been seen: attention without a nag
              once dismissed (re-checked per browser session). */}
          <span
            aria-hidden="true"
            className={`size-1.5 shrink-0 rounded-full bg-emerald-400 ${
              hintSeen ? "" : "animate-pulse motion-reduce:animate-none"
            }`}
          />
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-72 p-3">
          <div className="flex items-start justify-between gap-2">
            <PopoverTitle className="flex items-center gap-1.5">
              <Sparkles size={14} className="shrink-0 text-emerald-500" aria-hidden />
              Prompting ChatGPT
            </PopoverTitle>
            <button
              type="button"
              onClick={dismissGuide}
              aria-label="Dismiss the prompt guide"
              className="flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            >
              <span aria-hidden>×</span>
            </button>
          </div>
          <PopoverDescription className="mt-1 leading-5">
            Start your prompt with this prefix so ChatGPT drives the canvas through this page&apos;s
            WebMCP tools instead of answering in chat alone.
          </PopoverDescription>
          <p className="mt-2 rounded-md border border-border bg-muted/50 px-2.5 py-2 font-mono text-xs text-muted-foreground break-words select-all">
            use webmcp to &lt;your request&gt;
          </p>
          <button
            type="button"
            onClick={() => void copyTemplate()}
            className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
            <span>{copied ? "Copied" : "Copy prefix"}</span>
          </button>
        </PopoverContent>
      </Popover>
    );
  }

  const startResolving = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!resolveDeepLink) return;
    // Keep the default codex:// navigation; the resolver swaps the href in
    // place before the browser acts on it. A slow or failed mint must not
    // fall back to a credential-less URL the agent cannot open, so the click
    // is suspended while resolving.
    event.preventDefault();
    const pageUrl = pageUrlRef.current;
    if (!pageUrl) return;
    setResolving(true);
    void resolveDeepLink(pageUrl)
      .then((href) => {
        window.location.href = href ?? link.href;
      })
      .catch(() => {})
      .finally(() => {
        setResolving(false);
      });
  };

  if (resolving) {
    return (
      <span role="status" aria-label="Preparing ChatGPT sign-in link" className={pillClass}>
        <OpenAiLogo />
        <span className="hidden sm:inline">Preparing…</span>
        <Loader2 size={14} className="shrink-0 animate-spin text-zinc-400" aria-hidden />
      </span>
    );
  }

  return (
    <a
      href={link.href}
      onClick={startResolving}
      aria-label="Draw with ChatGPT in the ChatGPT desktop app"
      title="Draw with ChatGPT"
      className={`${pillClass} transition-colors duration-100 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
    >
      <OpenAiLogo />
      <span className="hidden sm:inline">Draw with ChatGPT</span>
      <span className="sm:hidden">ChatGPT</span>
      <SquareArrowOutUpRight
        size={14}
        strokeWidth={1.75}
        className="shrink-0 text-zinc-400"
        aria-hidden="true"
      />
      <span aria-hidden="true" className="dm-chatgpt-shine" />
    </a>
  );
}
