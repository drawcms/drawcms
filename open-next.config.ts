import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Zero-binding one-click deploy: the editor is a client-side, local-first
 * app with no ISR or data APIs, so the default dummy incremental/tag/queue
 * caches are correct — no KV, R2, or queues to provision.
 */
export default defineCloudflareConfig();
