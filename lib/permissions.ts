import type { LucideIcon } from "lucide-react";

import {

  CalendarDays,

  CheckSquare,

  ClipboardCheck,

  FileSpreadsheet,

  FileText,

  FolderKanban,

  Globe,

  History,

  LayoutDashboard,

  LogIn,

  Receipt,

  ShoppingBag,

  Truck,

  UserCog,

  Users,

  Briefcase,

  Wallet,

} from "lucide-react";

import type { EmployeeType, Placement, UserRole } from "@prisma/client";
import { isHeadOfficePlacement } from "@/lib/placement";
import { localizeDepartmentLabel } from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/locale";



export const MODULES = [

  "dashboard",

  "projects",

  "progress",

  "cico",

  "attendance",

  "leaves",

  "approvals",

  "reports",

  "invoicing",

  "clients",

  "vendors",

  "users",

  "employees",

  "departments",

  "settings",

  "website",

] as const;



export type ModuleKey = (typeof MODULES)[number];



/** Legacy module removed from navigation; kept for existing permission overrides. */

export const HIDDEN_MODULES: ModuleKey[] = ["departments", "settings"];



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
   * Stable identity for sidebar rearrange when multiple items share a module
   * (e.g. Invoice and Billing + Tax Invoice both use `invoicing`).
   * Defaults to `module` when omitted.
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
  "vendorUploadHistory",
  "vendorPayments",
  "reconciliation",
] as const;



export type MenuSection = {

  title: string;

  items: MenuItem[];

};



const ALL_MODULES = Object.fromEntries(

  MODULES.map((m) => [m, true])

) as Record<ModuleKey, boolean>;



export function getDefaultModules(): ModuleKey[] {

  return [...MODULES];

}



/**
 * Module overrides applied when creating a client portal login.
 * ON: Dashboard, Projects, Progress Reports, Attendance Report, Monthly Reports, Invoice and Billing.
 * OFF: CICO (employees only) and all admin/directory modules.
 * Existing client users keep stored overrides until Permissions is re-saved / reset.
 */
export function getClientModuleOverrides(): Record<ModuleKey, boolean> {
  return {
    dashboard: true,
    projects: true,
    progress: true,
    cico: false,
    attendance: true,
    leaves: false,
    approvals: false,
    reports: true,
    invoicing: true,
    clients: false,
    vendors: false,
    users: false,
    employees: false,
    departments: false,
    settings: false,
    website: false,
  };
}

/**
 * Module overrides applied when creating a vendor portal login.
 * ON: Dashboard (Overview) + Finance surfaces for this vendor only:
 *   Invoice/billing, Tax Invoice (PPN masukan upload), upload history/status,
 *   payment/settlement (read-only).
 * OFF: operations, HR, directory modules (including Vendors — HO edits only).
 * Existing vendor users keep stored overrides until Permissions is re-saved / reset.
 */
export function getVendorModuleOverrides(): Record<ModuleKey, boolean> {
  return {
    dashboard: true,
    projects: false,
    progress: false,
    cico: false,
    attendance: false,
    leaves: false,
    approvals: false,
    reports: false,
    invoicing: true,
    clients: false,
    vendors: false,
    users: false,
    employees: false,
    departments: false,
    settings: false,
    website: false,
  };
}

/**
 * Finance nav for vendor portal accounts — flat under Finance / Keuangan.
 * Scoped to this vendor’s AP surfaces only.
 */
export const VENDOR_FINANCE_MENU_ITEMS: MenuItem[] = [
  {
    icon: FileText,
    label: "Invoice and Billing",
    href: "/billing/purchase-invoices",
    module: "invoicing",
    navKey: "invoicing",
  },
  {
    icon: Receipt,
    label: "Tax Invoice",
    href: "/billing/purchase-invoices?view=tax",
    module: "invoicing",
    navKey: "taxInvoices",
  },
  {
    icon: History,
    label: "Upload History",
    href: "/billing/purchase-invoices?view=uploads",
    module: "invoicing",
    navKey: "vendorUploadHistory",
  },
  {
    icon: Wallet,
    label: "Payment & Settlement",
    href: "/billing/purchase-invoices?view=payments",
    module: "invoicing",
    navKey: "vendorPayments",
  },
];

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
    module: "invoicing",
    navKey: "reconciliation",
  },
  {
    icon: Wallet,
    label: "Payment & Settlement",
    href: "/billing/settlements",
    module: "invoicing",
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
    module: "invoicing",
    navKey: "reconciliation",
  },
  {
    icon: ShoppingBag,
    label: "Purchases",
    href: "/billing/purchase-invoices",
    module: "invoicing",
    navKey: "purchaseInvoices",
  },
  {
    icon: Receipt,
    label: "Tax Invoice",
    href: "/billing/tax-invoices",
    module: "invoicing",
    navKey: "taxInvoices",
  },
  {
    icon: History,
    label: "Upload History",
    href: "/billing/purchase-invoices?view=uploads",
    module: "invoicing",
    navKey: "vendorUploadHistory",
  },
  {
    icon: Wallet,
    label: "Payment & Settlement",
    href: "/billing/settlements",
    module: "invoicing",
    navKey: "vendorPayments",
  },
];

type EmployeeModulePresetOptions = {
  placement?: Placement | null;
  employeeType?: EmployeeType | null;
};

