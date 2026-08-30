import { formatEmployeeName } from "@/lib/employee-user-link";
import { computePrepaidLossTotals } from "@/lib/prepaid-card";
import { vehicleAssignmentLabel } from "@/lib/prepaid-card-lifecycle";
import { decimalToNumber } from "@/lib/project-billing";
import { prisma } from "@/lib/prisma";

export type PrepaidCardEntryView = {
  id: string;
  kind: string;
  spendKind: string | null;
  amount: number;
  previousBalance: number;
  resultingBalance: number;
  entryDate: string;
  description: string;
  proofPath: string | null;
  assignmentId: string | null;
};

export type PrepaidCardAssignmentView = {
  id: string;
  vehicleItemId: string | null;
  vehicleLabel: string | null;
  custodianEmployeeId: string | null;
  custodianName: string | null;
  startedAt: string;
  endedAt: string | null;
};

export type PrepaidLossInstallmentView = {
  id: string;
  year: number;
  month: number;
  amount: number;
  paid: boolean;
};

export type PrepaidCardLossView = {
  id: string;
  prepaidCardId: string;
  cardNumber: string;
  leftoverAmount: number;
  recoveryKind: string;
  employeeId: string | null;
  employeeName: string | null;
  writtenOffAt: string;
  amountRecovered: number;
  amountLeft: number;
  hoAbsorbed: number;
  employeeLeft: number;
  footedBy: "company" | "employee";
  method: string;
  installments: PrepaidLossInstallmentView[];
  payNow: {
    amount: number;
    recoveredAt: string;
    bankLabel: string | null;
  } | null;
};

