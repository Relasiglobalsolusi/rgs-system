"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import {
  defaultWebsiteContent,
  parseWebsiteContent,
  toWebsiteContentJson,
  type WebsiteContentData,
} from "@/lib/website-content";
import { normalizeAndValidatePhone } from "@/lib/phone";
import { saveWebsiteImageUpload } from "@/lib/website-upload";

export async function uploadWebsiteImage(formData: FormData) {
  await requireModule("website");

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No image file provided.");
  }

  return saveWebsiteImageUpload(file);
}

export async function getWebsiteContentForAdmin(companyId: string) {
  const record = await prisma.websiteContent.findUnique({
    where: { companyId },
  });

  if (!record) {
    return {
      content: defaultWebsiteContent,
      published: false,
      updatedAt: null as Date | null,
    };
  }

  return {
    content: parseWebsiteContent(record.content),
    published: record.published,
    updatedAt: record.updatedAt,
  };
}

export async function saveWebsiteContent(
  content: WebsiteContentData,
  published: boolean
) {
  const session = await requireModule("website");
  const companyId = session.user.companyId;

  if (!companyId) {
    throw new Error("Company not found.");
  }

  const normalizedContent: WebsiteContentData = {
    ...content,
    contact: {
      ...content.contact,
      phone: normalizeAndValidatePhone(content.contact.phone, "Phone"),
    },
  };

  await prisma.websiteContent.upsert({
    where: { companyId },
    create: {
      companyId,
      content: toWebsiteContentJson(normalizedContent),
      published,
    },
    update: {
      content: toWebsiteContentJson(normalizedContent),
      published,
    },
  });

  revalidatePath("/website");
  revalidatePath("/api/website/content");
}
