import { redirect } from "next/navigation";

/** The editor now lives at /; keep legacy /editor links working. */
export default function EditorPage() {
  redirect("/");
}
