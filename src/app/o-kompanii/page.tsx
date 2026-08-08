import type { Metadata } from "next";
import { ArrowRight, Check, X } from "@phosphor-icons/react/dist/ssr";
import { PageHero } from "@/components/page-hero";
import {
  FinalCta,
  PeopleAiSection,
  TeamSection,
  SectionHeading,
} from "@/components/common-sections";
import { pageMetadata } from "@/lib/seo";

const pillars = [
  ["Рекламное агентство", "Внешний коммерческий контур"],
  ["Набор услуг", "Единая коммерческая система"],
  ["Лиды", "Состоявшиеся пациенты и результат"],
  ["Заменяем подрядчиков", "Сохраняем сильных и координируем"],
  ["ИИ всё сделает", "Люди + специализированные ИИ-системы"],
  ["Большой контракт сразу", "Разбор → диагностика → пилот"],
  ["Отчёты по каналам", "Единая картина для собственника"],
];
export const metadata: Metadata = pageMetadata(
  "О компании",
  "Клиника в цифрах — внешний коммерческий контур, а не ещё одно рекламное агентство.",
  "/o-kompanii",
);
export default function Page() {
  return (
    <>
      <PageHero
        path="/o-kompanii"
        eyebrow="О компании"
        title="Соединяем исполнителей, данные и процессы в одну коммерческую систему"
        lead="Определяем приоритеты, управляем реализацией и показываем собственнику результат всей цепочки."
      />
      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Опоры бренда"
            title="Не ещё одно агентство"
          />
          <div className="pillar-table">
            {pillars.map(([no, yes]) => (
              <div key={no}>
                <span>
                  <X size={17} />
                  {no}
                </span>
                <ArrowRight size={19} />
                <strong>
                  <Check size={17} />
                  {yes}
                </strong>
              </div>
            ))}
          </div>
        </div>
      </section>
      <TeamSection />
      <PeopleAiSection />
      <FinalCta />
    </>
  );
}
