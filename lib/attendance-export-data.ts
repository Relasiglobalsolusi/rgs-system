import { prisma } from "@/lib/prisma";
import { formatTimeRange } from "@/lib/operating-hours";
import { parseDateInput } from "@/lib/invoice-period";
import { attendanceHours } from "@/lib/shift-pay";

export type AttendanceExportRow = {
  date: Date;
  employeeName: string;
  employeeNo: string;
  checkIn: Date | null;
  checkOut: Date | null;
  shiftLabel: string;
  workHours: number | null;
  earlyCheckOut: boolean;
};

export type AttendanceExportFeed = {
  projectName: string;
  clientName: string;
  rows: AttendanceExportRow[];
};

type AttendanceExportPeriod =
  | { mode: "day"; date: string }
  | { mode: "month"; year: number; month: number };

export async function loadAttendanceExportFeed(
  projectId: string,
  period: AttendanceExportPeriod
): Promise<AttendanceExportFeed | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      subCategory: true,
      client: { select: { name: true } },
    },
  });
  if (!project) return null;

  const dateFilter =
    period.mode === "day"
      ? { equals: parseDateInput(period.date) }
      : {
          gte: new Date(Date.UTC(period.year, period.month - 1, 1)),
          lt: new Date(Date.UTC(period.year, period.month, 1)),
        };

  const [records, assignments] = await Promise.all([
    prisma.attendance.findMany({
      where: { projectId, date: dateFilter },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNo: true },
        },
      },
      orderBy: [
        { date: "asc" },
        { checkIn: "asc" },
        { employee: { firstName: "asc" } },
      ],
    }),
    prisma.projectAssignment.findMany({
      where: { projectId },
      select: { employeeId: true, shiftStart: true, shiftEnd: true },
    }),
  ]);

  const shiftMap = new Map(assignments.map((row) => [row.employeeId, row]));
  const isInternal = project.subCategory === "INTERNAL";

  return {
    projectName: project.name,
    clientName: project.client?.name ?? (isInternal ? "Internal" : "—"),
    rows: records.map((record) => {
      const assignment = shiftMap.get(record.employeeId);
      return {
        date: record.date,
        employeeName:
          `${record.employee.firstName} ${record.employee.lastName}`.trim(),
        employeeNo: record.employee.employeeNo,
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        workHours: attendanceHours(record.checkIn, record.checkOut),
        shiftLabel: isInternal
          ? "09:00 – 17:00"
          : formatTimeRange(
              assignment?.shiftStart ?? null,
              assignment?.shiftEnd ?? null
            ),
        earlyCheckOut: record.earlyCheckOut === true,
      };
    }),
  };
}
