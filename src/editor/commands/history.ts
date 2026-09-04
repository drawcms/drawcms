import type { EditorCommand } from "./commands";
import type { EditorSnapshot } from "./operations";

/**
 * Snapshot-based undo/redo over the command boundary. `execute` records the
 * pre-command snapshot whenever a command actually changed state; commands
 * that return the same reference (no-ops like selecting-only operations) are
 * never recorded, so history captures meaningful actions only.
 */
export class CommandHistory {
  private past: EditorSnapshot[] = [];
  private future: EditorSnapshot[] = [];

  constructor(private readonly limit = 50) {}

  execute(state: EditorSnapshot, command: EditorCommand): EditorSnapshot {
    const next = command.apply(state);
    if (next === state) return state;
    this.past = [...this.past.slice(-(this.limit - 1)), state];
    this.future = [];
    return next;
  }

  undo(state: EditorSnapshot): EditorSnapshot | null {
    const previous = this.past[this.past.length - 1];
    if (!previous) return null;
    this.past = this.past.slice(0, -1);
    this.future = [...this.future, state];
    return previous;
  }

  redo(state: EditorSnapshot): EditorSnapshot | null {
    const next = this.future[this.future.length - 1];
    if (!next) return null;
    this.future = this.future.slice(0, -1);
    this.past = [...this.past, state];
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get size(): number {
    return this.past.length;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
