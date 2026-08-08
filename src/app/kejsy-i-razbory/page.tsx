import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { FinalCta, SectionHeading } from "@/components/common-sections";
import { cases } from "@/lib/site-data";
import { pageMetadata } from "@/lib/seo";
import { CasesReviewCta } from "@/components/contextual-ctas";

export const metadata: Metadata = pageMetadata(
  "Кейсы и разборы",
  "Разборы коммерческих систем клиник без выдуманных результатов и неподтверждённых цифр.",
  "/kejsy-i-razbory",
);
export default function Page() {
  return (
    <>
      <PageHero
        path="/kejsy-i-razbory"
        eyebrow="Доказательства без выдуманных цифр"
        title="Разборы и проекты"
        lead="Публикуем только подтверждённые исходные данные, принятые решения и результаты. До согласования не превращаем гипотезы в кейсы."
      />
      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Текущая структура"
            title="От наблюдения к принятому решению"
          />
          <div className="case-page-grid">
            {cases.map((item, index) => (
              <article className="case-page-card" key={item.type}>
                <div>
                  <span>0{index + 1}</span>
                  <small>{item.type}</small>
                </div>
                <h2>{item.title}</h2>
                <p>{item.text}</p>
                <footer>{item.status}</footer>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section soft-section">
        <div className="container case-method">
          <SectionHeading
            eyebrow="Когда появятся подтверждённые результаты"
            title="Полноценная структура кейса"
          />
          <div className="method-row">
            {["Было", "Что сделали", "Что изменилось", "Экономика", "Срок"].map(
              (x, i) => (
                <span key={x}>
                  <b>0{i + 1}</b>
                  {x}
                </span>
              ),
            )}
          </div>
        </div>
      </section>
      <CasesReviewCta />
      <FinalCta
        title="Подготовим структуру разбора вашей клиники"
        lead="Начнём с подтверждаемых данных и заранее определим, по каким показателям оценивать изменения."
      />
    </>
  );
}
