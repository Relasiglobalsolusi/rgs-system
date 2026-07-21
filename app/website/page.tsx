import AppShell from "@/components/layout/AppShell";
import T from "@/components/i18n/T";
import WebsiteContentForm from "@/components/website/WebsiteContentForm";
import { getWebsiteContentForAdmin } from "@/app/website/actions";
import { requireModule } from "@/lib/session";

export default async function WebsitePage() {
  const session = await requireModule("website");
  const companyId = session.user.companyId;

  if (!companyId) {
    return (
      <AppShell
        titleKey="pages.website.title"
        descriptionKey="pages.website.description"
      >
        <p className="text-text">
          <T k="pages.website.companyNotFound" />
        </p>
      </AppShell>
    );
  }

  const { content, published, updatedAt } =
    await getWebsiteContentForAdmin(companyId);

  return (
    <AppShell
      titleKey="pages.website.title"
      descriptionKey="pages.website.descriptionEdit"
    >
      <WebsiteContentForm
        initialContent={content}
        initialPublished={published}
        updatedAt={updatedAt?.toISOString() ?? null}
      />
    </AppShell>
  );
}