export type PrepaidCardView = {
  id: string;
  cardNumber: string;
  kind: "VEHICLE" | "OPEN";
  status: string;
  currentBalance: number;
  vehicleItemId: string | null;
  vehicleName: string | null;
  vehicleSku: string | null;
  vehiclePlate: string | null;
  vehicleYear: number | null;
  custodianEmployeeId: string | null;
  custodianName: string | null;
  replacedByCardId: string | null;
  entries: PrepaidCardEntryView[];
  assignments: PrepaidCardAssignmentView[];
  losses: PrepaidCardLossView[];
};

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function loadPrepaidCardsForPanel(
  companyId: string
): Promise<{ cards: PrepaidCardView[]; losses: PrepaidCardLossView[] }> {
  const [cards, locks] = await Promise.all([
    prisma.prepaidCard.findMany({
      where: { companyId },
      include: {
        vehicleItem: {
          select: {
            name: true,
            sku: true,
            equipmentAssets: {
              select: { assetCode: true, vehicleYear: true },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            },
          },
        },
        custodianEmployee: { select: { firstName: true, lastName: true } },
        entries: {
          orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
        },
        assignments: {
          include: {
            vehicleItem: {
              select: {
                name: true,
                sku: true,
                equipmentAssets: {
                  select: { assetCode: true, vehicleYear: true },
                  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                },
              },
            },
            custodianEmployee: { select: { firstName: true, lastName: true } },
          },
          orderBy: { startedAt: "desc" },
        },
        losses: {
          include: {
            employee: { select: { firstName: true, lastName: true } },
            recoveries: {
              include: {
                bankAccount: {
                  select: { bankName: true, accountNumber: true, label: true },
                },
              },
              orderBy: { recoveredAt: "asc" },
            },
            payrollDeductions: {
              select: { id: true, year: true, month: true, amount: true },
              orderBy: [{ year: "asc" }, { month: "asc" }],
            },
          },
          orderBy: { writtenOffAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.internalPayrollLock.findMany({
      where: { companyId, locked: true },
      select: { year: true, month: true },
    }),
  ]);

  const locked = new Set(locks.map((row) => `${row.year}-${row.month}`));

  function toLossView(
    loss: (typeof cards)[number]["losses"][number],
    cardNumber: string,
    prepaidCardId: string
  ): PrepaidCardLossView {
    const leftover = decimalToNumber(loss.leftoverAmount) ?? 0;
    const payNowRecovered = loss.recoveries
      .filter((row) => row.source === "PAY_NOW")
      .reduce((sum, row) => sum + (decimalToNumber(row.amount) ?? 0), 0);
    const payrollRecovered = loss.payrollDeductions
      .filter((row) => locked.has(`${row.year}-${row.month}`))
      .reduce((sum, row) => sum + (decimalToNumber(row.amount) ?? 0), 0);
    const totals = computePrepaidLossTotals({
      leftoverAmount: leftover,
      recoveryKind: loss.recoveryKind,
      payNowRecovered,
      payrollRecovered,
    });
    const payNow = loss.recoveries.find((row) => row.source === "PAY_NOW");
    return {
      id: loss.id,
      prepaidCardId,
      cardNumber,
      leftoverAmount: leftover,
      recoveryKind: loss.recoveryKind,
      employeeId: loss.employeeId,
      employeeName: loss.employee ? formatEmployeeName(loss.employee) : null,
      writtenOffAt: dateKey(loss.writtenOffAt),
      amountRecovered: totals.amountRecovered,
      amountLeft: totals.amountLeft,
      hoAbsorbed: totals.hoAbsorbed,
      employeeLeft: totals.employeeLeft,
      footedBy: totals.footedBy,
      method: loss.recoveryKind,
      installments: loss.payrollDeductions.map((row) => ({
        id: row.id,
        year: row.year,
        month: row.month,
        amount: decimalToNumber(row.amount) ?? 0,
        paid: locked.has(`${row.year}-${row.month}`),
      })),
      payNow: payNow
        ? {
            amount: decimalToNumber(payNow.amount) ?? 0,
            recoveredAt: dateKey(payNow.recoveredAt),
            bankLabel: payNow.bankAccount
              ? payNow.bankAccount.label ||
                `${payNow.bankAccount.bankName} · ${payNow.bankAccount.accountNumber}`
              : null,
          }
        : null,
    };
  }

  const views = cards.map((card) => {
    const losses = card.losses.map((loss) =>
      toLossView(loss, card.cardNumber, card.id)
    );
    return {
      id: card.id,
      cardNumber: card.cardNumber,
      kind: card.kind,
      status: card.status,
      currentBalance: decimalToNumber(card.currentBalance) ?? 0,
      vehicleItemId: card.vehicleItemId,
      vehicleName: card.vehicleItem?.name ?? null,
      vehicleSku: card.vehicleItem?.sku ?? null,
      vehiclePlate: card.vehicleItem
        ? card.vehicleItem.equipmentAssets
            .map((asset) => asset.assetCode)
            .filter(Boolean)
            .join(" / ")
        : null,
      vehicleYear:
        card.vehicleItem?.equipmentAssets.find(
          (asset) => asset.vehicleYear != null
        )?.vehicleYear ?? null,
      custodianEmployeeId: card.custodianEmployeeId,
      custodianName: card.custodianEmployee
        ? formatEmployeeName(card.custodianEmployee)
        : null,
      replacedByCardId: card.replacedByCardId,
      entries: card.entries.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        spendKind: entry.spendKind,
        amount: decimalToNumber(entry.amount) ?? 0,
        previousBalance: decimalToNumber(entry.previousBalance) ?? 0,
        resultingBalance: decimalToNumber(entry.resultingBalance) ?? 0,
        entryDate: dateKey(entry.entryDate),
        description: entry.description,
        proofPath: entry.proofPath,
        assignmentId: entry.assignmentId,
      })),
      assignments: card.assignments.map((assignment) => ({
        id: assignment.id,
        vehicleItemId: assignment.vehicleItemId,
        vehicleLabel: assignment.vehicleItem
          ? vehicleAssignmentLabel(assignment.vehicleItem)
          : null,
        custodianEmployeeId: assignment.custodianEmployeeId,
        custodianName: assignment.custodianEmployee
          ? formatEmployeeName(assignment.custodianEmployee)
          : null,
        startedAt: dateKey(assignment.startedAt),
        endedAt: assignment.endedAt ? dateKey(assignment.endedAt) : null,
      })),
      losses,
    } satisfies PrepaidCardView;
  });

  return {
    cards: views,
    losses: views.flatMap((card) => card.losses),
  };
}

export type PrepaidEmployeeOption = {
  id: string;
  name: string;
  department: string | null;
};

export async function loadPrepaidCardFormOptions(companyId: string) {
  const [employees, bankAccounts] = await Promise.all([
    prisma.employee.findMany({
      where: {
        companyId,
        archivedFromDirectory: false,
        status: { in: ["ACTIVE", "ON_LEAVE"] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.companyBankAccount.findMany({
      where: { companyId },
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        accountHolder: true,
        label: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return {
    employees: employees.map(
      (employee): PrepaidEmployeeOption => ({
        id: employee.id,
        name: formatEmployeeName(employee),
        department: employee.department?.name ?? employee.category?.name ?? null,
      })
    ),
    bankAccounts: bankAccounts.map((account) => ({
      id: account.id,
      label:
        account.label || `${account.bankName} · ${account.accountNumber}`,
    })),
  };
}
