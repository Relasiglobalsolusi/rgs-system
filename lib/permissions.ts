import type { LucideIcon } from "lucide-react";

import {

  CheckSquare,

  ClipboardCheck,

  Clock,

  FileText,

  FolderKanban,

  LayoutDashboard,

  LogIn,

  Receipt,

  ShoppingBag,

  Package,

  Tags,

  Truck,

  UserCog,

  Users,

  UsersRound,

  Briefcase,

  Building2,

  Wallet,

  HandCoins,

  Banknote,

  PieChart,

  Coins,

  CircleDollarSign,

} from "lucide-react";

import type { EmployeeType, Placement, UserRole } from "@prisma/client";
import { isHeadOfficePlacement } from "@/lib/placement";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/locale";
import {
  isDirectorPosition,
  isInHouseCleaningStaffPosition,
  isAreaManagerPosition,
  isOperationsManagerPosition,
  isWarehouseStaffPosition,
  isWarehouseSupervisorPosition,
  isTechnicianPosition,
} from "@/lib/positions";



/**
 * Source of truth for Users → Permissions and sidebar access.
 * When you add a page people can turn on or off:
 * 1. Add the key here (it then appears in the permissions list)
 * 2. Add a sidebar item with `module` set to that key
 * 3. Add the path in `ROUTE_MODULE_MAP`
 * 4. Add `modules.<key>` in the EN and ID dictionaries
 * Presets below use `fillModuleFlags`, so a new key defaults to Off for
 * staff and portals and On for Admin. Set it to true in a preset if that
 * role should get it without a manual toggle.
 */
export const MODULES = [

  "dashboard",

  "projects",

  "teams",

  "progress",

  "cico",

  "pettyCash",

  "attendance",

  "shifts",

  "leaves",

  "approvals",

  "materialRequests",

  "transferOrders",

  "reports",

  "inventory",

  "itemCatalog",

  "invoicing",

  "reconciliation",

  "purchaseInvoices",

  "sales",

  "taxInvoices",

  "vendorPayments",

  "thr",

  "payroll",

  "financialReport",

  "clients",

  "vendors",

  "users",

  "employees",

  "departments",

  "settings",

  "website",

] as const;



export type ModuleKey = (typeof MODULES)[number];



/** Legacy modules removed from navigation; kept for existing permission overrides. */

export const HIDDEN_MODULES: ModuleKey[] = [
  "departments",
  "settings",
  "website",
  "attendance",
  "reports",
];



export function getVisibleModules(): ModuleKey[] {

  return MODULES.filter((module) => !HIDDEN_MODULES.includes(module));

}



export type PermissionUser = {

  role: UserRole;

  employeeType?: EmployeeType | null;

  moduleOverrides?: Record<string, boolean> | null;

};



export type MenuChildItem = {

  label: string;

  href: string;

  /** Primary child under a parent (e.g. All Projects, In Progress) */
  primary?: boolean;

};



export type MenuItem = {

  icon: LucideIcon;

  label: string;

  href: string;

  module: ModuleKey;

  /**
   * Stable identity for sidebar rearrange. Defaults to `module` when omitted.
   */
  navKey?: string;

  children?: MenuChildItem[];

};

/** Nav identity used for persisted sidebar order. */
export function getMenuItemNavKey(item: Pick<MenuItem, "module" | "navKey">) {
  return item.navKey ?? item.module;
}

/**
 * Extra rearrange keys that are not ModuleKey values.
 * Legacy flat Finance siblings may still appear in saved sidebarOrder JSON.
 */
export const EXTRA_MENU_NAV_KEYS = [
  "taxInvoices",
  "purchaseInvoices",
  "vendorPayments",
  "reconciliation",
  "financialReport",
  "payroll",
  "thr",
  "vat",
  "pettyCash",
] as const;

/** Each Finance page is its own module — no parent group toggle. */
export const FINANCE_MODULE_KEYS = [
  "invoicing",
  "reconciliation",
  "purchaseInvoices",
  "sales",
  "taxInvoices",
  "vendorPayments",
  "thr",
  "payroll",
  "financialReport",
] as const satisfies readonly ModuleKey[];

