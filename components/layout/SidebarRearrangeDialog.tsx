"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  PanelLeft,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

import { updateMySidebarOrder } from "@/app/sidebar/actions";
import {
  EmployeeDialogShell,
  EmployeePrimaryButton,
  EmployeeSecondaryButton,
} from "@/components/employees/employee-dialog-ui";
import { Dialog } from "@/components/ui/dialog";
import {
  getMenuForUser,
  getMenuItemNavKey,
  type MenuChildItem,
  type MenuItem,
  type MenuSection,
} from "@/lib/permissions";
import { localizeNavLabel } from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/locale";
import { useT } from "@/lib/i18n/use-t";
import {
  applySidebarOrder,
  type SidebarOrder,
} from "@/lib/sidebar-order";
import type { EmployeeType, UserRole } from "@prisma/client";

function sectionsToOrder(sections: MenuSection[]): SidebarOrder {
  const order: SidebarOrder = {
    sectionOrder: sections.map((section) => section.title),
    sections: {},
    children: {},
  };
  for (const section of sections) {
    order.sections[section.title] = section.items.map((item) =>
      getMenuItemNavKey(item)
    );
    for (const item of section.items) {
      if (item.children?.length) {
        order.children[getMenuItemNavKey(item)] = item.children.map(
          (child) => child.href
        );
      }
    }
  }
  return order;
}

function reorderSections(
  sections: MenuSection[],
  fromIndex: number,
  toIndex: number
): MenuSection[] {
  if (fromIndex === toIndex) return sections;
  if (fromIndex < 0 || toIndex < 0 || toIndex >= sections.length) {
    return sections;
  }
  const next = [...sections];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return sections;
  next.splice(toIndex, 0, moved);
  return next;
}

function reorderWithinSection(
  sections: MenuSection[],
  sectionTitle: string,
  fromIndex: number,
  toIndex: number
): MenuSection[] {
  if (fromIndex === toIndex) return sections;
  if (fromIndex < 0 || toIndex < 0) return sections;

  return sections.map((section) => {
    if (section.title !== sectionTitle) return section;
    if (toIndex >= section.items.length) return section;
    const items = [...section.items];
    const [moved] = items.splice(fromIndex, 1);
    if (!moved) return section;
    items.splice(toIndex, 0, moved);
    return { ...section, items };
  });
}

function reorderChildrenWithinModule(
  sections: MenuSection[],
  navKey: string,
  fromIndex: number,
  toIndex: number
): MenuSection[] {
  if (fromIndex === toIndex) return sections;
  if (fromIndex < 0 || toIndex < 0) return sections;

  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (getMenuItemNavKey(item) !== navKey || !item.children?.length) {
        return item;
      }
      if (toIndex >= item.children.length) return item;
      const children = [...item.children];
      const [moved] = children.splice(fromIndex, 1);
      if (!moved) return item;
      children.splice(toIndex, 0, moved);
      return { ...item, children };
    }),
  }));
}

type SectionDragPayload = {
  kind: "section";
  index: number;
};

type ModuleDragPayload = {
  kind: "module";
  sectionTitle: string;
  index: number;
};

type ChildDragPayload = {
  kind: "child";
  moduleKey: string;
  index: number;
};

type DragPayload = SectionDragPayload | ModuleDragPayload | ChildDragPayload;

function LockedRow({
  item,
  locale,
}: {
  item: MenuItem;
  locale: AppLocale;
}) {
  const Icon = item.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-inset/40 px-3 py-2.5 opacity-80">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-inset text-subtle">
        <Icon size={16} />
      </div>
      <span className="text-sm text-muted">
        {localizeNavLabel(item.label, locale)}
      </span>
    </div>
  );
}

