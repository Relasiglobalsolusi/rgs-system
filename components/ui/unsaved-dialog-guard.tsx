"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type CloseHandler = (open: boolean, eventDetails?: { cancel?: () => void }) => void;

type UnsavedDialogGuardContextValue = {
  skip: boolean;
  registerRoot: (node: HTMLElement | null) => void;
  requestClose: (proceed: () => void) => boolean;
  closeDialog: () => void;
  confirmOpen: boolean;
  confirmDiscard: () => void;
  cancelDiscard: () => void;
};

const UnsavedDialogGuardContext =
  createContext<UnsavedDialogGuardContextValue | null>(null);

export function snapshotDialogFields(root: ParentNode): string {
  const parts: string[] = [];
  root.querySelectorAll("input, select, textarea").forEach((node) => {
    if (
      !(
        node instanceof HTMLInputElement ||
        node instanceof HTMLSelectElement ||
        node instanceof HTMLTextAreaElement
      )
    ) {
      return;
    }
    if (node.type === "button" || node.type === "submit" || node.type === "reset") {
      return;
    }
    if (node instanceof HTMLInputElement && (node.type === "checkbox" || node.type === "radio")) {
      parts.push(`${node.name || node.id}:${node.type}:${node.value}:${node.checked ? "1" : "0"}`);
      return;
    }
    if (node instanceof HTMLInputElement && node.type === "file") {
      const files = Array.from(node.files ?? [])
        .map((file) => `${file.name}:${file.size}`)
        .join(",");
      parts.push(`${node.name || node.id}:file:${files}`);
      return;
    }
    parts.push(`${node.name || node.id}:${node.value}`);
  });
  root.querySelectorAll("[aria-checked='true'], [aria-pressed='true']").forEach((node) => {
    const label = (node.textContent || "").replace(/\s+/g, " ").trim();
    parts.push(`aria:${node.id || label}`);
  });
  root.querySelectorAll("[data-slot='select-trigger']").forEach((node) => {
    const label = (node.textContent || "").replace(/\s+/g, " ").trim();
    parts.push(`select:${node.id || label}`);
  });
  return parts.join("\n");
}

export function UnsavedDialogGuardProvider({
  skip = false,
  onRequestClose,
  children,
}: {
  skip?: boolean;
  onRequestClose?: CloseHandler;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const baselineRef = useRef("");
  const dirtyRef = useRef(false);
  const pendingDetachRef = useRef(false);
  const pendingProceedRef = useRef<(() => void) | null>(null);
  const onRequestCloseRef = useRef(onRequestClose);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  onRequestCloseRef.current = onRequestClose;

  const captureBaseline = useCallback(() => {
    const root = rootRef.current;
    baselineRef.current = root ? snapshotDialogFields(root) : "";
  }, []);

  const detachRoot = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    rootRef.current = null;
    baselineRef.current = "";
    dirtyRef.current = false;
  }, []);

  const attachRoot = useCallback(
    (node: HTMLElement) => {
      cleanupRef.current?.();
      rootRef.current = node;
      dirtyRef.current = false;
      baselineRef.current = "";

      const markDirty = () => {
        dirtyRef.current = true;
      };
      const recaptureIfPristine = () => {
        if (!dirtyRef.current) captureBaseline();
      };

      node.addEventListener("input", markDirty, true);
      node.addEventListener("change", markDirty, true);

      const observer = new MutationObserver(() => {
        if (!dirtyRef.current) {
          window.setTimeout(recaptureIfPristine, 40);
        }
      });
      observer.observe(node, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });

      const timers = [
        window.setTimeout(recaptureIfPristine, 50),
        window.setTimeout(recaptureIfPristine, 200),
        window.setTimeout(recaptureIfPristine, 500),
      ];

      cleanupRef.current = () => {
        node.removeEventListener("input", markDirty, true);
        node.removeEventListener("change", markDirty, true);
        observer.disconnect();
        timers.forEach((timer) => window.clearTimeout(timer));
      };

      recaptureIfPristine();
    },
    [captureBaseline],
  );

  const registerRoot = useCallback(
    (node: HTMLElement | null) => {
      if (skip) {
        detachRoot();
        return;
      }

      if (node == null) {
        pendingDetachRef.current = true;
        queueMicrotask(() => {
          if (pendingDetachRef.current) detachRoot();
        });
        return;
      }

      pendingDetachRef.current = false;
      if (node === rootRef.current) return;
      attachRoot(node);
    },
    [attachRoot, detachRoot, skip],
  );

  const isDirty = useCallback(() => {
    if (skip) return false;
    if (dirtyRef.current) return true;
    const root = rootRef.current;
    if (!root) return false;
    return snapshotDialogFields(root) !== baselineRef.current;
  }, [skip]);

  const requestClose = useCallback(
    (proceed: () => void) => {
      if (skip || !isDirty()) {
        proceed();
        return false;
      }
      pendingProceedRef.current = proceed;
      setConfirmOpen(true);
      return true;
    },
    [isDirty, skip],
  );

  const closeDialog = useCallback(() => {
    onRequestCloseRef.current?.(false);
  }, []);

  const confirmDiscard = useCallback(() => {
    const proceed = pendingProceedRef.current;
    pendingProceedRef.current = null;
    dirtyRef.current = false;
    setConfirmOpen(false);
    proceed?.();
  }, []);

  const cancelDiscard = useCallback(() => {
    pendingProceedRef.current = null;
    setConfirmOpen(false);
  }, []);

  const value = useMemo<UnsavedDialogGuardContextValue>(
    () => ({
      skip,
      registerRoot,
      requestClose,
      closeDialog,
      confirmOpen,
      confirmDiscard,
      cancelDiscard,
    }),
    [
      cancelDiscard,
      closeDialog,
      confirmDiscard,
      confirmOpen,
      registerRoot,
      requestClose,
      skip,
    ],
  );

  return (
    <UnsavedDialogGuardContext.Provider value={value}>
      {children}
    </UnsavedDialogGuardContext.Provider>
  );
}

export function useUnsavedDialogGuard() {
  return useContext(UnsavedDialogGuardContext);
}
