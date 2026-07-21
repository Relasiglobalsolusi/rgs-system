import { prisma } from "@/lib/prisma";
import { canAccess } from "@/lib/permissions";
import {
  canManageClients,
  canManageEmployees,
} from "@/lib/project-access";
import { requireModule, toPermissionUser } from "@/lib/session";

import AppShell from "@/components/layout/AppShell";
import PageIntro from "@/components/i18n/PageIntro";
import T from "@/components/i18n/T";
import UserDirectory from "@/components/users/UserDirectory";

type Props = {
  searchParams: Promise<{ clientId?: string }>;
};

export default async function UsersPage({ searchParams }: Props) {
  const session = await requireModule("users");
  const permissionUser = toPermissionUser(session);
  const canManage = canAccess(permissionUser, "users");
  const canViewPassword = canManage;
  const manageClients = canManageClients(permissionUser);
  const manageEmployees = canManageEmployees(permissionUser);
  const { clientId: filterClientId } = await searchParams;

  const company = await prisma.company.findFirst({ select: { id: true } });

  if (!company) {
    return (
      <AppShell
        titleKey="pages.users.title"
        descriptionKey="pages.users.description"
      >
        <p className="rounded-3xl border border-border bg-elevated p-8 text-text">
          <T k="pages.users.companyNotFound" />
        </p>
      </AppShell>
    );
  }

  const [users, filterClient, clientsWithoutPortalLogin, employeesWithoutPortalLogin] =
    await Promise.all([
      prisma.user.findMany({
        where: {
          companyId: company.id,
          ...(filterClientId ? { clientId: filterClientId } : {}),
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          active: true,
          moduleOverrides: true,
          ...(canViewPassword ? { passwordDisplay: true } : {}),
          employee: {
            select: {
              id: true,
              employeeNo: true,
              employeeType: true,
              employmentType: true,
              placement: true,
              firstName: true,
              lastName: true,
              status: true,
              archivedFromDirectory: true,
              jobPosition: {
                select: { id: true, name: true },
              },
              category: {
                select: { name: true, prefix: true },
              },
            },
          },
          client: {
            select: { id: true, name: true, active: true },
          },
          vendor: {
            select: { id: true, name: true, active: true },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      }),
      filterClientId
        ? prisma.client.findFirst({
            where: { id: filterClientId, companyId: company.id },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
      // No Portal Login: no linked User row (never had login, or hard-deleted).
      // Includes soft-deleted parents with no User until permanently deleted.
      prisma.client.findMany({
        where: {
          companyId: company.id,
          users: { none: {} },
          ...(filterClientId ? { id: filterClientId } : {}),
        },
        select: {
          id: true,
          name: true,
          shortCode: true,
          email: true,
          phone: true,
          address: true,
          npwp: true,
          contactPersonFirstName: true,
          contactPersonLastName: true,
          contactPersonPosition: true,
          contactPersonEmail: true,
          contactPersonPhone: true,
          clientSince: true,
          active: true,
          _count: { select: { projects: true, users: true } },
          users: {
            select: { id: true, username: true, active: true },
            orderBy: { username: "asc" },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.employee.findMany({
        where: {
          companyId: company.id,
          userId: null,
          archivedFromDirectory: false,
        },
        select: {
          id: true,
          employeeNo: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          employeeType: true,
          employmentType: true,
          placement: true,
          jobPosition: { select: { id: true, name: true } },
          status: true,
          category: { select: { name: true } },
          user: { select: { username: true, active: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { employeeNo: "asc" }],
      }),
    ]);

  return (
    <AppShell
      titleKey="pages.users.title"
      descriptionKey="pages.users.description"
    >
      <PageIntro
        titleKey="pages.users.directoryTitle"
        descriptionKey="pages.users.directoryDesc"
      />
      {filterClient ? (
        <p className="mb-4 text-sm text-cyan-300">
          <T
            k="pages.users.showingForClient"
            params={{ name: filterClient.name }}
          />
        </p>
      ) : null}

      <UserDirectory
        users={users.map((user) => ({
          ...user,
          moduleOverrides:
            user.moduleOverrides &&
            typeof user.moduleOverrides === "object" &&
            !Array.isArray(user.moduleOverrides)
              ? (user.moduleOverrides as Record<string, boolean>)
              : null,
        }))}
        clientsWithoutPortalLogin={clientsWithoutPortalLogin}
        employeesWithoutPortalLogin={employeesWithoutPortalLogin}
        canEditPermissions={canManage}
        canViewPassword={canViewPassword}
        canManageClients={manageClients}
        canManageEmployees={manageEmployees}
        currentUserId={session.user.id}
      />
    </AppShell>
  );
}
