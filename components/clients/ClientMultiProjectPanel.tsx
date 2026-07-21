"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  assignProjectsToGroup,
  createClientProjectGroup,
  deleteClientProjectGroup,
  generateClientSecurityCode,
  getClientMultiProjectAdminState,
  updateMultiProjectSettings,
} from "@/app/clients/multi-project-actions";
import {
  employeeDialogFieldClass,
  employeeDialogHintClass,
  employeeDialogLabelClass,
  employeeDialogSectionClass,
  employeeDialogSectionHeadingClass,
  employeeInputClass,
  EmployeePrimaryButton,
} from "@/components/employees/employee-dialog-ui";
import ProjectOptionPills from "@/components/projects/ProjectOptionPills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import YesNoChoiceCards, {
  type YesNoChoice,
} from "@/components/ui/YesNoChoiceCards";
import { showRejectionFromError } from "@/components/ui/rejection-notice";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

type AdminState = Awaited<ReturnType<typeof getClientMultiProjectAdminState>>;

type Props = {
  clientId: string;
  open: boolean;
};

function loadErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

export default function ClientMultiProjectPanel({ clientId, open }: Props) {
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<AdminState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [enabled, setEnabled] = useState<YesNoChoice>("No");
  const [mode, setMode] = useState<"GROUP_ONLY" | "MASTER_AND_GROUP">(
    "MASTER_AND_GROUP"
  );
  const [newGroupName, setNewGroupName] = useState("");
  const [plaintextCode, setPlaintextCode] = useState<string | null>(null);
  const [selectedUngrouped, setSelectedUngrouped] = useState<string[]>([]);
  const [assignGroupId, setAssignGroupId] = useState("");

  function applyLoadedState(next: AdminState) {
    setState(next);
    setLoadError(null);
    setEnabled(next.multiProjectAccess ? "Yes" : "No");
    setMode(next.multiProjectSecurityMode ?? "MASTER_AND_GROUP");
  }

  function reload() {
    return getClientMultiProjectAdminState(clientId).then((next) => {
      applyLoadedState(next);
      setAssignGroupId((current) => current || next.projectGroups[0]?.id || "");
    });
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fallback = t("pages.clients.multiProject.loadFailed");
    setLoadError(null);
    setState(null);
    getClientMultiProjectAdminState(clientId)
      .then((next) => {
        if (cancelled) return;
        applyLoadedState(next);
        setAssignGroupId(next.projectGroups[0]?.id ?? "");
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(loadErrorMessage(error, fallback));
        setState(null);
        showRejectionFromError(error, fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [open, clientId, reloadKey, t]);

  if (loadError) {
    return (
      <div className={employeeDialogSectionClass}>
        <div className={employeeDialogSectionHeadingClass}>
          <h3 className="text-sm font-semibold text-text">
            {t("pages.clients.multiProject.title")}
          </h3>
        </div>
        <p className="text-sm leading-6 text-text">{loadError}</p>
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() => setReloadKey((key) => key + 1)}
        >
          {t("pages.clients.multiProject.retry")}
        </Button>
      </div>
    );
  }

  if (!state) {
    return (
      <div className={employeeDialogSectionClass}>
        <p className="text-sm text-muted">
          {t("pages.clients.multiProject.loading")}
        </p>
      </div>
    );
  }

  return (
    <div className={employeeDialogSectionClass}>
      <div className={employeeDialogSectionHeadingClass}>
        <h3 className="text-sm font-semibold text-text">
          {t("pages.clients.multiProject.title")}
        </h3>
        <p className={employeeDialogHintClass}>
          {t("pages.clients.multiProject.description")}
        </p>
      </div>

      {state.readyPrompt ? (
        <div className="mb-4 rounded-xl border border-border bg-elevated/60 px-4 py-3">
          <p className="text-sm font-semibold text-text">
            {t("pages.clients.multiProject.readyTitle")}
          </p>
          <p className="mt-1 text-xs text-muted">
            {t("pages.clients.multiProject.readyBody")}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>
          {t("pages.clients.multiProject.countable", {
            count: state.countableProjects,
          })}
        </span>
        {state.active ? (
          <span className="rounded-md bg-accent/15 px-2 py-0.5 font-medium text-text">
            {t("pages.clients.multiProject.activeBadge")}
          </span>
        ) : state.multiProjectAccess ? (
          <span className="rounded-md bg-elevated px-2 py-0.5 font-medium text-muted">
            {t("pages.clients.multiProject.armedBadge")}
          </span>
        ) : null}
      </div>

      <div className={cn(employeeDialogFieldClass, "mt-4")}>
        <label
          id={`mp-enabled-${clientId}`}
          className={employeeDialogLabelClass}
        >
          {t("pages.clients.multiProject.enabled")}
        </label>
        <YesNoChoiceCards
          id={`mp-enabled-cards-${clientId}`}
          labelledBy={`mp-enabled-${clientId}`}
          value={enabled}
          onChange={setEnabled}
        />
      </div>

      {enabled === "Yes" ? (
        <div className="mt-4">
          <ProjectOptionPills
            label={t("pages.clients.multiProject.securityMode")}
            value={mode}
            options={[
              {
                value: "GROUP_ONLY",
                label: t("pages.clients.multiProject.modeGroupOnly"),
              },
              {
                value: "MASTER_AND_GROUP",
                label: t("pages.clients.multiProject.modeMasterAndGroup"),
              },
            ]}
            onChange={(value) =>
              setMode(value as "GROUP_ONLY" | "MASTER_AND_GROUP")
            }
            columns={2}
          />
        </div>
      ) : null}

      <EmployeePrimaryButton
        type="button"
        className="mt-4"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            try {
              const fd = new FormData();
              fd.set("multiProjectAccess", enabled === "Yes" ? "yes" : "no");
              fd.set("multiProjectSecurityMode", mode);
              const result = await updateMultiProjectSettings(clientId, fd);
              await reload();
              if (result.readyPrompt) {
                toast.message(t("pages.clients.multiProject.readyTitle"));
              } else {
                toast.success(t("pages.clients.multiProject.saveSettings"));
              }
            } catch (error) {
              showRejectionFromError(
                error,
                "Failed to save Multi-Project settings."
              );
            }
          });
        }}
      >
        {t("pages.clients.multiProject.saveSettings")}
      </EmployeePrimaryButton>

      {enabled === "Yes" ? (
        <>
          {mode === "MASTER_AND_GROUP" ? (
            <div className="mt-6 rounded-xl border border-border px-4 py-3">
              <p className="text-sm font-medium text-text">
                {t("pages.clients.multiProject.masterCode")}
              </p>
              <p className="mt-1 text-xs text-muted">
                {state.masterCode?.codeHint
                  ? t("pages.clients.multiProject.codeHint", {
                      hint: state.masterCode.codeHint,
                    })
                  : t("pages.clients.multiProject.noCodeYet")}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const result = await generateClientSecurityCode({
                        clientId,
                        kind: "MASTER",
                      });
                      setPlaintextCode(result.code);
                      await reload();
                    } catch (error) {
                      showRejectionFromError(
                        error,
                        "Failed to generate Security Code."
                      );
                    }
                  });
                }}
              >
                {t("pages.clients.multiProject.generateCode")}
              </Button>
            </div>
          ) : null}

          <div className="mt-6">
            <p className="text-sm font-semibold text-text">
              {t("pages.clients.multiProject.groups")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder={t("pages.clients.multiProject.groupName")}
                className={cn(employeeInputClass, "max-w-xs")}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !newGroupName.trim()}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const fd = new FormData();
                      fd.set("name", newGroupName);
                      await createClientProjectGroup(clientId, fd);
                      setNewGroupName("");
                      await reload();
                    } catch (error) {
                      showRejectionFromError(error, "Failed to add group.");
                    }
                  });
                }}
              >
                {t("pages.clients.multiProject.addGroup")}
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              {state.projectGroups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-xl border border-border px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text">{group.name}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await deleteClientProjectGroup(group.id);
                            await reload();
                          } catch (error) {
                            showRejectionFromError(
                              error,
                              "Failed to delete group."
                            );
                          }
                        });
                      }}
                    >
                      {t("common.actions.delete")}
                    </Button>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-muted">
                    {group.projects.length === 0 ? (
                      <li>—</li>
                    ) : (
                      group.projects.map((project) => (
                        <li key={project.id}>{project.name}</li>
                      ))
                    )}
                  </ul>
                  <p className="mt-2 text-xs text-muted">
                    {group.securityCodes[0]?.codeHint
                      ? t("pages.clients.multiProject.codeHint", {
                          hint: group.securityCodes[0].codeHint,
                        })
                      : t("pages.clients.multiProject.noCodeYet")}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          const result = await generateClientSecurityCode({
                            clientId,
                            kind: "GROUP",
                            groupId: group.id,
                          });
                          setPlaintextCode(result.code);
                          await reload();
                        } catch (error) {
                          showRejectionFromError(
                            error,
                            "Failed to generate Security Code."
                          );
                        }
                      });
                    }}
                  >
                    {t("pages.clients.multiProject.groupCode")}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border px-4 py-3">
            <p className="text-sm font-medium text-text">
              {t("pages.clients.multiProject.ungrouped")}
            </p>
            <p className="mt-1 text-xs text-muted">
              {t("pages.clients.multiProject.ungroupedWarning")}
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-sm">
              {state.ungrouped.length === 0 ? (
                <li className="text-muted">—</li>
              ) : (
                state.ungrouped.map((project) => {
                  const checked = selectedUngrouped.includes(project.id);
                  return (
                    <li key={project.id}>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedUngrouped((prev) =>
                              checked
                                ? prev.filter((id) => id !== project.id)
                                : [...prev, project.id]
                            );
                          }}
                        />
                        {project.name}
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
            {state.projectGroups.length > 0 && state.ungrouped.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  className={employeeInputClass}
                  value={assignGroupId}
                  onChange={(event) => setAssignGroupId(event.target.value)}
                >
                  {state.projectGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending || selectedUngrouped.length === 0}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await assignProjectsToGroup(
                          clientId,
                          assignGroupId || null,
                          selectedUngrouped
                        );
                        setSelectedUngrouped([]);
                        await reload();
                      } catch (error) {
                        showRejectionFromError(
                          error,
                          "Failed to assign projects."
                        );
                      }
                    });
                  }}
                >
                  {t("pages.clients.multiProject.assign")}
                </Button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {plaintextCode ? (
        <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
          <p className="text-xs text-muted">
            {t("pages.clients.multiProject.codeGenerated")}
          </p>
          <p className="mt-2 font-mono text-lg tracking-wider text-text">
            {plaintextCode}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(plaintextCode);
                toast.success("Security Code copied.");
              } catch {
                toast.error("Could not copy. Select and copy manually.");
              }
            }}
          >
            {t("common.actions.copy")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
