"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveWebsiteContent } from "@/app/website/actions";
import type { WebsiteContentData } from "@/lib/website-content";
import SectionCard from "@/components/ui/SectionCard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/PhoneInput";
import {
  CmsContentBlock,
  CmsField,
  CmsImageUpload,
  CmsNavItem,
  CmsSectionHeader,
  CmsToolbar,
  cmsInputClass,
  cmsTextareaClass,
} from "@/components/website/website-cms-ui";
import {
  Award,
  BarChart3,
  Globe,
  LayoutTemplate,
  Mail,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";

type TabId =
  | "hero"
  | "services"
  | "stats"
  | "whyChooseUs"
  | "cta"
  | "contact";

const tabs: {
  id: TabId;
  icon: typeof Globe;
}[] = [
  { id: "hero", icon: LayoutTemplate },
  { id: "services", icon: Sparkles },
  { id: "stats", icon: BarChart3 },
  { id: "whyChooseUs", icon: Award },
  { id: "cta", icon: Megaphone },
  { id: "contact", icon: Mail },
];

type Props = {
  initialContent: WebsiteContentData;
  initialPublished: boolean;
  updatedAt: string | null;
};

export default function WebsiteContentForm({
  initialContent,
  initialPublished,
  updatedAt,
}: Props) {
  const { t } = useT();
  const [content, setContent] = useState(initialContent);
  const [published, setPublished] = useState(initialPublished);
  const [activeTab, setActiveTab] = useState<TabId>("hero");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function tabLabel(id: TabId) {
    return t(`pages.website.tabs.${id}.label`);
  }

  function tabDescription(id: TabId) {
    return t(`pages.website.tabs.${id}.description`);
  }

  function updateHero<K extends keyof WebsiteContentData["hero"]>(
    key: K,
    value: WebsiteContentData["hero"][K]
  ) {
    setContent((prev) => ({
      ...prev,
      hero: { ...prev.hero, [key]: value },
    }));
  }

  function updateServices<K extends keyof WebsiteContentData["services"]>(
    key: K,
    value: WebsiteContentData["services"][K]
  ) {
    setContent((prev) => ({
      ...prev,
      services: { ...prev.services, [key]: value },
    }));
  }

  function updateStats<K extends keyof WebsiteContentData["stats"]>(
    key: K,
    value: WebsiteContentData["stats"][K]
  ) {
    setContent((prev) => ({
      ...prev,
      stats: { ...prev.stats, [key]: value },
    }));
  }

  function updateWhyChooseUs<
    K extends keyof WebsiteContentData["whyChooseUs"],
  >(key: K, value: WebsiteContentData["whyChooseUs"][K]) {
    setContent((prev) => ({
      ...prev,
      whyChooseUs: { ...prev.whyChooseUs, [key]: value },
    }));
  }

  function updateCta<K extends keyof WebsiteContentData["cta"]>(
    key: K,
    value: WebsiteContentData["cta"][K]
  ) {
    setContent((prev) => ({
      ...prev,
      cta: { ...prev.cta, [key]: value },
    }));
  }

  function updateContact<K extends keyof WebsiteContentData["contact"]>(
    key: K,
    value: WebsiteContentData["contact"][K]
  ) {
    setContent((prev) => ({
      ...prev,
      contact: { ...prev.contact, [key]: value },
    }));
  }

  function updateSocial<K extends keyof WebsiteContentData["social"]>(
    key: K,
    value: WebsiteContentData["social"][K]
  ) {
    setContent((prev) => ({
      ...prev,
      social: { ...prev.social, [key]: value },
    }));
  }

  function updateMeta<K extends keyof WebsiteContentData["meta"]>(
    key: K,
    value: WebsiteContentData["meta"][K]
  ) {
    setContent((prev) => ({
      ...prev,
      meta: { ...prev.meta, [key]: value },
    }));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveWebsiteContent(content, published);
        setSaved(true);
        toast.success(
          published
            ? t("pages.website.savedPublished")
            : t("pages.website.savedDraft")
        );
        setTimeout(() => setSaved(false), 2500);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("pages.website.saveFailed")
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <SectionCard className="p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-elevated ring-1 ring-slate-700/60">
            <Globe className="h-6 w-6 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-text">
              {t("pages.website.contentTitle")}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-subtle">
              {t("pages.website.contentDescriptionBefore")}{" "}
              <span className="font-medium text-muted">rgs.co.id</span>
              {t("pages.website.contentDescriptionMiddle")}{" "}
              <code className="rounded-md bg-elevated px-1.5 py-0.5 text-xs text-cyan-300 ring-1 ring-slate-700/60">
                /api/website/content
              </code>
              {t("pages.website.contentDescriptionAfter")}
            </p>
          </div>
        </div>
      </SectionCard>

      <CmsToolbar
        published={published}
        updatedAt={updatedAt}
        pending={pending}
        saved={saved}
        onPublishedChange={setPublished}
        onSave={handleSave}
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="hidden shrink-0 lg:block lg:w-60">
          <nav className="sticky top-24 space-y-1.5">
            {tabs.map((tab) => (
              <CmsNavItem
                key={tab.id}
                icon={tab.icon}
                label={tabLabel(tab.id)}
                description={tabDescription(tab.id)}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition",
                    active
                      ? "border-accent-cyan/35 bg-card-tint-cyan text-cyan-300"
                      : "border-border bg-elevated text-subtle"
                  )}
                >
                  <Icon size={15} />
                  {tabLabel(tab.id)}
                </button>
              );
            })}
          </div>

          <SectionCard className="p-6 sm:p-8">
            <CmsSectionHeader
              title={tabLabel(activeTab)}
              description={tabDescription(activeTab)}
            />

            <div className="mt-6 space-y-6">
              {activeTab === "hero" && (
                <>
                  <CmsImageUpload
                    label={t("pages.website.fields.heroBackgroundImage")}
                    hint={t("pages.website.fields.heroBackgroundHint")}
                    value={content.hero.backgroundImage}
                    onChange={(url) => updateHero("backgroundImage", url)}
                    defaultImage="/images/hero/hero.jpg"
                  />

                  <div className="grid gap-5 md:grid-cols-2">
                    <CmsField label={t("pages.website.fields.titleLine1")}>
                      <Input
                        className={cmsInputClass}
                        value={content.hero.titleLine1}
                        onChange={(e) => updateHero("titleLine1", e.target.value)}
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.titleLine2")}>
                      <Input
                        className={cmsInputClass}
                        value={content.hero.titleLine2}
                        onChange={(e) => updateHero("titleLine2", e.target.value)}
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.titleLine3")}>
                      <Input
                        className={cmsInputClass}
                        value={content.hero.titleLine3}
                        onChange={(e) => updateHero("titleLine3", e.target.value)}
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.primaryButton")}>
                      <Input
                        className={cmsInputClass}
                        value={content.hero.ctaPrimary}
                        onChange={(e) => updateHero("ctaPrimary", e.target.value)}
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.secondaryButton")}>
                      <Input
                        className={cmsInputClass}
                        value={content.hero.ctaSecondary}
                        onChange={(e) =>
                          updateHero("ctaSecondary", e.target.value)
                        }
                      />
                    </CmsField>
                    <CmsField
                      label={t("pages.website.fields.highlights")}
                      hint={t("pages.website.fields.highlightsHint")}
                    >
                      <Input
                        className={cmsInputClass}
                        value={content.hero.highlights.join(", ")}
                        onChange={(e) =>
                          updateHero(
                            "highlights",
                            e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                          )
                        }
                      />
                    </CmsField>
                    <div className="md:col-span-2">
                      <CmsField label={t("pages.website.fields.subtitle")}>
                        <Textarea
                          className={cmsTextareaClass}
                          value={content.hero.subtitle}
                          onChange={(e) => updateHero("subtitle", e.target.value)}
                          rows={3}
                        />
                      </CmsField>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm font-medium text-muted">
                      {t("pages.website.heroStatistics")}
                    </p>
                    {content.hero.stats.map((stat, index) => (
                      <CmsContentBlock
                        key={index}
                        index={index}
                        title={t("pages.website.statN", { n: index + 1 })}
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <CmsField label={t("pages.website.fields.value")}>
                            <Input
                              className={cmsInputClass}
                              value={stat.value}
                              onChange={(e) => {
                                const stats = [...content.hero.stats];
                                stats[index] = {
                                  ...stats[index],
                                  value: e.target.value,
                                };
                                updateHero("stats", stats);
                              }}
                            />
                          </CmsField>
                          <CmsField label={t("pages.website.fields.label")}>
                            <Input
                              className={cmsInputClass}
                              value={stat.label}
                              onChange={(e) => {
                                const stats = [...content.hero.stats];
                                stats[index] = {
                                  ...stats[index],
                                  label: e.target.value,
                                };
                                updateHero("stats", stats);
                              }}
                            />
                          </CmsField>
                        </div>
                      </CmsContentBlock>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "services" && (
                <>
                  <div className="grid gap-5 md:grid-cols-2">
                    <CmsField label={t("pages.website.fields.sectionLabel")}>
                      <Input
                        className={cmsInputClass}
                        value={content.services.sectionLabel}
                        onChange={(e) =>
                          updateServices("sectionLabel", e.target.value)
                        }
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.sectionTitle")}>
                      <Input
                        className={cmsInputClass}
                        value={content.services.title}
                        onChange={(e) => updateServices("title", e.target.value)}
                      />
                    </CmsField>
                    <div className="md:col-span-2">
                      <CmsField label={t("pages.website.fields.sectionSubtitle")}>
                        <Textarea
                          className={cmsTextareaClass}
                          value={content.services.subtitle}
                          onChange={(e) =>
                            updateServices("subtitle", e.target.value)
                          }
                          rows={3}
                        />
                      </CmsField>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {content.services.items.map((service, index) => (
                      <CmsContentBlock
                        key={index}
                        index={index}
                        title={
                          service.title ||
                          t("pages.website.serviceN", { n: index + 1 })
                        }
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <CmsField label={t("pages.website.fields.title")}>
                            <Input
                              className={cmsInputClass}
                              value={service.title}
                              onChange={(e) => {
                                const items = [...content.services.items];
                                items[index] = {
                                  ...items[index],
                                  title: e.target.value,
                                };
                                updateServices("items", items);
                              }}
                            />
                          </CmsField>
                          <CmsField label={t("pages.website.fields.label")}>
                            <Input
                              className={cmsInputClass}
                              value={service.label}
                              onChange={(e) => {
                                const items = [...content.services.items];
                                items[index] = {
                                  ...items[index],
                                  label: e.target.value,
                                };
                                updateServices("items", items);
                              }}
                            />
                          </CmsField>
                          <div className="md:col-span-2">
                            <CmsField label={t("pages.website.fields.description")}>
                              <Textarea
                                className={cmsTextareaClass}
                                value={service.description}
                                onChange={(e) => {
                                  const items = [...content.services.items];
                                  items[index] = {
                                    ...items[index],
                                    description: e.target.value,
                                  };
                                  updateServices("items", items);
                                }}
                                rows={3}
                              />
                            </CmsField>
                          </div>
                          <div className="md:col-span-2">
                            <CmsImageUpload
                              label={t("pages.website.fields.serviceImage")}
                              hint={t("pages.website.fields.serviceImageHint")}
                              value={service.image}
                              onChange={(url) => {
                                const items = [...content.services.items];
                                items[index] = {
                                  ...items[index],
                                  image: url,
                                };
                                updateServices("items", items);
                              }}
                            />
                          </div>
                        </div>
                      </CmsContentBlock>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "stats" && (
                <>
                  <div className="grid gap-5 md:grid-cols-2">
                    <CmsField label={t("pages.website.fields.sectionLabel")}>
                      <Input
                        className={cmsInputClass}
                        value={content.stats.sectionLabel}
                        onChange={(e) =>
                          updateStats("sectionLabel", e.target.value)
                        }
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.sectionTitle")}>
                      <Input
                        className={cmsInputClass}
                        value={content.stats.title}
                        onChange={(e) => updateStats("title", e.target.value)}
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.sidebarLabel")}>
                      <Input
                        className={cmsInputClass}
                        value={content.stats.sidebarLabel}
                        onChange={(e) =>
                          updateStats("sidebarLabel", e.target.value)
                        }
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.featuredValue")}>
                      <Input
                        className={cmsInputClass}
                        value={content.stats.featuredValue}
                        onChange={(e) =>
                          updateStats("featuredValue", e.target.value)
                        }
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.featuredLabel")}>
                      <Input
                        className={cmsInputClass}
                        value={content.stats.featuredLabel}
                        onChange={(e) =>
                          updateStats("featuredLabel", e.target.value)
                        }
                      />
                    </CmsField>
                    <div className="md:col-span-2">
                      <CmsField label={t("pages.website.fields.sidebarText")}>
                        <Textarea
                          className={cmsTextareaClass}
                          value={content.stats.sidebarText}
                          onChange={(e) =>
                            updateStats("sidebarText", e.target.value)
                          }
                          rows={3}
                        />
                      </CmsField>
                    </div>
                    <div className="md:col-span-2">
                      <CmsField
                        label={t("pages.website.fields.featuredDescription")}
                      >
                        <Textarea
                          className={cmsTextareaClass}
                          value={content.stats.featuredDescription}
                          onChange={(e) =>
                            updateStats("featuredDescription", e.target.value)
                          }
                          rows={3}
                        />
                      </CmsField>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm font-medium text-muted">
                      {t("pages.website.statCards")}
                    </p>
                    {content.stats.items.map((stat, index) => (
                      <CmsContentBlock
                        key={index}
                        index={index}
                        title={
                          stat.label ||
                          t("pages.website.statN", { n: index + 1 })
                        }
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <CmsField label={t("pages.website.fields.value")}>
                            <Input
                              className={cmsInputClass}
                              value={stat.value}
                              onChange={(e) => {
                                const items = [...content.stats.items];
                                items[index] = {
                                  ...items[index],
                                  value: e.target.value,
                                };
                                updateStats("items", items);
                              }}
                            />
                          </CmsField>
                          <CmsField label={t("pages.website.fields.label")}>
                            <Input
                              className={cmsInputClass}
                              value={stat.label}
                              onChange={(e) => {
                                const items = [...content.stats.items];
                                items[index] = {
                                  ...items[index],
                                  label: e.target.value,
                                };
                                updateStats("items", items);
                              }}
                            />
                          </CmsField>
                          <div className="md:col-span-2">
                            <CmsField
                              label={t("pages.website.fields.description")}
                            >
                              <Textarea
                                className={cmsTextareaClass}
                                value={stat.description ?? ""}
                                onChange={(e) => {
                                  const items = [...content.stats.items];
                                  items[index] = {
                                    ...items[index],
                                    description: e.target.value,
                                  };
                                  updateStats("items", items);
                                }}
                                rows={2}
                              />
                            </CmsField>
                          </div>
                        </div>
                      </CmsContentBlock>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "whyChooseUs" && (
                <>
                  <div className="grid gap-5 md:grid-cols-2">
                    <CmsField label={t("pages.website.fields.sectionLabel")}>
                      <Input
                        className={cmsInputClass}
                        value={content.whyChooseUs.sectionLabel}
                        onChange={(e) =>
                          updateWhyChooseUs("sectionLabel", e.target.value)
                        }
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.sectionTitle")}>
                      <Input
                        className={cmsInputClass}
                        value={content.whyChooseUs.title}
                        onChange={(e) =>
                          updateWhyChooseUs("title", e.target.value)
                        }
                      />
                    </CmsField>
                    <div className="md:col-span-2">
                      <CmsField label={t("pages.website.fields.sectionSubtitle")}>
                        <Textarea
                          className={cmsTextareaClass}
                          value={content.whyChooseUs.subtitle}
                          onChange={(e) =>
                            updateWhyChooseUs("subtitle", e.target.value)
                          }
                          rows={3}
                        />
                      </CmsField>
                    </div>
                    <CmsField label={t("pages.website.fields.imageCaptionLabel")}>
                      <Input
                        className={cmsInputClass}
                        value={content.whyChooseUs.imageCaptionLabel}
                        onChange={(e) =>
                          updateWhyChooseUs("imageCaptionLabel", e.target.value)
                        }
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.imageCaptionTitle")}>
                      <Input
                        className={cmsInputClass}
                        value={content.whyChooseUs.imageCaptionTitle}
                        onChange={(e) =>
                          updateWhyChooseUs("imageCaptionTitle", e.target.value)
                        }
                      />
                    </CmsField>
                    <div className="md:col-span-2">
                      <CmsField
                        label={t("pages.website.fields.imageCaptionText")}
                      >
                        <Textarea
                          className={cmsTextareaClass}
                          value={content.whyChooseUs.imageCaptionText}
                          onChange={(e) =>
                            updateWhyChooseUs("imageCaptionText", e.target.value)
                          }
                          rows={3}
                        />
                      </CmsField>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm font-medium text-muted">
                      {t("pages.website.featureCards")}
                    </p>
                    {content.whyChooseUs.features.map((feature, index) => (
                      <CmsContentBlock
                        key={index}
                        index={index}
                        title={
                          feature.title ||
                          t("pages.website.featureN", { n: index + 1 })
                        }
                      >
                        <div className="grid gap-4">
                          <CmsField label={t("pages.website.fields.title")}>
                            <Input
                              className={cmsInputClass}
                              value={feature.title}
                              onChange={(e) => {
                                const features = [
                                  ...content.whyChooseUs.features,
                                ];
                                features[index] = {
                                  ...features[index],
                                  title: e.target.value,
                                };
                                updateWhyChooseUs("features", features);
                              }}
                            />
                          </CmsField>
                          <CmsField label={t("pages.website.fields.description")}>
                            <Textarea
                              className={cmsTextareaClass}
                              value={feature.description}
                              onChange={(e) => {
                                const features = [
                                  ...content.whyChooseUs.features,
                                ];
                                features[index] = {
                                  ...features[index],
                                  description: e.target.value,
                                };
                                updateWhyChooseUs("features", features);
                              }}
                              rows={2}
                            />
                          </CmsField>
                        </div>
                      </CmsContentBlock>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "cta" && (
                <>
                  <CmsImageUpload
                    label={t("pages.website.fields.ctaBackgroundImage")}
                    hint={t("pages.website.fields.ctaBackgroundHint")}
                    value={content.cta.backgroundImage}
                    onChange={(url) => updateCta("backgroundImage", url)}
                    defaultImage="/images/cta/cta.jpg"
                  />

                  <div className="grid gap-5 md:grid-cols-2">
                  <CmsField label={t("pages.website.fields.sectionLabel")}>
                    <Input
                      className={cmsInputClass}
                      value={content.cta.sectionLabel}
                      onChange={(e) => updateCta("sectionLabel", e.target.value)}
                    />
                  </CmsField>
                  <CmsField label={t("pages.website.fields.primaryButton")}>
                    <Input
                      className={cmsInputClass}
                      value={content.cta.ctaPrimary}
                      onChange={(e) => updateCta("ctaPrimary", e.target.value)}
                    />
                  </CmsField>
                  <CmsField label={t("pages.website.fields.title")}>
                    <Input
                      className={cmsInputClass}
                      value={content.cta.title}
                      onChange={(e) => updateCta("title", e.target.value)}
                    />
                  </CmsField>
                  <CmsField
                    label={t("pages.website.fields.badges")}
                    hint={t("pages.website.fields.badgesHint")}
                  >
                    <Input
                      className={cmsInputClass}
                      value={content.cta.badges.join(", ")}
                      onChange={(e) =>
                        updateCta(
                          "badges",
                          e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                        )
                      }
                    />
                  </CmsField>
                  <div className="md:col-span-2">
                    <CmsField label={t("pages.website.fields.subtitle")}>
                      <Textarea
                        className={cmsTextareaClass}
                        value={content.cta.subtitle}
                        onChange={(e) => updateCta("subtitle", e.target.value)}
                        rows={3}
                      />
                    </CmsField>
                  </div>
                  <div className="md:col-span-2">
                    <CmsField label={t("pages.website.fields.footerNote")}>
                      <Textarea
                        className={cmsTextareaClass}
                        value={content.cta.footerNote}
                        onChange={(e) => updateCta("footerNote", e.target.value)}
                        rows={2}
                      />
                    </CmsField>
                  </div>
                  </div>
                </>
              )}

              {activeTab === "contact" && (
                <>
                  <div className="grid gap-5 md:grid-cols-2">
                    <CmsField label={t("pages.website.fields.phone")}>
                      <PhoneInput
                        value={content.contact.phone}
                        onChange={(phone) => updateContact("phone", phone)}
                        inputClassName={cmsInputClass}
                        selectClassName="h-11 rounded-xl border border-border bg-elevated text-sm text-text"
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.email")}>
                      <Input
                        className={cmsInputClass}
                        type="email"
                        value={content.contact.email}
                        onChange={(e) => updateContact("email", e.target.value)}
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.instagramUrl")}>
                      <Input
                        className={cmsInputClass}
                        value={content.social.instagram}
                        onChange={(e) =>
                          updateSocial("instagram", e.target.value)
                        }
                        placeholder="https://instagram.com/..."
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.linkedinUrl")}>
                      <Input
                        className={cmsInputClass}
                        value={content.social.linkedin}
                        onChange={(e) =>
                          updateSocial("linkedin", e.target.value)
                        }
                        placeholder="https://linkedin.com/company/..."
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.facebookUrl")}>
                      <Input
                        className={cmsInputClass}
                        value={content.social.facebook}
                        onChange={(e) =>
                          updateSocial("facebook", e.target.value)
                        }
                        placeholder="https://facebook.com/..."
                      />
                    </CmsField>
                    <CmsField label={t("pages.website.fields.siteName")}>
                      <Input
                        className={cmsInputClass}
                        value={content.meta.siteName}
                        onChange={(e) => updateMeta("siteName", e.target.value)}
                      />
                    </CmsField>
                    <div className="md:col-span-2">
                      <CmsField
                        label={t("pages.website.fields.address")}
                        hint={t("pages.website.fields.addressHint")}
                      >
                        <Textarea
                          className={cmsTextareaClass}
                          value={content.contact.addressLines.join("\n")}
                          onChange={(e) =>
                            updateContact(
                              "addressLines",
                              e.target.value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean)
                            )
                          }
                          rows={4}
                        />
                      </CmsField>
                    </div>
                    <div className="md:col-span-2">
                      <CmsField label={t("pages.website.fields.footerTagline")}>
                        <Input
                          className={cmsInputClass}
                          value={content.meta.tagline}
                          onChange={(e) => updateMeta("tagline", e.target.value)}
                        />
                      </CmsField>
                    </div>
                  </div>
                </>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
