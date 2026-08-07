import type { Metadata } from "next";
import { Hero } from "@/components/hero";
import {
  ProblemsSection,
  JourneySection,
  KeepTeamSection,
  CasesPreview,
  IndustriesPreview,
  FaqSection,
} from "@/components/home-sections";
import {
  DirectionsSection,
  TeamSection,
  PeopleAiSection,
  StepsSection,
  FormatsSection,
  OwnerResultsSection,
  TrustSection,
  FinalCta,
} from "@/components/common-sections";
import { faq, SITE_URL } from "@/lib/site-data";
import { jsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "Внешний коммерческий контур для частных клиник",
  "Весь путь пациента — от сайта и рекламы до лечения, оплаты и повторной работы — в одной управляемой системе.",
);

export default function Home() {
  const faqJson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(([name, text]) => ({
      "@type": "Question",
      name,
      acceptedAnswer: { "@type": "Answer", text },
    })),
  };
  const websiteJson = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Клиника в цифрах",
    url: SITE_URL,
  };
  return (
    <>
      <Hero />
      <ProblemsSection />
      <JourneySection />
      <DirectionsSection />
      <KeepTeamSection />
      <TeamSection />
      <PeopleAiSection />
      <StepsSection />
      <FormatsSection />
      <OwnerResultsSection />
      <TrustSection />
      <CasesPreview />
      <IndustriesPreview />
      <FaqSection />
      <FinalCta />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqJson) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(websiteJson) }}
      />
    </>
  );
}
