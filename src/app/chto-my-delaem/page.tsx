import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import {
  DirectionsSection,
  FinalCta,
  FormatsSection,
  OwnerResultsSection,
} from "@/components/common-sections";
import { JourneySection, KeepTeamSection } from "@/components/home-sections";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "Что мы делаем",
  "Управляем ключевыми участками коммерческой системы клиники — от привлечения до оплаты и повторного пациента.",
  "/chto-my-delaem",
);
export default function Page() {
  return (
    <>
      <PageHero
        path="/chto-my-delaem"
        eyebrow="Единая коммерческая система"
        title="Что мы берём под управление"
        lead="Не собираем каталог из десятков услуг. Соединяем три зоны управления вокруг полного пути пациента."
      />
      <JourneySection />
      <DirectionsSection />
      <KeepTeamSection />
      <FormatsSection />
      <OwnerResultsSection />
      <FinalCta />
    </>
  );
}
