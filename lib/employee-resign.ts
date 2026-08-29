import type { Prisma, PrismaClient } from "@prisma/client";

import { findOpenCicoAttendance } from "@/lib/cico-attendance";
import { releaseEmployeeFromProjects } from "@/lib/employee-projects";
import { jakartaTodayAsUtcDateOnly } from "@/lib/leave-employment-status";
import { softDeactivateEmployeeLogin } from "@/lib/linked-login-lifecycle";

type ResignDb = PrismaClient | Prisma.TransactionClient;

/**
 * Apply Resigned after last working day (Asia/Jakarta).
 * Scheduled resign keeps ACTIVE / On Leave until that day.
 */
export async function applyResignIfLastDayReached(
  db: ResignDb,
  employeeId: string,
  referenceDate: Date = new Date()
) {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      companyId: true,
      status: true,
      lastWorkingDay: true,
      resignAccordingToProcedure: true,
      resignedAt: true,
      userId: true,
    },
  });
  if (!employee) return;
  if (employee.status === "RESIGNED") return;
  if (employee.resignAccordingToProcedure == null || !employee.lastWorkingDay) {
    return;
  }

  const today = jakartaTodayAsUtcDateOnly(referenceDate);
  if (employee.lastWorkingDay.getTime() > today.getTime()) return;

  const open = await findOpenCicoAttendance(employeeId, referenceDate);
  if (open?.record?.checkIn && !open.record.checkOut) return;

  await db.employee.update({
    where: { id: employeeId },
    data: {
      status: "RESIGNED",
      resignedAt: employee.resignedAt ?? new Date(),
    },
  });

  const { returnOpenCardsForEmployee } = await import(
    "@/lib/prepaid-card-lifecycle"
  );
  await returnOpenCardsForEmployee(db, {
    companyId: employee.companyId,
    employeeId,
  });

  const { writeOffUnrecoveredEmployeeDebt } = await import(
    "@/lib/employee-unrecovered-debt"
  );
  await writeOffUnrecoveredEmployeeDebt(db, employeeId);

  await releaseEmployeeFromProjects(db, employeeId);

  if (employee.userId) {
    await softDeactivateEmployeeLogin(db, employee.userId);
  }
}

export async function applyResignIfLastDayReachedMany(
  db: ResignDb,
  employeeIds: string[],
  referenceDate: Date = new Date()
) {
  const unique = [...new Set(employeeIds.filter(Boolean))];
  for (const id of unique) {
    await applyResignIfLastDayReached(db, id, referenceDate);
  }
}
