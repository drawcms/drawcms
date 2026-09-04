"use client";

import { useEffect, useState } from "react";
import { SquareArrowOutUpRight } from "lucide-react";

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

/**
 * Standalone dark pill beside the canvas controls: deep links into the
 * ChatGPT desktop app (codex://browser) pointed at this editor page with the
 * WebMCP connected flag set. When the page itself was opened through that
 * link, the entry becomes a "Connected" status and the shine stops.
 */
export function ChatGptButton() {
  const [link, setLink] = useState<ChatGptLink | null>(null);

  useEffect(() => {
    // Reading window.location is mount-only external state; defer the update
    // one microtask so the effect body stays synchronous-setState-free.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const url = new URL(window.location.href);
      const connected = url.searchParams.get("webmcpconnected") === "true";
      url.hash = "";
      url.searchParams.set("webmcpconnected", "true");
      setLink({
        href: `codex://browser?url=${encodeURIComponent(url.toString())}`,
        connected,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!link) return null;

  const pillClass =
    "relative flex min-h-10 items-center gap-2 overflow-hidden rounded-full bg-zinc-950 px-3.5 py-2 text-sm font-semibold text-white shadow-md";

  if (link.connected) {
    return (
      <span role="status" aria-label="ChatGPT connected" className={pillClass}>
        <OpenAiLogo />
        <span className="hidden sm:inline">Connected</span>
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-emerald-400" />
      </span>
    );
  }

  return (
    <a
      href={link.href}
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
