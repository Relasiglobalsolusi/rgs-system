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
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, HelpCircle } from "lucide-react";

import {
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export type ConfirmTone = "danger" | "primary";

export type ConfirmRequest = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: LucideIcon;
};

type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within ConfirmProvider.");
  }
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useT();
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const close = useCallback((value: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setRequest(null);
    resolve?.(value);
  }, []);

  const confirm = useCallback<ConfirmFn>((next) => {
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setRequest(next);
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);
  const tone = request?.tone ?? "primary";
  const Icon =
    request?.icon ?? (tone === "danger" ? AlertTriangle : HelpCircle);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={request != null}
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden rounded-2xl border border-border bg-panel p-0 text-text ring-0 sm:max-w-sm"
        >
          <div className="px-8 pt-8 pb-7 sm:px-10">
            <DialogHeader className="items-center gap-4 text-center">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl ring-1",
                  tone === "danger"
                    ? "bg-card-tint-amber ring-amber-500/25"
                    : "bg-elevated ring-border"
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6",
                    tone === "danger" ? "text-warning" : "text-primary"
                  )}
                />
              </div>
              <div className="space-y-2.5">
                <DialogTitle className="text-lg font-semibold text-text">
                  {request?.title ?? t("common.confirm.title")}
                </DialogTitle>
                <DialogDescription className="whitespace-pre-line text-sm leading-6 text-muted">
                  {request?.description ?? ""}
                </DialogDescription>
              </div>
            </DialogHeader>
          </div>
          <DialogFooter className="mx-0 mb-0 mt-0 flex-col gap-3 rounded-none border-t border-border bg-strip px-8 py-6 sm:flex-col sm:justify-stretch sm:px-10">
            <EmployeePrimaryButton
              type="button"
              variant={tone === "danger" ? "danger" : "primary"}
              onClick={() => close(true)}
            >
              {request?.confirmLabel ?? t("common.actions.confirm")}
            </EmployeePrimaryButton>
            <EmployeeSecondaryButton onClick={() => close(false)}>
              {request?.cancelLabel ?? t("common.actions.cancel")}
            </EmployeeSecondaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
