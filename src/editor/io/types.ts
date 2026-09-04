/** Shared result vocabulary for every importer (DM-016, DM-017). */
export interface ImportIssue {
  severity: "info" | "warning";
  message: string;
}

export interface ImportOutcome {
  /** Raw payload fed through migrateDocument (document v1 or legacy v0). */
  document: unknown;
  issues?: ImportIssue[];
}

/** Narrow a parse result to the with-report shape without trusting blindly. */
export function isImportOutcome(value: unknown): value is ImportOutcome {
  return (
    value !== null && typeof value === "object" && "document" in (value as Record<string, unknown>)
  );
}

export function info(message: string): ImportIssue {
  return { severity: "info", message };
}

export function warning(message: string): ImportIssue {
  return { severity: "warning", message };
}
