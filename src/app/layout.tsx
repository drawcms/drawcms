import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-drawcms-sans",
  display: "swap",
});

const display = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-drawcms-display",
  display: "swap",
});

const themeBootScript = `(() => {
  try {
    const saved = localStorage.getItem("drawcms-theme") || "system";
    const dark = saved === "dark" || (saved === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = saved;
  } catch {}
})();`;

export const metadata: Metadata = {
  title: "DrawCMS — Animated technical diagrams",
  description:
    "Open-source editor for animated technical diagrams. Import from draw.io or Excalidraw, sequence motion, export PNG/GIF locally — all local, no account. SVG, MP4, and sharing unlock with DrawCMS Cloud.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full antialiased ${sans.variable} ${display.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