export type FinanceNavKey = (typeof FINANCE_MODULE_KEYS)[number];

export function isFinanceModuleKey(
  module: string
): module is FinanceNavKey {
  return (FINANCE_MODULE_KEYS as readonly string[]).includes(module);
}

export type MenuSection = {

  title: string;

  items: MenuItem[];

};



function fillModuleFlags(
  fill: boolean,
  patch: Partial<Record<ModuleKey, boolean>> = {}
): Record<ModuleKey, boolean> {
  return {
    ...(Object.fromEntries(MODULES.map((module) => [module, fill])) as Record<
      ModuleKey,
      boolean
    >),
    ...patch,
  };
}

const ALL_MODULES = fillModuleFlags(true);



/**
 * Module overrides applied when creating a client portal login.
 * ON: Dashboard, Projects, Progress Report, Invoice and Billing.
 * OFF: CICO (employees only) and all admin/directory modules.
 * Client Report and Attendance Report are merged into Progress Report.
 * Existing client users keep stored overrides until Permissions is re-saved / reset.
 */
export function getClientModuleOverrides(): Record<ModuleKey, boolean> {
  return fillModuleFlags(false, {
    dashboard: true,
    projects: true,
    progress: true,
    invoicing: true,
    reconciliation: true,
    vendorPayments: true,
  });
}

/**
 * Vendor portal logins are disabled product-wide (auth rejects vendorId users;
 * getAccessibleModules returns []). Kept for account-type baseline / legacy rows.
 */
export function getVendorModuleOverrides(): Record<ModuleKey, boolean> {
  return fillModuleFlags(false);
}

/**
 * Finance nav for client portal — flat under Finance / Keuangan (scoped AR).
 */
export const CLIENT_FINANCE_MENU_ITEMS: MenuItem[] = [
  {
    icon: FileText,
    label: "Invoice and Billing",
    href: "/billing",
    module: "invoicing",
    navKey: "invoicing",
  },
  {
    icon: ClipboardCheck,
    label: "Reconciliation",
    href: "/billing/reconciliation",
    module: "reconciliation",
    navKey: "reconciliation",
  },
  {
    icon: Wallet,
    label: "Payment & Settlement",
    href: "/billing/settlements",
    module: "vendorPayments",
    navKey: "vendorPayments",
  },
];

/** HO / admin Finance section — flat siblings under Finance / Keuangan. */
export const FINANCE_MENU_ITEMS: MenuItem[] = [
  {
    icon: FileText,
    label: "Invoice and Billing",
    href: "/billing",
    module: "invoicing",
    navKey: "invoicing",
  },
  {
    icon: ClipboardCheck,
    label: "Reconciliation",
    href: "/billing/reconciliation",
    module: "reconciliation",
    navKey: "reconciliation",
  },
  {
    icon: ShoppingBag,
    label: "Expenses",
    href: "/billing/purchase-invoices",
    module: "purchaseInvoices",
    navKey: "purchaseInvoices",
  },
  {
    icon: CircleDollarSign,
    label: "Sales",
    href: "/billing/sales",
    module: "sales",
    navKey: "sales",
  },
  {
    icon: Receipt,
    label: "Tax",
    href: "/billing/tax-invoices",
    module: "taxInvoices",
    navKey: "taxInvoices",
  },
  {
    icon: Wallet,
    label: "Payment & Settlement",
    href: "/billing/settlements",
    module: "vendorPayments",
    navKey: "vendorPayments",
  },
  {
    icon: HandCoins,
    label: "THR",
    href: "/billing/thr",
    module: "thr",
    navKey: "thr",
  },
  {
    icon: Banknote,
    label: "Internal Payroll",
    href: "/billing/payroll",
    module: "payroll",
    navKey: "payroll",
  },
  {
    icon: PieChart,
    label: "Financial Report",
    href: "/billing/financial-report",
    module: "financialReport",
    navKey: "financialReport",
  },
];

