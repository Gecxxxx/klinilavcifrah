import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Browser,
  ChartLineUp,
  Megaphone,
  Path,
  PhoneCall,
} from "@phosphor-icons/react/dist/ssr";
import type { ServicePageData } from "@/lib/site-data";
import { directionLinks } from "@/lib/site-data";
import { jsonLd } from "@/lib/seo";
import { ServiceInlineCta } from "./contextual-ctas";
import { ServicePanel } from "./service-panel";

export function ServicePage({ data }: { data: ServicePageData }) {
  const sections = [
    { number: "01", title: "Когда это требуется", items: data.when },
    { number: "02", title: "Что проверяем", items: data.checks },
    { number: "03", title: "Что делаем", items: data.actions },
    { number: "04", title: "Что получает собственник", items: data.outcomes },
    { number: "05", title: "Какие данные нужны", items: data.data },
  ];

  return (
    <main className={`service-page service-tone-${data.tone}`}>
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

      <section className="service-hero">
        <div className="service-stream" aria-hidden="true" />
        <div className="container service-breadcrumbs">
          <Link href="/">Главная</Link>
          <span>→</span>
          <span>{data.title}</span>
        </div>
        <div className="container service-hero-grid">
          <div className="service-hero-copy">
            <p className="service-kicker">{data.eyebrow}</p>
            <h1>{data.title}</h1>
            <p className="service-lead">{data.lead}</p>
            <p className="service-owner-line">
              <strong>{data.owner}</strong>
              <span>—</span>
              {data.ownerRole}
            </p>
            <div className="service-hero-actions">
              <Link className="button button-primary" href="/kontakty#forma">
                Получить разбор
              </Link>
              {data.ownerSite && (
                <a
                  className="button service-external"
                  href={data.ownerSite}
                  target="_blank"
                  rel="noreferrer"
                >
                  Обратиться к {data.ownerDative}
                  <ArrowUpRight size={18} />
                </a>
              )}
            </div>
            {data.ownerSiteLabel && (
              <a
                className="service-site-link"
                href={data.ownerSite}
                target="_blank"
                rel="noreferrer"
              >
                {data.ownerSiteLabel} <ArrowUpRight size={15} />
              </a>
            )}
          </div>
          <div className="service-portrait-wrap">
            <div className="service-portrait-orbit" aria-hidden="true">
              <Browser size={30} weight="duotone" />
              <PhoneCall size={30} weight="duotone" />
              <ChartLineUp size={30} weight="duotone" />
            </div>
            <Image
              className="service-portrait"
              src={data.ownerImage}
              alt={`${data.owner}, ${data.ownerRole.toLowerCase()}`}
              width={900}
              height={1100}
              priority
              sizes="(max-width: 760px) 92vw, 44vw"
            />
          </div>
        </div>
      </section>

      <section className="service-content">
        <div className="container service-section-grid">
          {sections.map((section, index) => {
            return (
              <Fragment key={section.title}>
                <ServicePanel
                  index={index}
                  number={section.number}
                  title={section.title}
                  items={section.items}
                />
                {index === 1 && <ServiceInlineCta data={data} />}
              </Fragment>
            );
          })}
        </div>
      </section>

      <section className="service-journey-section">
        <div className="container">
          <div className="service-section-title">
            <span>06</span>
            <div>
              <p>Как измеряется результат</p>
              <h2>Один маршрут — общие показатели</h2>
            </div>
          </div>
          <div className="service-journey" aria-label="Коммерческий путь">
            {data.journey.map((stage, index) => (
              <div className="service-journey-stage" key={stage}>
                <div>
                  {index === 0 ? (
                    <Megaphone size={27} weight="duotone" />
                  ) : index === data.journey.length - 1 ? (
                    <ChartLineUp size={27} weight="duotone" />
                  ) : (
                    <Path size={27} weight="duotone" />
                  )}
                </div>
                <strong>{stage}</strong>
                {index < data.journey.length - 1 && (
                  <ArrowRight
                    className="journey-arrow"
                    size={18}
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="service-metrics">
            {data.measures.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="service-role-section">
        <div className="container service-role-card">
          <div className="service-role-number">07</div>
          <div>
            <p className="service-kicker">Роль специалиста</p>
            <h2>
              Роль {data.ownerGenitive}
            </h2>
            <p>{data.ownerRole}</p>
          </div>
          <ul>
            {data.roleItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="service-closing">
        <div className="container service-closing-grid">
          <div>
            <p className="service-kicker">Следующий шаг</p>
            <h2>{data.closingTitle}</h2>
          </div>
          <div className="service-closing-actions">
            <Link className="button button-primary" href="/kontakty#forma">
              Получить разбор
            </Link>
            {data.ownerSite && (
              <a
                className="button service-external"
                href={data.ownerSite}
                target="_blank"
                rel="noreferrer"
              >
                Обратиться к специалисту <ArrowUpRight size={18} />
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="service-related">
        <div className="container service-related-links">
          {directionLinks
            .filter((link) => link.href !== data.slug)
            .map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label} <ArrowRight size={18} />
              </Link>
            ))}
          <Link href="/kak-rabotaem">
            Как начинаем <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}
