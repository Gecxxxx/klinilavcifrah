import {
  ArrowRight,
  Check,
  Database,
  Eye,
  Gauge,
  Wrench,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ServicePageData } from "@/lib/site-data";
import { PageHero } from "./page-hero";
import { FinalCta, SectionHeading } from "./common-sections";
import { Reveal } from "./reveal";
import { jsonLd } from "@/lib/seo";

export function ServicePage({ data }: { data: ServicePageData }) {
  const sections = [
    {
      eyebrow: "Когда это требуется",
      title: "Сигналы, что участок требует управления",
      items: data.when,
      icon: Eye,
    },
    {
      eyebrow: "Что проверяем",
      title: "Сначала — фактическое состояние системы",
      items: data.checks,
      icon: Gauge,
    },
    {
      eyebrow: "Что делаем",
      title: "Работа строится вокруг измеримой задачи",
      items: data.actions,
      icon: Wrench,
    },
    {
      eyebrow: "Результат для собственника",
      title: "Не отдельный отчёт, а управленческая картина",
      items: data.outcomes,
      icon: Check,
    },
    {
      eyebrow: "Какие данные нужны",
      title: "Минимальный набор зависит от задачи",
      items: data.data,
      icon: Database,
    },
    {
      eyebrow: "Как измеряем",
      title: "Показатели связываются с коммерческим результатом",
      items: data.measures,
      icon: Gauge,
    },
  ];
  return (
    <>
      <PageHero eyebrow={data.eyebrow} title={data.title} lead={data.lead} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "Service",
            name: data.title,
            description: data.lead,
            url: data.slug,
            provider: { "@type": "Organization", name: "Клиника в цифрах" },
          }),
        }}
      />
      <section className="section service-intro">
        <div className="container service-owner">
          <div>
            <p className="eyebrow">Зона ответственности</p>
            <h2>{data.owner}</h2>
            <p>{data.ownerRole}</p>
          </div>
          <p>
            Работа ведётся внутри общего коммерческого плана. Ответственный
            руководитель соединяет данные, решения, исполнителей и сроки.
          </p>
        </div>
      </section>
      {sections.map((section, index) => {
        const Icon = section.icon;
        return (
          <section
            className={`section service-detail ${index % 2 ? "soft-section" : ""}`}
            key={section.eyebrow}
          >
            <div className="container service-detail-grid">
              <SectionHeading eyebrow={section.eyebrow} title={section.title} />
              <div className="detail-list">
                {section.items.map((item, i) => (
                  <Reveal className="detail-item" key={item}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <Icon size={23} weight="duotone" />
                    <p>{item}</p>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        );
      })}
      <section className="section next-direction">
        <div className="container">
          <p className="eyebrow">Связанные направления</p>
          <div className="next-links">
            <Link href="/chto-my-delaem">
              Вся система <ArrowRight size={18} />
            </Link>
            <Link href="/kak-rabotaem">
              Как начинаем <ArrowRight size={18} />
            </Link>
            <Link href="/dlya-klinik">
              Для клиник <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <FinalCta title={`Разберём задачу: ${data.title.toLowerCase()}`} />
    </>
  );
}
