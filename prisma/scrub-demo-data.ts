/**
 * Hard-delete all operational demo / seed data for Relasi Global Solusi
 * (company id: rgs-company). Preserves the Company row, HO admin login
 * (username: vicko), linked Corporate employee (COR-001), and structural config
 * (categories, positions, department, website content).
 *
 * Usage: npx tsx prisma/scrub-demo-data.ts
 */
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";

const prisma = new PrismaClient();

const COMPANY_ID = "rgs-company";
const KEEP_USERNAME = "vicko";
const KEEP_EMPLOYEE_NO = "COR-001";

/** Upload subdirs that hold operational / demo files (safe to empty for scrub). */
const UPLOAD_SCRUB_DIRS = [
  "purchase-invoices",
  "payment-proofs",
  "tax-invoices",
  "invoices",
  "progress",
  "cico",
  "employees",
  "proofs",
] as const;

function log(msg: string) {
  console.log(msg);
}

async function collectUploadPaths(companyId: string): Promise<string[]> {
  const paths = new Set<string>();

  const purchases = await prisma.purchaseInvoice.findMany({
    where: { companyId },
    select: { filePath: true, taxInvoiceFilePath: true },
  });
  for (const row of purchases) {
    if (row.filePath) paths.add(row.filePath);
    if (row.taxInvoiceFilePath) paths.add(row.taxInvoiceFilePath);
  }

  const projects = await prisma.project.findMany({
    where: { companyId },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  if (projectIds.length > 0) {
    const periods = await prisma.projectInvoicePeriod.findMany({
      where: { projectId: { in: projectIds } },
      select: {
        invoicePdfPath: true,
        paymentProofPath: true,
        taxInvoiceDocumentPath: true,
      },
    });
    for (const row of periods) {
      if (row.invoicePdfPath) paths.add(row.invoicePdfPath);
      if (row.paymentProofPath) paths.add(row.paymentProofPath);
      if (row.taxInvoiceDocumentPath) paths.add(row.taxInvoiceDocumentPath);
    }

    const daily = await prisma.dailyProgress.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true, photos: { select: { url: true } } },
    });
    for (const row of daily) {
      for (const photo of row.photos) {
        if (photo.url) paths.add(photo.url);
      }
    }

    const reports = await prisma.progressReport.findMany({
      where: { projectId: { in: projectIds } },
      select: { photos: { select: { url: true } } },
    });
    for (const row of reports) {
      for (const photo of row.photos) {
        if (photo.url) paths.add(photo.url);
      }
    }
  }

  const employees = await prisma.employee.findMany({
    where: { companyId },
    select: {
      id: true,
      avatar: true,
      idDocumentUrl: true,
      employeeNo: true,
    },
  });
  const employeeIds = employees.map((e) => e.id);
  for (const emp of employees) {
    if (emp.employeeNo === KEEP_EMPLOYEE_NO) continue;
    if (emp.avatar) paths.add(emp.avatar);
    if (emp.idDocumentUrl) paths.add(emp.idDocumentUrl);
  }

  if (employeeIds.length > 0) {
    const attendances = await prisma.attendance.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { checkInPhotoUrl: true },
    });
    for (const row of attendances) {
      if (row.checkInPhotoUrl) paths.add(row.checkInPhotoUrl);
    }

    const leaves = await prisma.leaveRequest.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { proofUrl: true },
    });
    for (const row of leaves) {
      if (row.proofUrl) paths.add(row.proofUrl);
    }
  }

  return [...paths];
}

async function deleteLocalUpload(publicPath: string): Promise<boolean> {
  const cleaned = publicPath.split("?")[0].trim();
  if (!cleaned.startsWith("/uploads/") && !cleaned.startsWith("uploads/")) {
    return false;
  }

  const normalized = cleaned.startsWith("/") ? cleaned.slice(1) : cleaned;
  const publicRoot = path.resolve(process.cwd(), "public");
  const full = path.resolve(publicRoot, ...normalized.split("/"));

  if (!full.startsWith(publicRoot + path.sep) && full !== publicRoot) {
    return false;
  }

  try {
    await fs.unlink(full);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }
    log(`  ⚠ could not delete file: ${publicPath}`);
    return false;
  }
}

