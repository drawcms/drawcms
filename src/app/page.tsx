"use client";

import { EditorHost } from "./editor-host";

/** The OSS app is the editor; the marketing site lives in DrawCMS Cloud. */
export default function Home() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <EditorHost />
    </div>
  );
}
