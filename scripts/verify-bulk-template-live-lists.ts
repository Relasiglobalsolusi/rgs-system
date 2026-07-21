/**
 * Proves Excel bulk templates rebuild Lists from the options passed in
 * (same path as API download) — deleted/inactive departments disappear.
 *
 * Run: npx tsx scripts/verify-bulk-template-live-lists.ts
 */
import ExcelJS from "exceljs";

import {
  buildEmployeeImportTemplate,
  departmentNamesFromCategories,
} from "../lib/bulk-import/employee-template";
import {
  buildProjectImportTemplate,
  formatStaffImportLabel,
} from "../lib/bulk-import/project-template";

type CaseResult = { id: string; name: string; ok: boolean; detail?: string };
const results: CaseResult[] = [];

function record(id: string, name: string, ok: boolean, detail?: string) {
  results.push({ id, name, ok, detail });
  if (ok) {
    console.log(`PASS  ${id}  ${name}`);
  } else {
    console.error(`FAIL  ${id}  ${name}`);
    if (detail) console.error(`      ${detail}`);
  }
}

async function readListsColumnValues(
  buffer: Uint8Array,
  columnIndex1Based: number
): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs typings expect classic `Buffer`; Node 20+ Buffer generics disagree.
  await workbook.xlsx.load(Uint8Array.from(buffer) as never);
  const lists = workbook.getWorksheet("Lists");
  if (!lists) {
    throw new Error("Lists sheet missing");
  }
  const values: string[] = [];
  lists.eachRow((row) => {
    const cell = row.getCell(columnIndex1Based).value;
    if (cell == null || cell === "") return;
    const text =
      typeof cell === "object" && cell !== null && "text" in cell
        ? String((cell as { text: string }).text)
        : String(cell);
    const trimmed = text.trim();
    if (trimmed) values.push(trimmed);
  });
  return values;
}

async function readAllListsValues(buffer: Uint8Array): Promise<string[]> {
  const values = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      readListsColumnValues(buffer, index + 1)
    )
  );
  return values.flat();
}

async function main() {
  const categoriesBefore = [
    { id: "ops", name: "Operations", prefix: "OPS", slug: "operations" },
    { id: "tmp", name: "Temp Dept", prefix: "TMP", slug: "temp-dept" },
    { id: "una", name: "Unassign", prefix: "UNA", slug: "unassign" },
  ];
  const categoriesAfter = categoriesBefore.filter(
    (category) => category.prefix !== "TMP"
  );

  const namesBefore = departmentNamesFromCategories(categoriesBefore);
  const namesAfter = departmentNamesFromCategories(categoriesAfter);

  record(
    "dept-filter-before",
    "departmentNames includes Temp Dept before delete",
    namesBefore.includes("Temp Dept"),
    `got: ${namesBefore.join(" | ")}`
  );
  record(
    "dept-filter-after",
    "departmentNames excludes Temp Dept after delete",
    !namesAfter.includes("Temp Dept") && namesAfter.includes("Operations"),
    `got: ${namesAfter.join(" | ")}`
  );

  const bufferBefore = await buildEmployeeImportTemplate({
    categories: categoriesBefore.filter((category) => category.prefix !== "UNA"),
    positions: [
      { name: "Cleaning staff", categoryId: "ops" },
      { name: "Temporary role", categoryId: "tmp" },
    ],
    projectNames: ["Site Alpha", "Site Gone"],
    locale: "en",
  });

  const bufferAfter = await buildEmployeeImportTemplate({
    categories: categoriesAfter.filter((category) => category.prefix !== "UNA"),
    positions: [{ name: "Cleaning staff", categoryId: "ops" }],
    projectNames: ["Site Alpha"],
    locale: "en",
  });

  // Per-department Position lists change the Lists column index dynamically.
  const listsBefore = await readListsColumnValues(bufferBefore, 1);
  const listsAfter = await readListsColumnValues(bufferAfter, 1);
  const projectsBefore = await readAllListsValues(bufferBefore);
  const projectsAfter = await readAllListsValues(bufferAfter);

  record(
    "xlsx-dept-before",
    "Lists sheet has Temp Dept before delete",
    listsBefore.includes("Temp Dept"),
    `Lists col1: ${listsBefore.join(" | ")}`
  );
  record(
    "xlsx-dept-after",
    "Lists sheet drops Temp Dept after delete",
    !listsAfter.includes("Temp Dept") && listsAfter.includes("Operations"),
    `Lists col1: ${listsAfter.join(" | ")}`
  );
  record(
    "xlsx-project-before",
    "Lists has Site Gone before remove",
    projectsBefore.includes("Site Gone") && projectsBefore.includes("Site Alpha"),
    `Lists col6: ${projectsBefore.join(" | ")}`
  );
  record(
    "xlsx-project-after",
    "Lists drops Site Gone on next download",
    !projectsAfter.includes("Site Gone") && projectsAfter.includes("Site Alpha"),
    `Lists col6: ${projectsAfter.join(" | ")}`
  );

  const clientsBefore = [
    { name: "Acme Corp", npwp: "123" },
    { name: "Deleted Client Co", npwp: null },
  ];
  const clientsAfter = clientsBefore.filter(
    (client) => client.name !== "Deleted Client Co"
  );
  const employees = [
    {
      employeeNo: "OPS-001",
      firstName: "Andi",
      lastName: "Prasetyo",
      categoryName: "Operations",
    },
  ];

  const projectBefore = await buildProjectImportTemplate({
    clients: clientsBefore,
    categories: categoriesBefore,
    employees,
    locale: "en",
  });
  const projectAfter = await buildProjectImportTemplate({
    clients: clientsAfter,
    categories: categoriesAfter,
    employees,
    locale: "en",
  });

  // Client is first dropdownValues column on project template → Lists col 1.
  const projectClientsBefore = await readListsColumnValues(projectBefore, 1);
  const projectClientsAfter = await readListsColumnValues(projectAfter, 1);

  record(
    "xlsx-client-before",
    "project Lists has Deleted Client Co before remove",
    projectClientsBefore.includes("Deleted Client Co"),
    `got: ${projectClientsBefore.join(" | ")}`
  );
  record(
    "xlsx-client-after",
    "project Lists drops deleted client on next download",
    !projectClientsAfter.includes("Deleted Client Co") &&
      projectClientsAfter.includes("Acme Corp"),
    `got: ${projectClientsAfter.join(" | ")}`
  );

  const staffLabel = formatStaffImportLabel(employees[0]!);
  record(
    "staff-label",
    "staff label format is Full Name - Employee No",
    staffLabel === "Andi Prasetyo - OPS-001",
    staffLabel
  );

  const failed = results.filter((result) => !result.ok);
  console.log("");
  console.log(
    failed.length === 0
      ? `All ${results.length} checks passed.`
      : `${failed.length}/${results.length} checks failed.`
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
