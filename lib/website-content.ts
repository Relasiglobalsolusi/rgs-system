import type { Prisma } from "@prisma/client";

export type WebsiteStatItem = {
  value: string;
  label: string;
  description?: string;
};

export type WebsiteServiceItem = {
  title: string;
  label: string;
  description: string;
  image: string;
};

export type WebsiteFeatureItem = {
  title: string;
  description: string;
};

export type WebsiteContentData = {
  hero: {
    titleLine1: string;
    titleLine2: string;
    titleLine3: string;
    subtitle: string;
    backgroundImage: string;
    highlights: string[];
    stats: WebsiteStatItem[];
    ctaPrimary: string;
    ctaSecondary: string;
  };
  services: {
    sectionLabel: string;
    title: string;
    subtitle: string;
    items: WebsiteServiceItem[];
  };
  stats: {
    sectionLabel: string;
    title: string;
    sidebarLabel: string;
    sidebarText: string;
    featuredValue: string;
    featuredLabel: string;
    featuredDescription: string;
    items: WebsiteStatItem[];
  };
  cta: {
    sectionLabel: string;
    title: string;
    subtitle: string;
    backgroundImage: string;
    ctaPrimary: string;
    badges: string[];
    footerNote: string;
  };
  whyChooseUs: {
    sectionLabel: string;
    title: string;
    subtitle: string;
    imageCaptionLabel: string;
    imageCaptionTitle: string;
    imageCaptionText: string;
    features: WebsiteFeatureItem[];
  };
  contact: {
    phone: string;
    email: string;
    address: string;
    addressLines: string[];
  };
  social: {
    instagram: string;
    linkedin: string;
    facebook: string;
  };
  meta: {
    siteName: string;
    tagline: string;
  };
};

