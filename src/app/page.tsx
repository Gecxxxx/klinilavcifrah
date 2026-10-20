import type { Metadata } from "next";
import { Hero } from "@/components/hero";
import {
  ProblemsSection,
  JourneySection,
  KeepTeamSection,
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
  FinalCta,
} from "@/components/common-sections";
import { faq, SITE_URL } from "@/lib/site-data";
import { jsonLd, pageMetadata } from "@/lib/seo";
import { HomeDiagnosticCta } from "@/components/contextual-ctas";

export const metadata: Metadata = pageMetadata(
  "Внешнее коммерческое управление частными клиниками",
  "От пациентопотока до прибыли: коммерческие процессы, загрузка врачей и экономика клиники. Начните с предварительного разбора по открытым данным.",
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
      <HomeDiagnosticCta />
      <DirectionsSection />
      <KeepTeamSection />
      <TeamSection />
      <PeopleAiSection />
      <StepsSection />
      <FormatsSection />
      <OwnerResultsSection />
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
