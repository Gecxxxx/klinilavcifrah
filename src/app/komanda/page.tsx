import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import {
  FinalCta,
  PeopleAiSection,
  TeamSection,
  SectionHeading,
} from "@/components/common-sections";
import { jsonLd, pageMetadata } from "@/lib/seo";
import { team } from "@/lib/site-data";

export const metadata: Metadata = pageMetadata(
  "Команда",
  "Три зоны ответственности: коммерческое управление, маркетинг и digital-технологии.",
  "/komanda",
);
export default function Page() {
  return (
    <>
      <PageHero
        path="/komanda"
        eyebrow="Конкретные люди и ответственность"
        title="Кому собственник передаёт часть управления бизнесом"
        lead="Работа строится вокруг общей коммерческой задачи, единого плана и согласованных показателей."
      />
      <TeamSection />
      <section className="section soft-section">
        <div className="container">
          <SectionHeading
            eyebrow="Принцип взаимодействия"
            title="Собственнику не нужно соединять исполнителей вручную"
          />
          <div className="responsibility-flow">
            <article>
              <span>01</span>
              <h3>Общая задача</h3>
              <p>Фиксируем коммерческую цель и границы ответственности.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Единый план</h3>
              <p>Соединяем маркетинг, digital, обработку и данные.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Согласованные KPI</h3>
              <p>
                Каждый руководитель отвечает за свою зону и общий результат.
              </p>
            </article>
          </div>
        </div>
      </section>
      <PeopleAiSection />
      <FinalCta title="Обсудим, какую часть системы передать команде" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": team.map((person) => ({
              "@type": "Person",
              name: person.name,
              jobTitle: person.role,
              worksFor: { "@type": "Organization", name: "Клиника в цифрах" },
            })),
          }),
        }}
      />
    </>
  );
}