export const defaultWebsiteContent: WebsiteContentData = {
  hero: {
    titleLine1: "Creating",
    titleLine2: "Better",
    titleLine3: "Environments",
    subtitle:
      "Relasi Global Solusi delivers professional cleaning, security, parking management, and integrated facility support for businesses that require dependable daily operations.",
    backgroundImage: "/images/hero/hero.jpg",
    highlights: ["Cleaning", "Security", "Parking", "Facility Support"],
    stats: [
      { value: "1000+", label: "Professional Personnel" },
      { value: "50+", label: "Corporate Clients" },
      { value: "24/7", label: "Operational Support" },
    ],
    ctaPrimary: "Request Proposal",
    ctaSecondary: "Explore Services",
  },
  services: {
    sectionLabel: "Our Services",
    title: "Integrated services for better facility operations.",
    subtitle:
      "RGS provides essential facility services that help businesses maintain cleaner, safer, and more efficient environments every day.",
    items: [
      {
        title: "Cleaning Services",
        label: "Clean & Healthy Workplaces",
        description:
          "Professional cleaning solutions for offices, commercial buildings, restaurants, hospitals, industrial facilities, and public environments.",
        image: "/images/services/cleaning.jpg",
      },
      {
        title: "Security Services",
        label: "Safe & Controlled Facilities",
        description:
          "Reliable security personnel, access control, patrol operations, and facility protection delivered with discipline and professionalism.",
        image: "/images/services/security.jpg",
      },
      {
        title: "Parking Management",
        label: "Efficient Parking Operations",
        description:
          "Structured parking management designed to improve traffic flow, visitor experience, site control, and operational efficiency.",
        image: "/images/services/parking.jpg",
      },
    ],
  },
  stats: {
    sectionLabel: "RGS By The Numbers",
    title: "Scale, reliability, and operational discipline.",
    sidebarLabel: "Trusted Operations",
    sidebarText:
      "RGS supports demanding facilities with trained personnel, responsive management, and consistent daily execution across commercial offices, hospitals, hotels, retail centres, residential developments, and industrial facilities.",
    featuredValue: "1000+",
    featuredLabel: "Professional Personnel",
    featuredDescription:
      "Highly trained personnel supporting cleaning, security, parking, and integrated facility management operations throughout Indonesia.",
    items: [
      {
        value: "50+",
        label: "Corporate Clients",
        description:
          "Trusted by commercial, healthcare, hospitality, retail, and industrial organizations.",
      },
      {
        value: "99%",
        label: "Client Satisfaction",
        description:
          "Built through consistent supervision, reporting, and dependable service delivery.",
      },
      {
        value: "24/7",
        label: "Operational Support",
        description:
          "Responsive coordination to keep facilities running smoothly every day.",
      },
    ],
  },
  cta: {
    sectionLabel: "Let's Work Together",
    title: "Ready to strengthen your facility operations?",
    subtitle:
      "Whether you need cleaning, security, parking management, or a fully integrated facility solution, RGS is ready to support your daily operations with dependable service teams.",
    backgroundImage: "/images/cta/cta.jpg",
    ctaPrimary: "Request Proposal",
    badges: ["Integrated Services", "Responsive Support", "Reliable Execution"],
    footerNote:
      "Offices, hospitals, hotels, retail destinations, residences, logistics facilities, and industrial sites.",
  },
  whyChooseUs: {
    sectionLabel: "Why Choose RGS",
    title: "A trusted partner for modern facility management.",
    subtitle:
      "We combine experienced professionals, standardized operating procedures, and integrated service management to help clients maintain safe, clean, and efficient facilities.",
    imageCaptionLabel: "Operational Excellence",
    imageCaptionTitle: "Reliable people, clear standards, and consistent execution.",
    imageCaptionText:
      "Delivering dependable facility management through experienced personnel, structured supervision, and measurable service quality.",
    features: [
      {
        title: "Integrated Facility Management",
        description:
          "One trusted partner for cleaning, security, parking, and daily facility support.",
      },
      {
        title: "Experienced Professional Team",
        description:
          "Trained personnel with discipline, supervision, and clear operational standards.",
      },
      {
        title: "Customized Service Solutions",
        description:
          "Every facility receives a practical solution based on its site, risk, and operating needs.",
      },
      {
        title: "Consistent Quality Assurance",
        description:
          "Routine inspections, reporting, and evaluations help maintain reliable service quality.",
      },
      {
        title: "Responsive Operations",
        description:
          "Fast support from supervisors and management when urgent operational needs arise.",
      },
      {
        title: "Trusted Client Experience",
        description:
          "Supporting offices, hospitals, hotels, retail destinations, residences, and industrial sites.",
      },
    ],
  },
  contact: {
    phone: "+62 21 2295 2228",
    email: "contact@rgs.co.id",
    address:
      "Jalan Daan Mogot KM 14.5, Ruko Point 8 Blok F6, Duri Kosambi, Cengkareng, West Jakarta, Indonesia",
    addressLines: [
      "Jalan Daan Mogot KM 14.5",
      "Ruko Point 8 Blok F6",
      "Duri Kosambi, Cengkareng",
      "West Jakarta, Indonesia",
    ],
  },
  social: {
    instagram: "",
    linkedin: "",
    facebook: "",
  },
  meta: {
    siteName: "PT Relasi Global Solusi",
    tagline: "Built for cleaner, safer, better-managed environments.",
  },
};

export function parseWebsiteContent(value: Prisma.JsonValue): WebsiteContentData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultWebsiteContent;
  }

  const data = value as Partial<WebsiteContentData>;

  return {
    hero: { ...defaultWebsiteContent.hero, ...data.hero },
    services: {
      ...defaultWebsiteContent.services,
      ...data.services,
      items: data.services?.items?.length
        ? data.services.items
        : defaultWebsiteContent.services.items,
    },
    stats: {
      ...defaultWebsiteContent.stats,
      ...data.stats,
      items: data.stats?.items?.length
        ? data.stats.items
        : defaultWebsiteContent.stats.items,
    },
    cta: {
      ...defaultWebsiteContent.cta,
      ...data.cta,
      badges: data.cta?.badges?.length
        ? data.cta.badges
        : defaultWebsiteContent.cta.badges,
    },
    whyChooseUs: {
      ...defaultWebsiteContent.whyChooseUs,
      ...data.whyChooseUs,
      features: data.whyChooseUs?.features?.length
        ? data.whyChooseUs.features
        : defaultWebsiteContent.whyChooseUs.features,
    },
    contact: {
      ...defaultWebsiteContent.contact,
      ...data.contact,
      addressLines: data.contact?.addressLines?.length
        ? data.contact.addressLines
        : defaultWebsiteContent.contact.addressLines,
    },
    social: { ...defaultWebsiteContent.social, ...data.social },
    meta: { ...defaultWebsiteContent.meta, ...data.meta },
  };
}

export function toWebsiteContentJson(
  data: WebsiteContentData
): Prisma.InputJsonValue {
  return data as unknown as Prisma.InputJsonValue;
}
