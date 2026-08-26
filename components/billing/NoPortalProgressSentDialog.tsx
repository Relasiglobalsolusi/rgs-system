"use client";

import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/use-t";
import { FileWarning } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function NoPortalProgressSentDialog({
  open,
  onOpenChange,
}: Props) {
  const { t } = useT();

  return (
    <Dialog skipUnsavedGuard open={open} onOpenChange={onOpenChange}>
      <EmployeeDialogShell
        icon={FileWarning}
        title={t("pages.reconciliation.noPortalSentTitle")}
        description={t("pages.reconciliation.noPortalSentLead")}
        maxWidth="lg"
        footer={
          <EmployeePrimaryButton onClick={() => onOpenChange(false)}>
            {t("pages.reconciliation.noPortalSentConfirm")}
          </EmployeePrimaryButton>
        }
      >
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-6 text-text">
          <li>{t("pages.reconciliation.noPortalSentStepDownload")}</li>
          <li>{t("pages.reconciliation.noPortalSentStepReply")}</li>
          <li>{t("pages.reconciliation.noPortalSentStepApprove")}</li>
          <li>{t("pages.reconciliation.noPortalSentStepInvoice")}</li>
          <li>{t("pages.reconciliation.noPortalSentStepPayment")}</li>
          <li>{t("pages.reconciliation.noPortalSentStepTax")}</li>
        </ol>
      </EmployeeDialogShell>
    </Dialog>
  );
}