async function emptyUploadDir(subdir: string): Promise<number> {
  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  let removed = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        removed += await emptyUploadDir(path.join(subdir, entry.name));
        try {
          await fs.rmdir(full);
        } catch {
          /* non-empty or missing */
        }
      } else {
        try {
          await fs.unlink(full);
          removed += 1;
        } catch {
          /* ignore */
        }
      }
    }
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return 0;
    }
  }
  return removed;
}

async function countOperational(companyId: string) {
  const [
    clients,
    vendors,
    projects,
    purchaseInvoices,
    employees,
    users,
    leaveRequests,
    attendances,
    progressReports,
    invoicePeriods,
    invoiceCompilations,
    auditLogs,
  ] = await Promise.all([
    prisma.client.count({ where: { companyId } }),
    prisma.vendor.count({ where: { companyId } }),
    prisma.project.count({ where: { companyId } }),
    prisma.purchaseInvoice.count({ where: { companyId } }),
    prisma.employee.count({ where: { companyId } }),
    prisma.user.count({ where: { companyId } }),
    prisma.leaveRequest.count({
      where: { employee: { companyId } },
    }),
    prisma.attendance.count({
      where: { employee: { companyId } },
    }),
    prisma.progressReport.count({
      where: { project: { companyId } },
    }),
    prisma.projectInvoicePeriod.count({
      where: { project: { companyId } },
    }),
    prisma.invoiceCompilation.count({ where: { companyId } }),
    prisma.auditLog.count({ where: { companyId } }),
  ]);

  return {
    clients,
    vendors,
    projects,
    purchaseInvoices,
    employees,
    users,
    leaveRequests,
    attendances,
    progressReports,
    invoicePeriods,
    invoiceCompilations,
    auditLogs,
  };
}

