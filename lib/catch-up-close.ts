import { intakeKindOf } from "@/lib/catch-up-intake";
import { jakartaTodayAsUtcDateOnly } from "@/lib/leave-employment-status";
import {
  isRecordedCatchUpPeriod,
  resolveCatchUpCompleteTarget,
} from "@/lib/project-catch-up-periods";

type CatchUpCloseProject = {
  catchUpKind?: string | null;
  catchUpIntake?: { kind: string } | null;
  status: string | null | undefined;
  isComplimentary?: boolean | null;
  isDemo?: boolean | null;
  subCategory: string | null | undefined;
  billingMode: string | null | undefined;
  startDate: Date | null | undefined;
  endDate: Date | null | undefined;
  billingPeriodBasis?: string | null;
  billingCycleStartDay?: number | null;
  billingCycleEndDay?: number | null;
  companyId: string;
  invoicePeriods: Array<{
    periodStart: Date | string;
    periodEnd: Date | string;
    isCatchUp?: boolean | null;
    invoicePdfPath?: string | null;
  }>;
};

/**
 * True while a historical catch-up period is still unrecorded. Asked from the
 * recorded periods, not from the intake row, so a project that already closed
 * intake — or was auto-completed by a payment — still cannot hide a gap.
 */
export async function catchUpHistoryMissing(
  project: CatchUpCloseProject
): Promise<boolean> {
  const intake = intakeKindOf(project);
  const recordedCatchUp = project.invoicePeriods.some(isRecordedCatchUpPeriod);
  // Only jobs typed in through catch-up carry a historical backlog.
  const kind = intake ?? (recordedCatchUp ? "ONGOING" : null);
  if (!kind) return false;

  const target = resolveCatchUpCompleteTarget({
    catchUpKind: kind,
    // The question is whether pages remain, not what the job's status is now.
    status: "IN_PROGRESS",
    isComplimentary: project.isComplimentary,
    isDemo: project.isDemo,
    subCategory: project.subCategory,
    billingMode: project.billingMode,
    startDate: project.startDate,
    endDate: project.endDate,
    basis: project.billingPeriodBasis as never,
    fromDay: project.billingCycleStartDay,
    toDay: project.billingCycleEndDay,
    asOf: jakartaTodayAsUtcDateOnly(),
    existingPeriods: project.invoicePeriods,
  });
  return Boolean(target);
}

/** Block End Contract / Finish while a historical catch-up period is still missing. */
export async function assertCatchUpHistoryRecorded(
  project: CatchUpCloseProject
) {
  if (await catchUpHistoryMissing(project)) {
    throw new Error("CATCH_UP_BEFORE_CLOSE");
  }
}
