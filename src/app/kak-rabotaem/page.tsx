import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import {
  FinalCta,
  FormatsSection,
  StepsSection,
  TrustSection,
  SectionHeading,
} from "@/components/common-sections";
import { KeepTeamSection } from "@/components/home-sections";
import { startSteps } from "@/lib/site-data";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "Как работаем",
  "Предварительный разбор, диагностика, пилот и регулярное управление коммерческой системой клиники.",
  "/kak-rabotaem",
);
export default function Page() {
  return (
    <>
      <PageHero
        path="/kak-rabotaem"
        eyebrow="Без большого договора на старте"
        title="Сначала понимаем задачу — потом определяем объём работы"
        lead="Начинаем с открытых данных и одной измеримой задачи. Расширяем работу только после подтверждения экономической целесообразности."
      />
      <StepsSection />
      <section className="section soft-section">
        <div className="container">
          <SectionHeading
            eyebrow="Результат каждого этапа"
            title="Понятный переход без скрытых обязательств"
          />
          <div className="stage-output-grid">
            {startSteps.map(([n, title], i) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>
                  {
                    [
                      "2–5 наблюдений и гипотез",
                      "Одна измеримая задача и список данных",
                      "Карта потерь, KPI и план 30/60/90",
                      "Проверенный на реальных данных подход",
                      "Постоянная система управления",
                    ][i]
                  }
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <FormatsSection />
      <KeepTeamSection />
      <TrustSection />
      <FinalCta />
    </>
  );
}
