"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  completeTransferOrderItemReturn,
  escalateTransferOrderNeedsAttention,
  markTransferOrderSent,
  resolveTransferOrderAssignToProject,
  resolveTransferOrderAssignToStock,
  resolveTransferOrderWriteOff,
  type TransferAssignProjectOption,
} from "@/app/transfer-orders/actions";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { Button } from "@/components/ui/button";
import SearchableProjectSelect from "@/components/ui/SearchableProjectSelect";
import { useT } from "@/lib/i18n/use-t";

export function SendTransferOrderButton({ id }: { id: string }) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      onClick={() => {
        const formData = new FormData();
        formData.set("id", id);
        startTransition(async () => {
          try {
            await markTransferOrderSent(formData);
            toast.success(t("pages.transferOrders.sent"));
          } catch (error) {
            showRejectionFromError(
              error,
              t("pages.transferOrders.sendFailed")
            );
          }
        });
      }}
    >
      {t("pages.transferOrders.markSent")}
    </Button>
  );
}

export function WarehouseItemReturnActions({ id }: { id: string }) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();

  function run(
    action: (formData: FormData) => Promise<void>,
    successKey: "pages.transferOrders.itemReturnCompleted" | "pages.transferOrders.escalated"
  ) {
    const formData = new FormData();
    formData.set("id", id);
    startTransition(async () => {
      try {
        await action(formData);
        toast.success(t(successKey));
      } catch (error) {
        showRejectionFromError(
          error,
          successKey === "pages.transferOrders.itemReturnCompleted"
            ? t("pages.transferOrders.itemReturnFailed")
            : t("pages.transferOrders.escalateFailed")
        );
      }
    });
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(
            completeTransferOrderItemReturn,
            "pages.transferOrders.itemReturnCompleted"
          )
        }
      >
        {t("pages.transferOrders.completeItemReturn")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          run(
            escalateTransferOrderNeedsAttention,
            "pages.transferOrders.escalated"
          )
        }
      >
        {t("pages.transferOrders.needsAttention")}
      </Button>
    </div>
  );
}

export function ManagerNeedsAttentionActions({
  id,
  defaultProjectId,
  projects,
}: {
  id: string;
  defaultProjectId: string;
  projects: TransferAssignProjectOption[];
}) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(defaultProjectId);
  const options = projects.some((project) => project.id === defaultProjectId)
    ? projects
    : [
        {
          id: defaultProjectId,
          name: t("pages.transferOrders.originalProject"),
          clientName: "",
        },
        ...projects,
      ];

  function run(
    action: (formData: FormData) => Promise<void>,
    successKey:
      | "pages.transferOrders.writeOffDone"
      | "pages.transferOrders.assignToProjectDone"
      | "pages.transferOrders.assignToStockDone",
    failKey:
      | "pages.transferOrders.writeOffFailed"
      | "pages.transferOrders.assignToProjectFailed"
      | "pages.transferOrders.assignToStockFailed",
    includeProject?: boolean
  ) {
    const formData = new FormData();
    formData.set("id", id);
    if (includeProject) formData.set("projectId", projectId);
    startTransition(async () => {
      try {
        await action(formData);
        toast.success(t(successKey));
      } catch (error) {
        showRejectionFromError(error, t(failKey));
      }
    });
  }

  return (
    <div className="flex w-full min-w-[16rem] flex-col gap-2 sm:max-w-md">
      <div className="text-sm text-subtle">
        <span className="mb-1 block font-medium text-text">
          {t("pages.transferOrders.assignToProject")}
        </span>
        <SearchableProjectSelect
          value={projectId}
          onValueChange={setProjectId}
          projects={options}
          placeholder={t("pages.transferOrders.assignToProject")}
          disabled={pending}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(
              resolveTransferOrderWriteOff,
              "pages.transferOrders.writeOffDone",
              "pages.transferOrders.writeOffFailed"
            )
          }
        >
          {t("pages.transferOrders.writeOffStock")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              resolveTransferOrderAssignToProject,
              "pages.transferOrders.assignToProjectDone",
              "pages.transferOrders.assignToProjectFailed",
              true
            )
          }
        >
          {t("pages.transferOrders.assignToProject")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(
              resolveTransferOrderAssignToStock,
              "pages.transferOrders.assignToStockDone",
              "pages.transferOrders.assignToStockFailed"
            )
          }
        >
          {t("pages.transferOrders.assignToStock")}
        </Button>
      </div>
    </div>
  );
}