/**
 * Consistent override key scheme for gating an individual Finance sub-page
 * (by {@link MenuItem.navKey}) while the parent `invoicing` module stays
 * accessible. Stored in `moduleOverrides` as `"invoicing:<navKey>": false`.
 */
export function financeChildOverrideKey(navKey: string): string {
  return `invoicing:${navKey}`;
}

/**
 * True unless a Finance sub-page was explicitly denied via moduleOverrides.
 * Callers must also confirm the `invoicing` module itself is accessible —
 * this only gates which children are visible/reachable underneath it.
 */
export function isFinanceChildAccessible(
  overrides: Record<string, boolean> | null | undefined,
  navKey: string
): boolean {
  if (isFinanceModuleKey(navKey)) {
    const resolved = resolveModuleOverride(overrides, navKey);
    return resolved !== false;
  }
  if (!overrides) return true;
  return overrides[financeChildOverrideKey(navKey)] !== false;
}

/**
 * Direct module key wins. Older saves used a Finance group (`invoicing`) plus
 * `invoicing:<page>` denials — still honored until the user re-saves.
 */
export function resolveModuleOverride(
  overrides: Record<string, boolean> | null | undefined,
  module: ModuleKey
): boolean | null {
  if (!overrides) return null;
  // New Finance page: inherit Expenses until Sales is saved on the user.
  if (module === "sales" && !("sales" in overrides) && "purchaseInvoices" in overrides) {
    return overrides.purchaseInvoices!;
  }
  if (module in overrides) return overrides[module]!;
  if (module !== "invoicing" && isFinanceModuleKey(module)) {
    const legacyChild = overrides[financeChildOverrideKey(module)];
    if (typeof legacyChild === "boolean") return legacyChild;
    const hasPerPageFinanceKeys = FINANCE_MODULE_KEYS.some(
      (key) => key !== "invoicing" && key in overrides
    );
    if (hasPerPageFinanceKeys) return null;
    if (overrides.invoicing === false) return false;
    if (overrides.invoicing === true) return true;
  }
  return null;
}

/** Rewrite old Finance-group saves into one key per page. */
export function expandLegacyFinanceOverrides(
  overrides: Record<string, boolean> | null | undefined,
  baseline: Record<ModuleKey, boolean> = ALL_MODULES
): Record<string, boolean> {
  const source = overrides ?? {};
  const next: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith("invoicing:")) continue;
    next[key] = value;
  }
  const legacyGroup =
    Object.keys(source).some((key) => key.startsWith("invoicing:")) ||
    ("invoicing" in source &&
      !FINANCE_MODULE_KEYS.some((key) => key !== "invoicing" && key in source));
  if (legacyGroup) {
    for (const module of FINANCE_MODULE_KEYS) {
      const resolved = resolveModuleOverride(source, module);
      next[module] = resolved ?? baseline[module];
    }
  }
  return next;
}

/** Drops Finance sub-pages explicitly denied via `invoicing:<navKey>` overrides. */
function filterFinanceMenuItems(
  items: MenuItem[],
  overrides: Record<string, boolean> | null | undefined
): MenuItem[] {
  return items.filter((item) =>
    isFinanceChildAccessible(overrides, getMenuItemNavKey(item))
  );
}

type EmployeeModulePresetOptions = {
  placement?: Placement | null;
  employeeType?: EmployeeType | null;
  /** Optional position — when provided, OMs and Directors default to approvals: true. */
  jobPosition?: {
    slug?: string | null;
    name?: string | null;
    defaultModuleAccess?: unknown;
  } | null;
};

function normalizeModuleAccessMap(
  raw: unknown
): Record<ModuleKey, boolean> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const hasAny = MODULES.some((key) => typeof record[key] === "boolean");
  if (!hasAny) return null;
  return fillModuleFlags(
    false,
    Object.fromEntries(
      MODULES.map((key) => [key, record[key] === true])
    ) as Partial<Record<ModuleKey, boolean>>
  );
}

