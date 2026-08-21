import AppShell from "@/components/layout/AppShell";
import CompanyDetailsForm from "@/components/company-details/CompanyDetailsForm";
import PageIntro from "@/components/i18n/PageIntro";
import T from "@/components/i18n/T";
import { listCompanyBankAccountOptions } from "@/lib/company-bank-accounts";
import { COMPANY_IDENTITY_SELECT } from "@/lib/company-for-pdf";
import { isOwnerAccount } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireModule, toPermissionUser } from "@/lib/session";

export default async function CompanyDetailsPage() {
  const session = await requireModule("settings");
  if (!isOwnerAccount(toPermissionUser(session))) {
    return (
      <AppShell
        titleKey="pages.companyDetails.title"
        descriptionKey="pages.companyDetails.description"
      >
        <p className="rounded-3xl border border-border bg-elevated p-8 text-text">
          <T k="pages.companyDetails.permissionDenied" />
        </p>
      </AppShell>
    );
  }

  const company = await prisma.company.findFirst({
    select: { id: true, ...COMPANY_IDENTITY_SELECT },
    orderBy: { createdAt: "asc" },
  });

  if (!company) {
    return (
      <AppShell
        titleKey="pages.companyDetails.title"
        descriptionKey="pages.companyDetails.description"
      >
        <p className="rounded-3xl border border-border bg-elevated p-8 text-text">
          <T k="pages.companyDetails.companyNotFound" />
        </p>
      </AppShell>
    );
  }

  const bankAccounts = await listCompanyBankAccountOptions(company.id);

  return (
    <AppShell
      titleKey="pages.companyDetails.title"
      descriptionKey="pages.companyDetails.description"
    >
      <PageIntro
        titleKey="pages.companyDetails.directoryTitle"
        descriptionKey="pages.companyDetails.directoryDesc"
      />
      <CompanyDetailsForm
        defaults={{
          name: company.name,
          website: company.website ?? "",
          address: company.address ?? "",
          phone: company.phone ?? "",
          email: company.email ?? "",
          npwp: company.npwp ?? "",
        }}
        bankAccounts={bankAccounts}
      />
    </AppShell>
  );
}
