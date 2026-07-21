"use client";

import { useCallback, useState } from "react";

export type DirectoryDialogControlProps = {
  /** Controlled open state (e.g. from DirectoryCard overflow menu). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * When false, the built-in trigger button is omitted.
   * Open the dialog via controlled `open` / `onOpenChange`.
   * @default true
   */
  showTrigger?: boolean;
};

/**
 * Controllable open state for directory-card dialogs that may be opened
 * from a built-in trigger or from an overflow menu item.
 */
export function useDirectoryDialogOpen(
  controlledOpen: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined
) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  return { open, setOpen };
}
