import type { CompanyForPdf } from "@/lib/pdf-letterhead";
import { prisma } from "@/lib/prisma";
import type { WebsiteContentData } from "@/lib/website-content";

/** Company identity fields used by invoices, progress reports, and letterheads. */
export const COMPANY_IDENTITY_SELECT = {
  name: true,
  email: true,
  phone: true,
  address: true,
  website: true,
  npwp: true,
  bankName: true,
  bankAccountNumber: true,
  bankAccountName: true,
} as const;

export async function loadCompanyForPdf(
  companyId: string
): Promise<CompanyForPdf | null> {
  return prisma.company.findUnique({
    where: { id: companyId },
    select: COMPANY_IDENTITY_SELECT,
  });
}

/** Pass-through — PDFs already receive Company fields from the caller or loader. */
export async function ensureCompanyForPdf(
  company?: CompanyForPdf | null
): Promise<CompanyForPdf | null> {
  return company ?? null;
}

function addressLinesFromOffice(address?: string | null): string[] {
  return (address ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Overlay Company Details onto public website contact / site name. */
export function applyCompanyIdentityToWebsiteContent(
  content: WebsiteContentData,
  company: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    website?: string | null;
  } | null
): WebsiteContentData {
  const name = company?.name?.trim() || "";
  const email = company?.email?.trim() || "";
  const phone = company?.phone?.trim() || "";
  const address = company?.address?.trim() || "";
  const addressLines = addressLinesFromOffice(address);
  const website = company?.website?.trim() || "";

  return {
    ...content,
    contact: {
      ...content.contact,
      phone,
      email,
      address,
      addressLines,
      website,
    },
    meta: {
      ...content.meta,
      siteName: name || content.meta.siteName,
    },
  };
}