function ChildSortableRow({
  child,
  index,
  total,
  moduleKey,
  locale,
  t,
  onReorder,
}: {
  child: MenuChildItem;
  index: number;
  total: number;
  moduleKey: string;
  locale: AppLocale;
  t: (key: string, params?: Record<string, string | number>) => string;
  onReorder: (moduleKey: string, from: number, to: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;
  const label = localizeNavLabel(child.label, locale);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const raw = event.dataTransfer.getData("text/plain");
        if (!raw) return;
        try {
          const payload = JSON.parse(raw) as DragPayload;
          if (payload.kind !== "child" || payload.moduleKey !== moduleKey) {
            return;
          }
          onReorder(moduleKey, payload.index, index);
        } catch {
          // ignore invalid drag payloads
        }
      }}
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
        dragging
          ? "border-accent-cyan/50 bg-card-tint-cyan opacity-80"
          : "border-border/70 bg-inset/50 hover:border-accent-cyan/25"
      }`}
    >
      <button
        type="button"
        draggable
        aria-label={t("nav.dragItem", { label })}
        title={t("nav.dragToReorder")}
        onDragStart={(event) => {
          event.stopPropagation();
          setDragging(true);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData(
            "text/plain",
            JSON.stringify({
              kind: "child",
              moduleKey,
              index,
            } satisfies ChildDragPayload)
          );
        }}
        onDragEnd={() => setDragging(false)}
        className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-subtle active:cursor-grabbing"
      >
        <GripVertical size={14} aria-hidden />
      </button>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-text">
        {label}
      </span>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          aria-label={t("nav.moveUp", { label })}
          disabled={!canMoveUp}
          onClick={() => onReorder(moduleKey, index, index - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-subtle transition hover:bg-elevated hover:text-accent-cyan disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          aria-label={t("nav.moveDown", { label })}
          disabled={!canMoveDown}
          onClick={() => onReorder(moduleKey, index, index + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-subtle transition hover:bg-elevated hover:text-accent-cyan disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
}

function SortableRow({
  item,
  index,
  total,
  sectionTitle,
  locale,
  t,
  onReorder,
  onReorderChildren,
}: {
  item: MenuItem;
  index: number;
  total: number;
  sectionTitle: string;
  locale: AppLocale;
  t: (key: string, params?: Record<string, string | number>) => string;
  onReorder: (sectionTitle: string, from: number, to: number) => void;
  onReorderChildren: (moduleKey: string, from: number, to: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const Icon = item.icon;
  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;
  const childCount = item.children?.length ?? 0;
  const hasChildren = childCount > 1;
  const label = localizeNavLabel(item.label, locale);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const raw = event.dataTransfer.getData("text/plain");
        if (!raw) return;
        try {
          const payload = JSON.parse(raw) as DragPayload;
          if (payload.kind !== "module") return;
          if (payload.sectionTitle !== sectionTitle) return;
          onReorder(sectionTitle, payload.index, index);
        } catch {
          // ignore invalid drag payloads
        }
      }}
      className={`rounded-xl border transition ${
        dragging
          ? "border-accent-cyan/50 bg-card-tint-cyan opacity-80"
          : "border-border bg-elevated hover:border-accent-cyan/30"
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          draggable
          aria-label={t("nav.dragItem", { label })}
          title={t("nav.dragToReorder")}
          onDragStart={(event) => {
            event.stopPropagation();
            setDragging(true);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData(
              "text/plain",
              JSON.stringify({
                kind: "module",
                sectionTitle,
                index,
              } satisfies ModuleDragPayload)
            );
          }}
          onDragEnd={() => setDragging(false)}
          className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-subtle active:cursor-grabbing"
        >
          <GripVertical size={16} aria-hidden />
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-inset text-muted">
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text">
            {label}
          </span>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-0.5 text-[11px] font-medium text-subtle transition hover:text-accent-cyan"
            >
              {expanded
                ? t("nav.hideSubItems", { count: childCount })
                : t("nav.showSubItems", { count: childCount })}
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={t("nav.moveUp", { label })}
            disabled={!canMoveUp}
            onClick={() => onReorder(sectionTitle, index, index - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition hover:bg-inset hover:text-accent-cyan disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            aria-label={t("nav.moveDown", { label })}
            disabled={!canMoveDown}
            onClick={() => onReorder(sectionTitle, index, index + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition hover:bg-inset hover:text-accent-cyan disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {hasChildren && expanded ? (
        <div className="space-y-1 border-t border-border/60 px-2.5 py-2 pl-10">
          <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">
            {t("nav.underItem", { label })}
          </p>
          {item.children!.map((child, childIndex) => (
            <ChildSortableRow
              key={child.href}
              child={child}
              index={childIndex}
              total={childCount}
              moduleKey={getMenuItemNavKey(item)}
              locale={locale}
              t={t}
              onReorder={onReorderChildren}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SortableSection({
  section,
  index,
  total,
  locale,
  t,
  canReorderSections,
  onReorderSection,
  onReorderItem,
  onReorderChildren,
}: {
  section: MenuSection;
  index: number;
  total: number;
  locale: AppLocale;
  t: (key: string, params?: Record<string, string | number>) => string;
  canReorderSections: boolean;
  onReorderSection: (from: number, to: number) => void;
  onReorderItem: (sectionTitle: string, from: number, to: number) => void;
  onReorderChildren: (moduleKey: string, from: number, to: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const canMoveUp = index > 0;
  const canMoveDown = index < total - 1;
  const label = localizeNavLabel(section.title, locale);
  const onlyLockedItem =
    section.items.length <= 1 &&
    !(
      section.items[0]?.children && section.items[0].children.length > 1
    );

  return (
    <div
      onDragOver={(event) => {
        if (!canReorderSections) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        if (!canReorderSections) return;
        event.preventDefault();
        const raw = event.dataTransfer.getData("text/plain");
        if (!raw) return;
        try {
          const payload = JSON.parse(raw) as DragPayload;
          if (payload.kind !== "section") return;
          onReorderSection(payload.index, index);
        } catch {
          // ignore invalid drag payloads
        }
      }}
      className={`rounded-2xl border p-3 transition ${
        dragging
          ? "border-accent-cyan/50 bg-card-tint-cyan/60 opacity-90"
          : "border-border/70 bg-inset/20"
      }`}
    >
      <div className="mb-2.5 flex items-center gap-1.5">
        {canReorderSections ? (
          <button
            type="button"
            draggable
            aria-label={t("nav.dragCategory", { label })}
            title={t("nav.dragToReorder")}
            onDragStart={(event) => {
              setDragging(true);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData(
                "text/plain",
                JSON.stringify({
                  kind: "section",
                  index,
                } satisfies SectionDragPayload)
              );
            }}
            onDragEnd={() => setDragging(false)}
            className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-subtle active:cursor-grabbing"
          >
            <GripVertical size={16} aria-hidden />
          </button>
        ) : null}
        <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-blue/70">
          {label}
        </p>
        {canReorderSections ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label={t("nav.moveUp", { label })}
              disabled={!canMoveUp}
              onClick={() => onReorderSection(index, index - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition hover:bg-elevated hover:text-accent-cyan disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronUp size={16} />
            </button>
            <button
              type="button"
              aria-label={t("nav.moveDown", { label })}
              disabled={!canMoveDown}
              onClick={() => onReorderSection(index, index + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition hover:bg-elevated hover:text-accent-cyan disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        ) : null}
      </div>

      {onlyLockedItem ? (
        section.items[0] ? (
          <LockedRow item={section.items[0]} locale={locale} />
        ) : null
      ) : (
        <div className="space-y-1.5">
          {section.items.map((item, itemIndex) => (
            <SortableRow
              key={getMenuItemNavKey(item)}
              item={item}
              index={itemIndex}
              total={section.items.length}
              sectionTitle={section.title}
              locale={locale}
              t={t}
              onReorder={onReorderItem}
              onReorderChildren={onReorderChildren}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type Props = {
  /** Optional custom trigger; defaults to gear icon button. */
  trigger?: ReactNode;
  /** Extra classes for the default icon trigger. */
  triggerClassName?: string;
  /** Show a short text label next to the gear (header / wider footers). */
  showLabel?: boolean;
};

export default function SidebarRearrangeDialog({
  trigger,
  triggerClassName,
  showLabel = false,
}: Props) {
  const { t, locale } = useT();
  const { data: session, update, status } = useSession();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MenuSection[]>([]);
  const [isPending, startTransition] = useTransition();

  const baseMenu = useMemo(() => {
    if (!session?.user) return [];
    return getMenuForUser({
      role: (session.user.role ?? "ADMIN") as UserRole,
      employeeType: (session.user.employeeType ?? null) as EmployeeType | null,
      moduleOverrides: session.user.moduleOverrides ?? null,
      clientId: session.user.clientId ?? null,
      vendorId: session.user.vendorId ?? null,
      username: session.user.username,
    });
  }, [session?.user]);

  // If the dialog opened while the session was still loading, fill draft once ready.
  useEffect(() => {
    if (!open || baseMenu.length === 0) return;
    setDraft((current) =>
      current.length > 0
        ? current
        : applySidebarOrder(baseMenu, session?.user?.sidebarOrder ?? null)
    );
  }, [open, baseMenu, session?.user?.sidebarOrder]);

  if (status === "unauthenticated") {
    return null;
  }

  function openDialog() {
    setDraft(
      applySidebarOrder(baseMenu, session?.user?.sidebarOrder ?? null)
    );
    setOpen(true);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(
        applySidebarOrder(baseMenu, session?.user?.sidebarOrder ?? null)
      );
    }
    setOpen(next);
  }

  function handleReorderSection(from: number, to: number) {
    setDraft((current) => reorderSections(current, from, to));
  }

  function handleReorder(sectionTitle: string, from: number, to: number) {
    setDraft((current) =>
      reorderWithinSection(current, sectionTitle, from, to)
    );
  }

  function handleReorderChildren(moduleKey: string, from: number, to: number) {
    setDraft((current) =>
      reorderChildrenWithinModule(current, moduleKey, from, to)
    );
  }

  function handleReset() {
    setDraft(baseMenu);
  }

  function handleSave() {
    const order = sectionsToOrder(draft);
    startTransition(async () => {
      try {
        const saved = await updateMySidebarOrder(order);
        await update({ sidebarOrder: saved });
        toast.success(t("nav.orderSaved"));
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("nav.orderSaveFailed")
        );
      }
    });
  }

  const canReorderSections = draft.length > 1;

  const defaultTrigger = (
    <button
      type="button"
      aria-label={t("nav.rearrange")}
      title={t("nav.rearrange")}
      onClick={openDialog}
      className={
        triggerClassName ??
        (showLabel
          ? "inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-elevated px-3 text-sm font-medium text-muted transition hover:border-accent-cyan/40 hover:text-accent-cyan"
          : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-subtle transition hover:border-accent-cyan/40 hover:text-accent-cyan")
      }
    >
      <Settings2 size={16} />
      {showLabel ? <span>{t("nav.rearrangeShort")}</span> : null}
    </button>
  );

  return (
    <>
      {trigger ? (
        <span
          role="button"
          tabIndex={0}
          onClick={openDialog}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openDialog();
            }
          }}
          className="inline-flex"
        >
          {trigger}
        </span>
      ) : (
        defaultTrigger
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <EmployeeDialogShell
          icon={PanelLeft}
          title={t("nav.rearrangeTitle")}
          description={t("nav.rearrangeDescription")}
          maxWidth="sm"
          footer={
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <EmployeeSecondaryButton
                disabled={isPending}
                onClick={handleReset}
              >
                <span className="inline-flex items-center gap-2">
                  <RotateCcw size={14} />
                  {t("nav.resetOrder")}
                </span>
              </EmployeeSecondaryButton>
              <EmployeePrimaryButton
                type="button"
                disabled={isPending}
                onClick={handleSave}
              >
                {isPending ? t("common.actions.saving") : t("nav.saveOrder")}
              </EmployeePrimaryButton>
            </div>
          }
        >
          <div className="space-y-4">
            {draft.length === 0 ? (
              <p className="text-sm text-subtle">
                {status === "loading"
                  ? t("nav.loadingMenu")
                  : t("nav.noModules")}
              </p>
            ) : (
              draft.map((section, index) => (
                <SortableSection
                  key={section.title}
                  section={section}
                  index={index}
                  total={draft.length}
                  locale={locale}
                  t={t}
                  canReorderSections={canReorderSections}
                  onReorderSection={handleReorderSection}
                  onReorderItem={handleReorder}
                  onReorderChildren={handleReorderChildren}
                />
              ))
            )}
          </div>
        </EmployeeDialogShell>
      </Dialog>
    </>
  );
}
