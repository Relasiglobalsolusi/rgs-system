import type { PayrollDayRow } from "@/lib/internal-payroll-days";

export type PayrollManagementReviewEmployee = {
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  daysWorked: number;
  dailyRate: number;
  wage: number;
  days: PayrollDayRow[];
};