function isHeadOfficeEmployeePreset(options?: EmployeeModulePresetOptions) {
  return (
    isHeadOfficePlacement(options?.placement) ||
    options?.employeeType === "HEAD_OFFICE"
  );
}

function isApproverPosition(options?: EmployeeModulePresetOptions): boolean {
  if (!options?.jobPosition) return false;
  return (
    isOperationsManagerPosition(options.jobPosition) ||
    isAreaManagerPosition(options.jobPosition) ||
    isDirectorPosition(options.jobPosition)
  );
}

/**
 * Active field / project-site staff who use CICO.
 * Excludes head-office / corporate placement employees.
 * Mirrors {@link isHeadOfficeEmployeePreset} / employee module presets.
 */
export const activeFieldStaffWhere = {
  status: "ACTIVE" as const,
  NOT: {
    OR: [
      { employeeType: "HEAD_OFFICE" as const },
      { placement: "HEAD_OFFICE" as const },
    ],
  },
};

/**
 * Module overrides applied when creating an employee login.
 * Field / site staff: Dashboard, Progress, CICO, Leave & Sick only.
 * HO / corporate: Dashboard, Projects, Progress Report, Leave & Sick.
 * Warehouse Supervisor: Transfer Orders + Inventory + CICO.
 * In-House Cleaning Staff: Progress + CICO + Material Requests.
 * Technician: Dashboard, CICO, Leave & Sick only (no Progress Report).
 * Warehouse Staff: no portal by default; Head Office can generate a login in Users.
 * Operations Managers, Area Managers, and Directors also receive Approvals by default.
 * Existing users keep stored overrides until Permissions is re-saved.
 */
export function getEmployeeModuleOverrides(
  options?: EmployeeModulePresetOptions
): Record<ModuleKey, boolean> {
  const rawAccess = options?.jobPosition?.defaultModuleAccess;
  const stored = normalizeModuleAccessMap(rawAccess);
  if (stored) {
    if (
      rawAccess &&
      typeof rawAccess === "object" &&
      !Array.isArray(rawAccess) &&
      !("sales" in rawAccess)
    ) {
      stored.sales = stored.purchaseInvoices === true;
    }
    return stored;
  }

  const isHo = isHeadOfficeEmployeePreset(options);
  const isApprover = isApproverPosition(options);
  const job = options?.jobPosition ?? null;
  const inHouseCleaning = isInHouseCleaningStaffPosition(job ?? {});
  const warehouseSupervisor = isWarehouseSupervisorPosition(job ?? {});
  const warehouseStaff = isWarehouseStaffPosition(job ?? {});
  const technician = isTechnicianPosition(job ?? {});

  const denied = fillModuleFlags(false, {
    dashboard: true,
    leaves: true,
  });

  if (warehouseStaff) {
    return denied;
  }

  if (technician) {
    return {
      ...denied,
      cico: true,
    };
  }

  if (inHouseCleaning) {
    return {
      ...denied,
      progress: true,
      cico: true,
      materialRequests: true,
    };
  }

  if (warehouseSupervisor) {
    return {
      ...denied,
      projects: true,
      progress: true,
      cico: true,
      pettyCash: true,
      attendance: true,
      shifts: true,
      transferOrders: true,
      inventory: true,
      itemCatalog: true,
    };
  }

  return {
    ...denied,
    // Field staff do not get Projects; HO keeps project access.
    projects: isHo || isApprover,
    teams: isHo || isApprover,
    progress: true,
    cico: true,
    pettyCash: isHo,
    attendance: isHo,
    shifts: isHo || isApprover,
    leaves: true,
    approvals: isApprover,
    // Field staff request materials; Warehouse Supervisor fulfills Transfer Orders.
    materialRequests: !isHo,
    transferOrders: false,
    reports: false,
    // Inventory is HO operations (stock + project costing), not field portal.
    inventory: isHo,
    itemCatalog: isHo,
    invoicing: false,
  };
}



export type ModuleAccessState = {

  default: boolean;

  override: boolean | null;

  effective: boolean;

};