async function main() {
  log("🧹 Scrubbing demo / seed operational data…");
  log(`   Company id: ${COMPANY_ID}`);
  log(`   Keep user: ${KEEP_USERNAME}`);
  log(`   Keep employee: ${KEEP_EMPLOYEE_NO}`);

  const company =
    (await prisma.company.findUnique({ where: { id: COMPANY_ID } })) ??
    (await prisma.company.findFirst({
      where: { name: "Relasi Global Solusi" },
    }));

  if (!company) {
    throw new Error(
      `Company ${COMPANY_ID} / Relasi Global Solusi not found. Nothing to scrub.`
    );
  }

  const companyId = company.id;
  log(`   Resolved company: ${company.name} (${companyId})`);

  const before = await countOperational(companyId);
  log("\n📊 Before:");
  for (const [k, v] of Object.entries(before)) {
    log(`   ${k}: ${v}`);
  }

  const keepUser = await prisma.user.findFirst({
    where: { companyId, username: KEEP_USERNAME },
  });
  if (!keepUser) {
    log(
      `\n⚠ Keep user "${KEEP_USERNAME}" not found — scrub will still wipe demo data.`
    );
  }

  const keepEmployee = await prisma.employee.findFirst({
    where: { companyId, employeeNo: KEEP_EMPLOYEE_NO },
  });

  const uploadPaths = await collectUploadPaths(companyId);
  log(`\n📎 Collected ${uploadPaths.length} upload path(s) from DB rows`);

  const projects = await prisma.project.findMany({
    where: { companyId },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  const employees = await prisma.employee.findMany({
    where: { companyId },
    select: { id: true, employeeNo: true, userId: true },
  });
  const employeeIds = employees.map((e) => e.id);
  const demoEmployeeIds = employees
    .filter((e) => e.employeeNo !== KEEP_EMPLOYEE_NO)
    .map((e) => e.id);

  const demoUsers = await prisma.user.findMany({
    where: {
      companyId,
      ...(keepUser ? { id: { not: keepUser.id } } : { username: { not: KEEP_USERNAME } }),
    },
    select: { id: true, username: true },
  });
  const demoUserIds = demoUsers.map((u) => u.id);

  log(`\n🗑 Deleting in FK-safe order…`);

  await prisma.$transaction(async (tx) => {
    // Leave approval acks (via leave → employee, or via demo users)
    if (employeeIds.length > 0) {
      const leaveIds = (
        await tx.leaveRequest.findMany({
          where: { employeeId: { in: employeeIds } },
          select: { id: true },
        })
      ).map((l) => l.id);
      if (leaveIds.length > 0) {
        const n = await tx.leaveApprovalAck.deleteMany({
          where: { leaveRequestId: { in: leaveIds } },
        });
        log(`   leaveApprovalAck: ${n.count}`);
      } else {
        log(`   leaveApprovalAck: 0`);
      }
    }

    if (projectIds.length > 0) {
      const nWarn = await tx.progressWarningAck.deleteMany({
        where: { projectId: { in: projectIds } },
      });
      log(`   progressWarningAck: ${nWarn.count}`);

      const reportIds = (
        await tx.progressReport.findMany({
          where: { projectId: { in: projectIds } },
          select: { id: true },
        })
      ).map((r) => r.id);

      if (reportIds.length > 0) {
        const nPhotos = await tx.progressReportPhoto.deleteMany({
          where: { progressReportId: { in: reportIds } },
        });
        log(`   progressReportPhoto: ${nPhotos.count}`);
      }

      // Detach reports from periods before deleting either
      await tx.progressReport.updateMany({
        where: { projectId: { in: projectIds } },
        data: { invoicePeriodId: null },
      });

      const nReports = await tx.progressReport.deleteMany({
        where: { projectId: { in: projectIds } },
      });
      log(`   progressReport: ${nReports.count}`);

      const dailyIds = (
        await tx.dailyProgress.findMany({
          where: { projectId: { in: projectIds } },
          select: { id: true },
        })
      ).map((d) => d.id);
      if (dailyIds.length > 0) {
        const nDailyPhotos = await tx.progressPhoto.deleteMany({
          where: { dailyProgressId: { in: dailyIds } },
        });
        log(`   progressPhoto: ${nDailyPhotos.count}`);
      }

      const nDaily = await tx.dailyProgress.deleteMany({
        where: { projectId: { in: projectIds } },
      });
      log(`   dailyProgress: ${nDaily.count}`);

      const nPeriods = await tx.projectInvoicePeriod.deleteMany({
        where: { projectId: { in: projectIds } },
      });
      log(`   projectInvoicePeriod: ${nPeriods.count}`);

      const nAssign = await tx.projectAssignment.deleteMany({
        where: { projectId: { in: projectIds } },
      });
      log(`   projectAssignment: ${nAssign.count}`);
    } else {
      log(`   (no projects — skipped project-scoped deletes)`);
    }

    if (employeeIds.length > 0) {
      const nAtt = await tx.attendance.deleteMany({
        where: { employeeId: { in: employeeIds } },
      });
      log(`   attendance: ${nAtt.count}`);

      const nLeave = await tx.leaveRequest.deleteMany({
        where: { employeeId: { in: employeeIds } },
      });
      log(`   leaveRequest: ${nLeave.count}`);
    }

    const nPurchases = await tx.purchaseInvoice.deleteMany({
      where: { companyId },
    });
    log(`   purchaseInvoice: ${nPurchases.count}`);

    const nComp = await tx.invoiceCompilation.deleteMany({
      where: { companyId },
    });
    log(`   invoiceCompilation: ${nComp.count}`);

    if (projectIds.length > 0) {
      const nProjects = await tx.project.deleteMany({
        where: { companyId },
      });
      log(`   project: ${nProjects.count}`);
    }

    const nVendors = await tx.vendor.deleteMany({ where: { companyId } });
    log(`   vendor: ${nVendors.count}`);

    // Unlink portal/client FKs before deleting clients
    await tx.user.updateMany({
      where: { companyId, clientId: { not: null } },
      data: { clientId: null },
    });

    const nClients = await tx.client.deleteMany({ where: { companyId } });
    log(`   client: ${nClients.count}`);

    // Unlink demo employees from users, then hard-delete demo employees
    if (demoEmployeeIds.length > 0) {
      await tx.employee.updateMany({
        where: { id: { in: demoEmployeeIds } },
        data: { userId: null },
      });
      const nEmp = await tx.employee.deleteMany({
        where: { id: { in: demoEmployeeIds } },
      });
      log(`   employee (demo): ${nEmp.count}`);
    } else {
      log(`   employee (demo): 0`);
    }

    // Ensure kept HO employee stays linked to keep user
    if (keepEmployee && keepUser) {
      await tx.employee.update({
        where: { id: keepEmployee.id },
        data: {
          userId: keepUser.id,
          archivedFromDirectory: false,
          status: "ACTIVE",
        },
      });
    }

    // Clear audit log user FKs for demo users, then delete demo users
    if (demoUserIds.length > 0) {
      await tx.auditLog.updateMany({
        where: { userId: { in: demoUserIds } },
        data: { userId: null },
      });

      // Progress/leave acks tied only to demo users (projects already gone)
      await tx.progressWarningAck.deleteMany({
        where: { userId: { in: demoUserIds } },
      });
      await tx.leaveApprovalAck.deleteMany({
        where: { userId: { in: demoUserIds } },
      });

      await tx.passwordResetToken.deleteMany({
        where: { userId: { in: demoUserIds } },
      });

      const nUsers = await tx.user.deleteMany({
        where: { id: { in: demoUserIds } },
      });
      log(
        `   user (demo): ${nUsers.count} [${demoUsers.map((u) => u.username).join(", ")}]`
      );
    } else {
      log(`   user (demo): 0`);
    }

    const nAudit = await tx.auditLog.deleteMany({ where: { companyId } });
    log(`   auditLog: ${nAudit.count}`);
  });

  // Disk: delete collected paths, then empty known demo upload dirs
  let filesDeleted = 0;
  for (const p of uploadPaths) {
    if (await deleteLocalUpload(p)) filesDeleted += 1;
  }
  log(`\n📁 Deleted ${filesDeleted} file(s) referenced by DB`);

  let dirScrubbed = 0;
  for (const sub of UPLOAD_SCRUB_DIRS) {
    const n = await emptyUploadDir(sub);
    if (n > 0) {
      log(`   emptied uploads/${sub}: ${n} file(s)`);
      dirScrubbed += n;
    }
  }
  log(`   upload dir scrub total: ${dirScrubbed} file(s)`);

  const after = await countOperational(companyId);
  const keptUsers = await prisma.user.findMany({
    where: { companyId },
    select: { username: true, email: true, role: true },
  });
  const keptEmployees = await prisma.employee.findMany({
    where: { companyId },
    select: { employeeNo: true, firstName: true, lastName: true },
  });

  log("\n📊 After:");
  for (const [k, v] of Object.entries(after)) {
    log(`   ${k}: ${v}`);
  }
  log("\n✅ Preserved:");
  log(`   company: ${company.name} (${companyId})`);
  log(
    `   users: ${keptUsers.map((u) => u.username).join(", ") || "(none)"}`
  );
  log(
    `   employees: ${
      keptEmployees
        .map((e) => `${e.employeeNo} ${e.firstName} ${e.lastName}`)
        .join(", ") || "(none)"
    }`
  );

  const operationalZero =
    after.clients === 0 &&
    after.vendors === 0 &&
    after.projects === 0 &&
    after.purchaseInvoices === 0 &&
    after.leaveRequests === 0 &&
    after.attendances === 0 &&
    after.progressReports === 0 &&
    after.invoicePeriods === 0 &&
    after.invoiceCompilations === 0 &&
    after.auditLogs === 0;

  if (!operationalZero) {
    log("\n⚠ Some operational counts are non-zero — review above.");
    process.exitCode = 1;
  } else {
    log("\n✅ Operational demo data scrubbed (clients/projects/vendors/purchases/leaves/attendance/etc. = 0).");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