function isHeadOfficeEmployeePreset(options?: EmployeeModulePresetOptions) {
  return (
    isHeadOfficePlacement(options?.placement) ||
    options?.employeeType === "HEAD_OFFICE"
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
 * HO / corporate: Dashboard, Projects, Progress, Attendance Report, Leave & Sick.
 * Existing users keep stored overrides until Permissions is re-saved.
 */
export function getEmployeeModuleOverrides(
  options?: EmployeeModulePresetOptions
): Record<ModuleKey, boolean> {
  const isHo = isHeadOfficeEmployeePreset(options);
  return {
    dashboard: true,
    // Field staff do not get Projects; HO keeps project access.
    projects: isHo,
    progress: true,
    // Field staff use CICO; HO/desk staff use Attendance Report.
    cico: !isHo,
    attendance: isHo,
    leaves: true,
    approvals: false,
    reports: false,
    invoicing: false,
    clients: false,
    vendors: false,
    users: false,
    employees: false,
    departments: false,
    settings: false,
    website: false,
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
  const override = module in overrides ? overrides[module]! : null;

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
    } | null;
  }
): ModuleKey[] {
  const overrides = user.moduleOverrides ?? {};
  const baseline = getAccountTypeBaselineModules(user);
  const isVendorPortal = Boolean(user.vendorId || user.vendor);

  return MODULES.filter((module) => {
    // Vendor portal never gets the Vendors directory (HO-only edit surface).
    if (isVendorPortal && module === "vendors") {
      return false;
    }
    if (module in overrides) {
      return overrides[module];
    }
    return baseline[module];
  });
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

  } | null;

};



/** Modules restricted on employee/client portal presets. */

const ADMIN_SCOPE_MODULES: ModuleKey[] = [

  "users",

  "clients",

  "vendors",

  "employees",

  "website",

];



export function hasFullModuleAccess(user: PermissionUser): boolean {

  return ADMIN_SCOPE_MODULES.every((module) => canAccess(user, module));

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

  return "Admin";
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

  "/progress": "progress",

  "/cico": "cico",

  "/attendance": "attendance",

  "/leaves": "leaves",

  "/approvals": "approvals",

  "/reports": "reports",

  "/billing": "invoicing",

  "/invoicing": "invoicing",

  "/clients": "clients",

  "/vendors": "vendors",

  "/users": "users",

  "/employees": "employees",

  "/departments": "employees",

  "/website": "website",

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

        icon: Globe,

        label: "Website CMS",

        href: "/website",

        module: "website",

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

            label: "Completed Projects",

            href: "/projects?view=completed",

            primary: true,

          },

        ],

      },

      {

        icon: CheckSquare,

        label: "Progress Reports",
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

        icon: FileSpreadsheet,

        label: "Monthly Reports",

        href: "/reports",

        module: "reports",

      },

    ],

  },

  {

    title: "Human Resources",

    items: [

      {

        icon: CalendarDays,

        label: "Attendance Report",

        href: "/attendance",

        module: "attendance",

      },

      {

        icon: ClipboardCheck,

        label: "Leave & Sick",

        href: "/leaves",

        module: "leaves",

      },

      {

        icon: ClipboardCheck,

        label: "Approvals",

        href: "/approvals",

        module: "approvals",

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
 * - Vendor portal: Overview (Dashboard) + flat Finance vendor items
 *   (their invoices, PPN masukan, Upload History, Payment & Settlement).
 * - Client portal: flat Finance with Invoice and Billing only (scoped AR).
 * - Employee: filtered by module overrides + baselines as usual.
 */
export function getMenuForUser(
  user: Parameters<typeof getAccessibleModules>[0]
) {
  const accessible = new Set(getAccessibleModules(user));
  const isVendorPortal = Boolean(user.vendorId || user.vendor);
  const isClientPortal = Boolean(user.clientId || user.client);

  return menu
    .map((section) => {
      // Portal accounts get scoped Finance trees; HO/admin keeps full AR/AP.
      let sectionItems = section.items;
      if (section.title === "Finance") {
        if (isVendorPortal) sectionItems = VENDOR_FINANCE_MENU_ITEMS;
        else if (isClientPortal) sectionItems = CLIENT_FINANCE_MENU_ITEMS;
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



/** @deprecated Use getMenuForUser instead */

export function getMenuForRole(role: UserRole) {

  return getMenuForUser({ role, employeeType: null });

}



export const MODULE_LABELS: Record<ModuleKey, string> = {

  dashboard: "Dashboard",

  projects: "Projects",

  progress: "Progress Reports",

  cico: "CICO",

  attendance: "Attendance Report",

  leaves: "Leave & Sick",

  approvals: "Approvals",

  reports: "Monthly Reports",

  invoicing: "Invoice and Billing",

  clients: "Clients",

  vendors: "Vendors",

  users: "Users",

  employees: "Employees",

  departments: "Departments",

  settings: "Settings",

  website: "Website CMS",

};



export function formatEmployeeTypeLabel(type: EmployeeType | null | undefined) {

  switch (type) {

    case "HEAD_OFFICE":

      return "Head Office";

    case "PROJECT_SITE":

      return "Project Site";

    default:

      return "-";

  }

}



export function formatEmployeeStatusLabel(

  status: "ACTIVE" | "INACTIVE" | "TERMINATED" | "ON_LEAVE" | string

) {

  switch (status) {

    case "ACTIVE":

      return "Active";

    case "INACTIVE":

      return "Inactive";

    case "DELETED":

      return "Deleted";

    case "ON_LEAVE":

      return "On Leave";

    case "TERMINATED":

      return "Terminated";

    default:

      return status

        .replace(/_/g, " ")

        .toLowerCase()

        .replace(/\b\w/g, (char) => char.toUpperCase());

  }

}