export function getModuleAccessState(
  user: PermissionUser,
  module: ModuleKey,
  baseline: Record<ModuleKey, boolean> = ALL_MODULES
): ModuleAccessState {
  const overrides = user.moduleOverrides ?? {};
  const override = resolveModuleOverride(overrides, module);

  return {
    default: baseline[module],
    override,
    effective: override !== null ? override : baseline[module],
  };
}

export function getAllModuleAccessStates(
  user: PermissionUser,
  baseline: Record<ModuleKey, boolean> = ALL_MODULES
): Record<ModuleKey, ModuleAccessState> {
  return Object.fromEntries(
    MODULES.map((module) => [module, getModuleAccessState(user, module, baseline)])
  ) as Record<ModuleKey, ModuleAccessState>;
}

export function buildOverridesFromToggle(
  _user: PermissionUser,
  module: ModuleKey,
  enabled: boolean,
  currentOverrides: Record<string, boolean>,
  baseline: Record<ModuleKey, boolean> = ALL_MODULES
): Record<string, boolean> {
  const next = { ...currentOverrides };

  if (enabled === baseline[module]) {
    delete next[module];
  } else {
    next[module] = enabled;
  }

  return next;
}

export function getAccessibleModules(
  user: PermissionUser & {
    username?: string;
    clientId?: string | null;
    client?: { id: string; name?: string } | null;
    vendorId?: string | null;
    vendor?: { id: string; name?: string } | null;
    employee?: {
      employeeNo: string;
      employeeType?: EmployeeType | null;
      jobPosition?: { slug?: string | null; name?: string | null } | null;
    } | null;
  }
): ModuleKey[] {
  // HO admin accounts always see the full ERP catalog; moduleOverrides are for staff only.
  if (isHoAdminAccount(user)) {
    return MODULES.filter((module) => module !== "website");
  }

  const overrides = user.moduleOverrides ?? {};
  const baseline = getAccountTypeBaselineModules(user);
  const isVendorPortal = Boolean(user.vendorId || user.vendor);
  const isClientPortal = Boolean(user.clientId || user.client);

  // Vendor portal access is disabled — block all modules for vendor-linked accounts.
  if (isVendorPortal) {
    return [];
  }

  const accountUser = user as AccountTypeUser;

  const accessible = MODULES.filter((module) => {
    // Website CMS retired from ERP — no account may access it, even via stored overrides.
    if (module === "website") {
      return false;
    }
    // Company Details is owner-only (username vicko). Overrides cannot grant it.
    if (module === "settings") {
      return false;
    }
    // Portal accounts never get HO directory / float modules, even via overrides.
    if (isClientPortal && PORTAL_BLOCKED_MODULES.includes(module)) {
      return false;
    }
    // OM / Director always get Approvals; stored false overrides must not block them.
    if (module === "approvals" && isApproverAccount(accountUser)) {
      return true;
    }
    if (module === "shifts" && isApproverAccount(accountUser)) {
      return true;
    }
    const override = resolveModuleOverride(overrides, module);
    if (override !== null) {
      return override;
    }
    return baseline[module];
  });

  if (
    !accessible.includes("progress") &&
    (accessible.includes("reports") || accessible.includes("attendance"))
  ) {
    accessible.push("progress");
  }

  return accessible;
}



export type AccountType = "Admin" | "Employee" | "Client" | "Vendor";



export type AccountTypeUser = PermissionUser & {

  username?: string;

  client?: { id: string; name?: string } | null;

  clientId?: string | null;

  vendor?: { id: string; name?: string } | null;

  vendorId?: string | null;

  placement?: Placement | null;

  employee?: {

    employeeNo: string;

    employeeType?: EmployeeType | null;

    placement?: Placement | null;

    /** Position slug/name — when present, OMs and Directors default to approvals. */
    jobPosition?: { slug?: string | null; name?: string | null } | null;

  } | null;

};

