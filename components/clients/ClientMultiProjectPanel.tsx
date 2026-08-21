"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import type { MultiProjectAdminState } from "@/lib/client-multi-project-types";
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

type AdminState = MultiProjectAdminState;
type SecurityCodeRow = {
  codeHint?: string | null;
};

type MultiProjectResponse = AdminState & {
  error?: string;
  code?: string;
  id?: string;
};

async function multiProjectRequest(
  clientId: string,
  init?: RequestInit
): Promise<MultiProjectResponse> {
  const res = await fetch(`/api/clients/${clientId}/multi-project`, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = (await res.json().catch(() => ({}))) as MultiProjectResponse;
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" && data.error.trim()
        ? data.error
        : "Request failed"
    );
  }
  return data;
}

type Props = {
  clientId: string;
  open: boolean;
  /** Edit Client form id — Save Changes also persists group membership. */
  formId?: string;
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

function storedSecurityCode(row: SecurityCodeRow | null | undefined): string {
  const hint = row?.codeHint?.trim() ?? "";
  return hint.length > 2 ? hint : "";
}

export default function ClientMultiProjectPanel({
  clientId,
  open,
  formId,
}: Props) {
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
  const [selectedUngrouped, setSelectedUngrouped] = useState<string[]>([]);
  const [assignGroupId, setAssignGroupId] = useState("");

  function applyLoadedState(next: AdminState) {
    setState(next);
    setLoadError(null);
    setEnabled(next.multiProjectAccess ? "Yes" : "No");
    setMode(next.multiProjectSecurityMode ?? "MASTER_AND_GROUP");
  }

  function rememberAssignGroup(next: AdminState, preferredId?: string) {
    setAssignGroupId((current) => {
      const wanted = preferredId || current;
      if (wanted && next.projectGroups.some((group) => group.id === wanted)) {
        return wanted;
      }
      return next.projectGroups[0]?.id || "";
    });
  }

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code).then(
      () => toast.success(t("pages.clients.multiProject.codeCopied")),
      () => toast.error(t("pages.clients.multiProject.copyFailed"))
    );
  }

  function runGenerateCode(options: {
    kind: "MASTER" | "GROUP";
    groupId?: string;
    replaceExisting: boolean;
  }) {
    if (
      options.replaceExisting &&
      !window.confirm(t("pages.clients.multiProject.regenerateCodeConfirm"))
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const result = await multiProjectRequest(clientId, {
          method: "POST",
          body: JSON.stringify({
            op: "generateCode",
            kind: options.kind,
            groupId: options.groupId ?? null,
          }),
        });
        applyLoadedState(result);
        rememberAssignGroup(result);
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.clients.multiProject.generateCodeFailed")
        );
      }
    });
  }

  function addGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const created = await multiProjectRequest(clientId, {
          method: "POST",
          body: JSON.stringify({
            op: "addGroup",
            name,
          }),
        });
        setNewGroupName("");
        applyLoadedState(created);
        rememberAssignGroup(created, created.id);
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.clients.multiProject.addGroupFailed")
        );
      }
    });
  }

  function assignSelected() {
    if (!assignGroupId) {
      showRejectionFromError(
        t("pages.clients.multiProject.groupRequiredToAssign"),
        t("pages.clients.multiProject.assignFailed")
      );
      return;
    }
    if (selectedUngrouped.length === 0) {
      showRejectionFromError(
        t("pages.clients.multiProject.projectsRequiredToAssign"),
        t("pages.clients.multiProject.assignFailed")
      );
      return;
    }
    startTransition(async () => {
      try {
        const next = await multiProjectRequest(clientId, {
          method: "POST",
          body: JSON.stringify({
            op: "assign",
            groupId: assignGroupId,
            projectIds: selectedUngrouped,
          }),
        });
        setSelectedUngrouped([]);
        applyLoadedState(next);
        rememberAssignGroup(next, assignGroupId);
      } catch (error) {
        showRejectionFromError(
          error,
          t("pages.clients.multiProject.assignFailed")
        );
      }
    });
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fallback = t("pages.clients.multiProject.loadFailed");
    setLoadError(null);
    setState(null);
    multiProjectRequest(clientId)
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
    // `t` is omitted so language-switcher identity changes do not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId, reloadKey]);

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

  function renderCodeActions(options: {
    kind: "MASTER" | "GROUP";
    groupId?: string;
    row: SecurityCodeRow | null | undefined;
  }) {
    const fullCode = storedSecurityCode(options.row);
    const hint = options.row?.codeHint?.trim() ?? "";
    const hasCode = Boolean(fullCode || hint);

    return (
      <div className="mt-2">
        {fullCode ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-base tracking-wider text-text">
              {fullCode}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => copyCode(fullCode)}
            >
              {t("common.actions.copy")}
            </Button>
          </div>
        ) : hint ? (
          <p className="text-xs text-muted">
            {t("pages.clients.multiProject.codeHint", { hint })}{" "}
            {t("pages.clients.multiProject.codeMissingFull")}
          </p>
        ) : (
          <p className="text-xs text-muted">
            {t("pages.clients.multiProject.noCodeYet")}
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={pending}
          onClick={() =>
            runGenerateCode({
              kind: options.kind,
              groupId: options.groupId,
              replaceExisting: hasCode,
            })
          }
        >
          {hasCode
            ? t("pages.clients.multiProject.regenerateCode")
            : t("pages.clients.multiProject.generateCode")}
        </Button>
      </div>
    );
  }

  return (
    <div className={employeeDialogSectionClass}>
      {formId
        ? state.projects.map((project) => {
            const pendingGroupId =
              selectedUngrouped.includes(project.id) && assignGroupId
                ? assignGroupId
                : (project.groupId ?? "");
            return (
              <input
                key={project.id}
                type="hidden"
                form={formId}
                name={`mpProjectGroup.${project.id}`}
                value={pendingGroupId}
              />
            );
          })
        : null}

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
          onChange={(value) => {
            setEnabled(value);
            startTransition(async () => {
              try {
                const result = await multiProjectRequest(clientId, {
                  method: "POST",
                  body: JSON.stringify({
                    op: "saveSettings",
                    enabled: value === "Yes",
                    mode,
                  }),
                });
                applyLoadedState(result);
                rememberAssignGroup(result);
              } catch (error) {
                showRejectionFromError(
                  error,
                  t("pages.clients.multiProject.saveFailed")
                );
              }
            });
          }}
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
            onChange={(value) => {
              const nextMode = value as "GROUP_ONLY" | "MASTER_AND_GROUP";
              setMode(nextMode);
              startTransition(async () => {
                try {
                  const result = await multiProjectRequest(clientId, {
                    method: "POST",
                    body: JSON.stringify({
                      op: "saveSettings",
                      enabled: true,
                      mode: nextMode,
                    }),
                  });
                  applyLoadedState(result);
                  rememberAssignGroup(result);
                } catch (error) {
                  showRejectionFromError(
                    error,
                    t("pages.clients.multiProject.saveFailed")
                  );
                }
              });
            }}
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
              const result = await multiProjectRequest(clientId, {
                method: "POST",
                body: JSON.stringify({
                  op: "saveSettings",
                  enabled: enabled === "Yes",
                  mode,
                }),
              });
              applyLoadedState(result);
              rememberAssignGroup(result);
              if (result.readyPrompt) {
                toast.message(t("pages.clients.multiProject.readyTitle"));
              } else {
                toast.success(t("pages.clients.multiProject.saveSettings"));
              }
            } catch (error) {
              showRejectionFromError(
                error,
                t("pages.clients.multiProject.saveFailed")
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
              {renderCodeActions({
                kind: "MASTER",
                row: state.masterCode,
              })}
            </div>
          ) : null}

          <div className="mt-6">
            <p className="text-sm font-semibold text-text">
              {t("pages.clients.multiProject.groups")}
            </p>
            <p className="mt-1 text-xs text-muted">
              {t("pages.clients.multiProject.addGroupHint")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder={t("pages.clients.multiProject.groupName")}
                className={cn(employeeInputClass, "max-w-xs")}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addGroup();
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !newGroupName.trim()}
                onClick={addGroup}
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
                            const next = await multiProjectRequest(clientId, {
                              method: "POST",
                              body: JSON.stringify({
                                op: "deleteGroup",
                                groupId: group.id,
                              }),
                            });
                            applyLoadedState(next);
                            rememberAssignGroup(next);
                          } catch (error) {
                            showRejectionFromError(
                              error,
                              t("pages.clients.multiProject.deleteGroupFailed")
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
                  <p className="mt-2 text-xs font-medium text-text">
                    {t("pages.clients.multiProject.groupCode")}
                  </p>
                  {renderCodeActions({
                    kind: "GROUP",
                    groupId: group.id,
                    row: group.securityCodes[0],
                  })}
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
            {state.ungrouped.length > 0 && state.projectGroups.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-text">
                  {t("pages.clients.multiProject.assignTo")}
                </label>
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
                  onClick={assignSelected}
                >
                  {t("pages.clients.multiProject.assign")}
                </Button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

    </div>
  );
}
