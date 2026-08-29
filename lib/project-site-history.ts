import { prisma } from "@/lib/prisma";
import { isReturnableEquipmentItemType } from "@/lib/inventory-project-release";
import { formatProjectShiftLabel } from "@/lib/project-shifts";

export type ProjectStaffHistoryRow = {
  employeeId: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
  shiftLabel: string | null;
};

export type ProjectEquipmentHistoryRow = {
  id: string;
  assetCode: string | null;
  itemName: string;
  sku: string;
  assignedOn: Date;
  returned: boolean;
};

function staffKey(row: Pick<ProjectStaffHistoryRow, "employeeId">): string {
  return row.employeeId;
}

function mergeStaff(
  into: Map<string, ProjectStaffHistoryRow>,
  row: ProjectStaffHistoryRow
) {
  const existing = into.get(staffKey(row));
  if (!existing) {
    into.set(staffKey(row), row);
    return;
  }
  if (!existing.shiftLabel && row.shiftLabel) {
    into.set(staffKey(row), { ...existing, shiftLabel: row.shiftLabel });
  }
}

/**
 * People who were on this site: leftover assignment rows, CICO, progress
 * reports, and double-shift cover. Used after the job is closed and crew
 * has been released from live assignment.
 */
export async function listProjectStaffHistory(
  projectId: string
): Promise<ProjectStaffHistoryRow[]> {
  const byId = new Map<string, ProjectStaffHistoryRow>();

  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId },
    select: {
      employeeId: true,
      shiftStart: true,
      shiftEnd: true,
      shift: {
        select: { number: true, startTime: true, endTime: true },
      },
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNo: true,
        },
      },
    },
    orderBy: [
      { employee: { firstName: "asc" } },
      { employee: { lastName: "asc" } },
    ],
  });

  for (const row of assignments) {
    mergeStaff(byId, {
      employeeId: row.employee.id,
      firstName: row.employee.firstName,
      lastName: row.employee.lastName,
      employeeNo: row.employee.employeeNo,
      shiftLabel: row.shift
        ? formatProjectShiftLabel(row.shift)
        : row.shiftStart && row.shiftEnd
          ? `${row.shiftStart} – ${row.shiftEnd}`
          : null,
    });
  }

  const [attendance, reports, doubleShifts] = await Promise.all([
    prisma.attendance.findMany({
      where: { projectId },
      select: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNo: true,
          },
        },
      },
      distinct: ["employeeId"],
    }),
    prisma.progressReport.findMany({
      where: { projectId },
      select: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNo: true,
          },
        },
      },
      distinct: ["employeeId"],
    }),
    prisma.doubleShiftAssignment.findMany({
      where: { projectId },
      select: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNo: true,
          },
        },
      },
      distinct: ["employeeId"],
    }),
  ]);

  for (const row of [...attendance, ...reports, ...doubleShifts]) {
    if (!row.employee) continue;
    mergeStaff(byId, {
      employeeId: row.employee.id,
      firstName: row.employee.firstName,
      lastName: row.employee.lastName,
      employeeNo: row.employee.employeeNo,
      shiftLabel: null,
    });
  }

  return [...byId.values()].sort((left, right) =>
    `${left.firstName} ${left.lastName}`.localeCompare(
      `${right.firstName} ${right.lastName}`
    )
  );
}

/**
 * Equipment that was issued to this job, including units already returned
 * when the crew was released.
 */
export async function listProjectEquipmentHistory(
  projectId: string,
  options?: { companyId?: string }
): Promise<ProjectEquipmentHistoryRow[]> {
  const rows = await prisma.inventoryMovement.findMany({
    where: {
      projectId,
      type: "ISSUE_TO_PROJECT",
      ...(options?.companyId ? { companyId: options.companyId } : {}),
    },
    select: {
      id: true,
      movedAt: true,
      voidedAt: true,
      item: { select: { sku: true, name: true, itemType: true } },
      equipmentAsset: { select: { assetCode: true } },
      equipmentAssetsFromBulkIssue: { select: { assetCode: true } },
    },
    orderBy: { movedAt: "desc" },
  });

  return rows
    .filter((row) => isReturnableEquipmentItemType(row.item.itemType))
    .map((row) => {
      const codes = [
        row.equipmentAsset?.assetCode,
        ...row.equipmentAssetsFromBulkIssue.map((asset) => asset.assetCode),
      ].filter((code): code is string => Boolean(code?.trim()));
      return {
        id: row.id,
        assetCode: codes[0] ?? null,
        itemName: row.item.name,
        sku: row.item.sku,
        assignedOn: row.movedAt,
        returned: row.voidedAt != null,
      };
    });
}