/** OM / Director — always entitled to Approvals at runtime (overrides cannot revoke). */
export function isApproverAccount(user: AccountTypeUser): boolean {
  return isApproverPosition({ jobPosition: user.employee?.jobPosition ?? null });
}

/** Modules restricted on employee/client portal presets. */

export const ADMIN_SCOPE_MODULES: ModuleKey[] = [

  "users",

  "clients",

  "vendors",

  "employees",

  "inventory",

  "itemCatalog",

  "settings",

];

/** Client / vendor portals cannot receive these, even via permission overrides. */
export const PORTAL_BLOCKED_MODULES: ModuleKey[] = [
  ...ADMIN_SCOPE_MODULES,
  "pettyCash",
  "purchaseInvoices",
  "sales",
  "taxInvoices",
  "thr",
  "payroll",
  "financialReport",
];



/**
 * Head-office company admin login — not client/vendor portal, not employee portal.
 * Primary owner login (`vicko`) stays admin even when linked to an HO employee record.
 */
export function isHoAdminAccount(user: AccountTypeUser): boolean {
  return isOwnerAccount(user);
}

/**
 * Primary owner login only. Wider Admin / Director / OM accounts must not inherit this.
 */
export function isOwnerAccount(user: { username?: string | null }): boolean {
  return user.username === "vicko";
}

export function getAccountType(user: AccountTypeUser): AccountType {
  // Vendor portal first — never label vendor-linked logins as Client.
  if (user.vendor ?? user.vendorId) {
    return "Vendor";
  }

  if (user.client ?? user.clientId) {
    return "Client";
  }

  if (user.username === "vicko") {
    return "Admin";
  }

  if (user.employee || user.employeeType) {
    return "Employee";
  }

  return "Employee";
}

/**
 * Directory type-chip colors (semantic, muted):
 * Client=amber (warning). Vendor=slate (inactive) so it is never mistaken for Client.
 * Admin + Employee share one cool cyan (info).
 * Status/actions stay separate: Active/Restore=emerald, Revoke=slate, Delete=red.
 */
export function getAccountTypeBadgeStatus(
  accountType: AccountType
): "info" | "warning" | "inactive" {
  if (accountType === "Client") return "warning";
  if (accountType === "Vendor") return "inactive";
  return "info"; // Admin + Employee — single cool accent
}

/**
 * Baseline module map for Permissions UI defaults / reset.
 * Admin: all on. Employee: field/HO preset. Client/Vendor: portal presets.
 * Existing users keep stored overrides until Permissions is re-saved.
 */
export function getAccountTypeBaselineModules(
  user: AccountTypeUser
): Record<ModuleKey, boolean> {
  const accountType = getAccountType(user);

  if (accountType === "Client") {
    return getClientModuleOverrides();
  }

  if (accountType === "Vendor") {
    return getVendorModuleOverrides();
  }

  if (accountType === "Employee") {
    return getEmployeeModuleOverrides({
      employeeType: user.employee?.employeeType ?? user.employeeType ?? null,
      placement: user.employee?.placement ?? user.placement ?? null,
      jobPosition: user.employee?.jobPosition ?? null,
    });
  }

  return { ...ALL_MODULES };
}

type SessionEmployeeCategory = {
  name: string;
  prefix: string;
  slug?: string | null;
};

type SessionAccountUser = {
  username?: string;
  role: string;
  clientId?: string | null;
  clientName?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  employee?: {
    employeeNo: string;
    employeeType?: EmployeeType | null;
    category?: SessionEmployeeCategory | null;
  } | null;
  employeeType?: EmployeeType | null;
  moduleOverrides?: Record<string, boolean> | null;
};

export function getSessionAccountType(user: SessionAccountUser): AccountType {
  return getAccountType({
    role: user.role as UserRole,
    username: user.username,
    clientId: user.clientId ?? null,
    vendorId: user.vendorId ?? null,
    employee:
      user.employee ??
      (user.employeeType ? { employeeNo: "", employeeType: user.employeeType } : null),
    employeeType: user.employeeType ?? null,
    moduleOverrides: user.moduleOverrides ?? null,
  });
}

