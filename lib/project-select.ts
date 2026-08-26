import { isAttendanceHeadOfficeName } from "@/lib/attendance-internal-sites";
import { HEAD_OFFICE_PAYROLL_PROJECT } from "@/lib/payroll-deductions";

export type ProjectSelectOption = {
  id: string;
  name: string;
  clientName?: string | null;
  subCategory?: string | null;
};

export function isHeadOfficeProjectOption(
  project: Pick<ProjectSelectOption, "id" | "name">
): boolean {
  return (
    project.id === HEAD_OFFICE_PAYROLL_PROJECT ||
    isAttendanceHeadOfficeName(project.name)
  );
}

export function projectSelectLabel(project: ProjectSelectOption): string {
  return project.clientName
    ? `${project.name} · ${project.clientName}`
    : project.name;
}

export function isInternalProjectOption(
  project: Pick<ProjectSelectOption, "id" | "name" | "subCategory">
): boolean {
  return project.subCategory === "INTERNAL" || isHeadOfficeProjectOption(project);
}

export function compareProjectSelectOptions(
  a: ProjectSelectOption,
  b: ProjectSelectOption
): number {
  const aInternal = isInternalProjectOption(a);
  const bInternal = isInternalProjectOption(b);
  if (aInternal !== bInternal) return aInternal ? -1 : 1;
  const aHeadOffice = isHeadOfficeProjectOption(a);
  const bHeadOffice = isHeadOfficeProjectOption(b);
  if (aHeadOffice !== bHeadOffice) return aHeadOffice ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function sortProjectSelectOptions<T extends ProjectSelectOption>(
  projects: readonly T[]
): T[] {
  return [...projects].sort(compareProjectSelectOptions);
}
