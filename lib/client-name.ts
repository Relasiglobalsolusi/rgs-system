import type { Prisma } from "@prisma/client";

import { normalizeClientName } from "@/lib/client-login-id";
import type { AppLocale } from "@/lib/i18n/locale";
import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { translate } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | typeof prisma;

/**
 * Company + individual client names must be unique among all non-permanently
 * deleted rows (active and soft-deleted), using {@link normalizeClientName}
 * (trim, collapse spaces, casefold, strip diacritics).
 *
 * Full individual name only — not first-name alone. Soft-deleted names stay
 * reserved until permanent delete (matches import / legal-name SOP).
 */
export async function assertClientNameAvailable(
  options: {
    companyId: string;
    name: string;
    excludeId?: string;
    locale?: AppLocale;
  },
  db: Tx = prisma
): Promise<string> {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const nameNormalized = normalizeClientName(options.name);
  if (!nameNormalized) {
    throw new Error(translate(locale, "pages.clients.clientNameRequired"));
  }

  const existing = await db.client.findFirst({
    where: {
      companyId: options.companyId,
      nameNormalized,
      ...(options.excludeId ? { id: { not: options.excludeId } } : {}),
    },
    select: { id: true, name: true, active: true },
  });

  if (existing) {
    if (existing.active) {
      throw new Error(
        translate(locale, "pages.clients.nameAlreadyExists", {
          name: existing.name,
        })
      );
    }
    throw new Error(
      translate(locale, "pages.clients.nameExistsInDeleted", {
        name: existing.name,
      })
    );
  }

  return nameNormalized;
}