function formatEmployeeCategoryLabel(
  category: SessionEmployeeCategory,
  locale?: AppLocale
): string {
  const name = localizeDepartmentLabel(
    category.slug,
    category.name,
    locale
  ).trim();
  const prefix = category.prefix.trim();

  if (name && prefix) {
    return `${name} (${prefix})`;
  }

  return name || prefix;
}

function employeeNumberPrefix(employeeNo: string): string | null {
  const prefix = employeeNo.split("-")[0]?.trim();
  return prefix || null;
}

export function getSessionProfileLabel(
  user: SessionAccountUser,
  locale?: AppLocale
): string {
  if (user.clientId) {
    return user.clientName?.trim() || "Client";
  }

  if (user.vendorId) {
    return user.vendorName?.trim() || "Vendor";
  }

  const category = user.employee?.category;
  if (category?.name || category?.prefix) {
    return formatEmployeeCategoryLabel(category, locale);
  }

  const employeeNo = user.employee?.employeeNo?.trim();
  if (employeeNo) {
    const prefix = employeeNumberPrefix(employeeNo);
    if (prefix) {
      return prefix;
    }
  }

  if (user.employee) {
    return "Employee";
  }

  return "Admin";
}



export function canAccess(user: PermissionUser, module: ModuleKey): boolean {

  return getAccessibleModules(user).includes(module);

}



export const ROUTE_MODULE_MAP: Record<string, ModuleKey> = {

  "/dashboard": "dashboard",

  "/projects": "projects",

  "/teams": "teams",

  "/progress": "progress",

  "/cico": "cico",

  "/attendance": "progress",

  "/shifts": "shifts",

  "/leaves": "leaves",

  "/approvals": "approvals",

  "/material-requests": "materialRequests",

  "/transfer-orders": "transferOrders",

  "/reports": "progress",

  "/inventory": "inventory",

  "/item-catalog": "itemCatalog",

  "/company-details": "settings",

  "/billing/petty-cash": "pettyCash",

  "/billing/reconciliation": "reconciliation",

  "/billing/purchase-invoices": "purchaseInvoices",

  "/billing/sales": "sales",

  "/billing/tax-invoices": "taxInvoices",

  "/billing/settlements": "vendorPayments",

  "/billing/thr": "thr",

  "/billing/payroll": "payroll",

  "/billing/financial-report": "financialReport",

  "/billing": "invoicing",

  "/invoicing": "invoicing",

  "/clients": "clients",

  "/vendors": "vendors",

  "/users": "users",

  "/employees": "employees",

  "/departments": "employees",

  "/multi-project-unlock": "projects",

};



export function getModuleForPath(pathname: string): ModuleKey | null {

  const sortedRoutes = Object.keys(ROUTE_MODULE_MAP).sort(

    (a, b) => b.length - a.length

  );



  for (const route of sortedRoutes) {

    if (pathname === route || pathname.startsWith(`${route}/`)) {

      return ROUTE_MODULE_MAP[route];

    }

  }



  return null;

}



export function canAccessRoute(

  user: PermissionUser,

  pathname: string

): boolean {

  const moduleKey = getModuleForPath(pathname);

  if (!moduleKey) return true;

  return canAccess(user, moduleKey);

}



