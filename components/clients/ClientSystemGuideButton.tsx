"use client";

import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";

import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import DirectoryAddButton from "@/components/ui/DirectoryAddButton";
import { Dialog } from "@/components/ui/dialog";
import SearchableClientSelect from "@/components/ui/SearchableClientSelect";
import {
  showRejection,
  showRejectionFromError,
} from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";

type ClientOption = {
  id: string;
  name: string;
};

type Props = {
  clients: readonly ClientOption[];
  disabled?: boolean;
};

export default function ClientSystemGuideButton({
  clients,
  disabled = false,
}: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [pending, setPending] = useState(false);

  const activeClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name, "en")),
    [clients]
  );

  async function download() {
    if (!clientId) {
      showRejection({
        reasons: t("pages.clients.systemGuidePickClient"),
      });
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/clients/system-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (!response.ok) {
        let message = t("pages.clients.downloadSystemGuideFailed");
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          /* keep default */
        }
        showRejection({ reasons: message });
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const header = response.headers.get("Content-Disposition") ?? "";
      const match = header.match(/filename="([^"]+)"/);
      link.href = url;
      link.download = match?.[1] ?? "RGS-ONE-System-Guide.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
      setClientId("");
    } catch (error) {
      showRejectionFromError(
        error,
        t("pages.clients.downloadSystemGuideFailed")
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DirectoryAddButton
        label={t("pages.clients.downloadSystemGuide")}
        variant="warningBadge"
        icon={<FileDown className="h-3.5 w-3.5 shrink-0" />}
        disabled={disabled}
        onClick={() => setOpen(true)}
      />

      <Dialog
        skipUnsavedGuard
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
          if (!next) setClientId("");
        }}
      >
        <EmployeeDialogShell
          icon={FileDown}
          title={t("pages.clients.downloadSystemGuide")}
          description={t("pages.clients.systemGuidePickDescription")}
          maxWidth="sm"
          footer={
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
              <EmployeeSecondaryButton
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                {t("common.actions.cancel")}
              </EmployeeSecondaryButton>
              <EmployeePrimaryButton
                type="button"
                disabled={pending || !clientId}
                onClick={() => {
                  void download();
                }}
              >
                {pending
                  ? t("pages.clients.downloadingSystemGuide")
                  : t("pages.clients.downloadSystemGuide")}
              </EmployeePrimaryButton>
            </div>
          }
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted">
              {t("pages.clients.systemGuideForClient")}
            </label>
            <SearchableClientSelect
              value={clientId}
              onValueChange={setClientId}
              clients={activeClients}
              placeholder={t("pages.clients.systemGuidePickClient")}
              disabled={pending || activeClients.length === 0}
            />
            {activeClients.length === 0 ? (
              <p className="text-sm text-subtle">
                {t("pages.clients.emptyActiveListDesc")}
              </p>
            ) : null}
          </div>
        </EmployeeDialogShell>
      </Dialog>
    </>
  );
}
