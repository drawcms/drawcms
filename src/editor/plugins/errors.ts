export type PluginErrorCode =
  | "API_VERSION_MISMATCH"
  | "DUPLICATE_PLUGIN_ID"
  | "DUPLICATE_CONTRIBUTION"
  | "CONTRIBUTION_NOT_FOUND";

export class PluginRegistrationError extends Error {
  constructor(
    readonly code: PluginErrorCode,
    message: string,
    readonly pluginId?: string,
  ) {
    super(message);
    this.name = "PluginRegistrationError";
  }
}