export const menu: MenuSection[] = [

  {

    title: "Overview",

    items: [

      {

        icon: LayoutDashboard,

        label: "Dashboard",

        href: "/dashboard",

        module: "dashboard",

      },

    ],

  },

  {

    title: "Administration",

    items: [

      {

        icon: Building2,

        label: "Company Details",

        href: "/company-details",

        module: "settings",

      },

      {

        icon: Briefcase,

        label: "Clients",

        href: "/clients",

        module: "clients",

      },

      {

        icon: Truck,

        label: "Vendors",

        href: "/vendors",

        module: "vendors",

      },

      {

        icon: Users,

        label: "Employees",

        href: "/employees",

        module: "employees",

      },

      {

        icon: UserCog,

        label: "Users",

        href: "/users",

        module: "users",

      },

      {

        icon: Tags,

        label: "Goods Catalog",

        href: "/item-catalog",

        module: "itemCatalog",

      },

    ],

  },

  {

    title: "Operations",

    items: [

      {

        icon: FolderKanban,

        label: "Projects",

        href: "/projects",

        module: "projects",

        children: [

          {

            label: "All Projects",

            href: "/projects",

            primary: true,

          },

          {

            label: "Planning",

            href: "/projects?view=planning",

            primary: true,

          },

          {

            label: "In Progress",

            href: "/projects?view=in-progress",

            primary: true,

          },

          {

            label: "Pending Approval",

            href: "/projects?view=pending-approval",

            primary: true,

          },

          {

            label: "Payment Due",

            href: "/projects?view=payment-due",

            primary: true,

          },

          {

            label: "Completed Projects",

            href: "/projects?view=completed",

            primary: true,

          },

        ],

      },

      {

        icon: UsersRound,

        label: "Teams",

        href: "/teams",

        module: "teams",

        children: [

          {

            label: "Assignment",

            href: "/teams",

            primary: true,

          },

          {

            label: "Team Availability",

            href: "/teams/availability",

            primary: true,

          },

        ],

      },

      {

        icon: CheckSquare,

        label: "Progress Report",
        href: "/progress",

        module: "progress",

      },

      {

        icon: LogIn,

        label: "CICO",

        href: "/cico",

        module: "cico",

      },

      {

        icon: Coins,

        label: "Petty Cash",

        href: "/billing/petty-cash",

        module: "pettyCash",

        navKey: "pettyCash",

      },

      {

        icon: ClipboardCheck,

        label: "Approvals",

        href: "/approvals",

        module: "approvals",

      },

      {

        icon: ShoppingBag,

        label: "Material Requests",

        href: "/material-requests",

        module: "materialRequests",

      },

      {

        icon: Truck,

        label: "Transfer Orders",

        href: "/transfer-orders",

        module: "transferOrders",

      },

      {

        icon: Package,

        label: "Inventory",

        href: "/inventory",

        module: "inventory",

      },

    ],

  },

  {

    title: "Human Resources",

    items: [

      {

        icon: Clock,

        label: "Shifts",

        href: "/shifts",

        module: "shifts",

      },

      {

        icon: ClipboardCheck,

        label: "Leave & Sick",

        href: "/leaves",

        module: "leaves",

      },

    ],

  },

  {

    title: "Finance",

    items: FINANCE_MENU_ITEMS,

  },

];



/**
 * Sidebar catalog for the signed-in user.
 * - Admin / HO (no clientId/vendorId): full `menu` catalog — every category/page —
 *   so they can see the ERP and delegate module access per user.
 * - Client portal: flat Finance with Invoice and Billing only (scoped AR).
 * - Employee: filtered by module overrides + baselines as usual.
 */
export function getMenuForUser(
  user: Parameters<typeof getAccessibleModules>[0]
) {
  const accessible = new Set(getAccessibleModules(user));
  const isClientPortal = Boolean(user.clientId || user.client);
  const overrides = user.moduleOverrides ?? null;

  return menu
    .map((section) => {
      // Portal accounts get scoped Finance trees; HO/admin keeps full AR/AP.
      let sectionItems = section.items;
      if (section.title === "Finance") {
        sectionItems = isClientPortal
          ? CLIENT_FINANCE_MENU_ITEMS
          : FINANCE_MENU_ITEMS;
        sectionItems = filterFinanceMenuItems(sectionItems, overrides);
      }

      return {
        ...section,
        items: sectionItems
          .filter((item) => accessible.has(item.module))
          .map((item) =>
            item.children
              ? {
                  ...item,
                  // Flat children only — never nest subcategory links under Projects.
                  children: item.children.map(({ label, href, primary }) => ({
                    label,
                    href,
                    ...(primary ? { primary } : {}),
                  })),
                }
              : item
          ),
      };
    })
    .filter((section) => section.items.length > 0);
}


