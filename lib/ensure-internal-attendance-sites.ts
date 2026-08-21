import { prisma } from "@/lib/prisma";
import {
  ATTENDANCE_HEAD_OFFICE_NAME,
  ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID,
  ATTENDANCE_WAREHOUSE_NAME,
  isAttendanceHeadOfficeName,
  isAttendanceWarehouseName,
} from "@/lib/attendance-internal-sites";

export type EnsuredInternalSiteRow = {
  clientId: typeof ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID;
  projectId: string;
  name: string;
  kind: "HEAD_OFFICE" | "WAREHOUSE";
};

type EnsuredSites = {
  internalClientId: string | null;
  sites: EnsuredInternalSiteRow[];
};

const ensuredInternalSites = new Map<string, EnsuredSites>();

/**
 * Ensure Head Office + Warehouse exist as INTERNAL projects (no billed client).
 * Migrates legacy GENERAL_CLEANING / RGS Internal client rows when found.
 */
export async function ensureInternalAttendanceSites(
  companyId: string
): Promise<EnsuredSites> {
  const cached = ensuredInternalSites.get(companyId);
  if (cached) return cached;

  const rows = await prisma.project.findMany({
    where: {
      companyId,
      OR: [
        { serviceArea: "HEAD_OFFICE" },
        { subCategory: "INTERNAL" },
        { name: { equals: ATTENDANCE_HEAD_OFFICE_NAME, mode: "insensitive" } },
        { name: { equals: ATTENDANCE_WAREHOUSE_NAME, mode: "insensitive" } },
        { name: { equals: "Kantor Pusat", mode: "insensitive" } },
        { name: { equals: "Gudang", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      clientId: true,
      subCategory: true,
      serviceArea: true,
      status: true,
    },
  });

  async function upsertInternalSite(opts: {
    name: string;
    location: string;
    sortOrder: number;
    matcher: (name: string) => boolean;
  }) {
    const existing = rows.find((row) => opts.matcher(row.name)) ?? null;
    if (existing) {
      if (
        existing.subCategory !== "INTERNAL" ||
        existing.clientId != null ||
        existing.serviceArea !== "HEAD_OFFICE" ||
        existing.status !== "IN_PROGRESS"
      ) {
        await prisma.project.update({
          where: { id: existing.id },
          data: {
            subCategory: "INTERNAL",
            clientId: null,
            serviceArea: "HEAD_OFFICE",
            status: "IN_PROGRESS",
          },
        });
      }
      return existing.id;
    }

    const created = await prisma.project.create({
      data: {
        companyId,
        clientId: null,
        name: opts.name,
        location: opts.location,
        serviceArea: "HEAD_OFFICE",
        status: "IN_PROGRESS",
        subCategory: "INTERNAL",
        sortOrder: opts.sortOrder,
      },
      select: { id: true },
    });
    return created.id;
  }

  const headOfficeId = await upsertInternalSite({
    name: ATTENDANCE_HEAD_OFFICE_NAME,
    location: "Head Office",
    sortOrder: 0,
    matcher: isAttendanceHeadOfficeName,
  });
  const warehouseId = await upsertInternalSite({
    name: ATTENDANCE_WAREHOUSE_NAME,
    location: "Warehouse",
    sortOrder: 1,
    matcher: isAttendanceWarehouseName,
  });

  const result: EnsuredSites = {
    internalClientId: null,
    sites: [
      {
        clientId: ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID,
        projectId: headOfficeId,
        name: ATTENDANCE_HEAD_OFFICE_NAME,
        kind: "HEAD_OFFICE",
      },
      {
        clientId: ATTENDANCE_INTERNAL_ROUTE_CLIENT_ID,
        projectId: warehouseId,
        name: ATTENDANCE_WAREHOUSE_NAME,
        kind: "WAREHOUSE",
      },
    ],
  };
  ensuredInternalSites.set(companyId, result);
  return result;
}
