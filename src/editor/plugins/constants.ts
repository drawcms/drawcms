/**
 * The public plugin API version (DM-013). Plugins declare the version they
 * were built against; hosts refuse plugins targeting a different version so
 * breaking changes fail loudly at registration, not mysteriously at runtime.
 * See content/docs/public-api-versioning.md.
 */
export const EDITOR_API_VERSION = 2 as const;
