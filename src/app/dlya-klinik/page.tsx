import type { Metadata } from "next";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { PageHero } from "@/components/page-hero";
import { DirectionsSection, FinalCta } from "@/components/common-sections";
import { industries } from "@/lib/site-data";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "Для стоматологий, медицинских клиник и косметологии",
  "Коммерческая система для стоматологий, медицинских центров и косметологии.",
  "/dlya-klinik",
);
export default function Page() {
  return (
    <>
      <PageHero
        path="/dlya-klinik"
        eyebrow="Основная специализация"
        title="Коммерческая система для частных клиник"
        lead="У клиники может быть реклама, сайт, сотрудники и база — но не быть прозрачного пути от источника до оплаты."
      />
      <section className="section industry-nav-section">
        <div className="container industry-anchor-nav">
          {industries.map((item) => (
            <a href={`#${item.id}`} key={item.id}>
              {item.title}
            </a>
          ))}
        </div>
      </section>
      {industries.map((item, index) => (
        <section
          className={`section industry-section ${index % 2 ? "soft-section" : ""}`}
          id={item.id}
          key={item.id}
        >
          <div className="container industry-grid">
            <div>
              <p className="eyebrow">Специализация 0{index + 1}</p>
              <h2>{item.title}</h2>
              <p className="industry-journey">{item.journey}</p>
            </div>
            <div>
              <h3>Что держим в фокусе</h3>
              {item.focus.map((focus) => (
                <p className="check-line" key={focus}>
                  <Check size={18} weight="bold" />
                  {focus}
                </p>
              ))}
            </div>
          </div>
        </section>
      ))}
      <DirectionsSection compact />
      <FinalCta title="Получить предварительный разбор клиники" />
    </>
  );
}
