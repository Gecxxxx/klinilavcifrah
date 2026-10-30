import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { catalogServices, catalogStages, type CatalogService } from "@/lib/service-catalog";
import { SectionHeading } from "./common-sections";

const stageLabels: Record<CatalogService["stage"], string> = {
  review: "Предварительный разбор",
  diagnostics: "Диагностика",
  task: "Точечное решение",
  program: "90 дней",
  management: "Внешнее управление",
};

function ServiceCard({ service }: { service: CatalogService }) {
  const index = catalogServices.indexOf(service);
  return (
    <article className={`catalog-card${service.id === "crm-mis-commercial-data" ? " catalog-card-wide" : ""}`} id={`service-${service.id}`} data-catalog-service={service.id}>
      <div className="catalog-card-visual">
        <Image
          src={`/images/services/${service.id}.webp`}
          alt=""
          width={1200}
          height={800}
          sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 40vw"
        />
        <div className="catalog-card-badges">
          <span className="catalog-service-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <span className="catalog-service-kind">{stageLabels[service.stage]}</span>
        </div>
      </div>
      <div className="catalog-card-body">
      <h4>{service.title}</h4>
      <p className="catalog-price">{service.price}</p>
      <p className="catalog-intro">{service.intro}</p>
      <p className="catalog-result"><strong>Результат</strong>{service.result}</p>
      <details className="catalog-details">
        <summary aria-label={`Состав и условия услуги «${service.title}»`}>Состав и условия <ArrowDown size={17} aria-hidden="true" /></summary>
        <div>
          <ul>{service.scope.map((item) => <li key={item}>{item}</li>)}</ul>
          {service.conditions.map((item) => <p key={item}>{item}</p>)}
        </div>
      </details>
      <Link
        className="text-link catalog-service-cta"
        href={`/kontakty?service=${service.id}&direction=${service.direction}#forma`}
        data-lead-cta="service_catalog"
        data-lead-direction={service.direction}
        aria-label={`Обсудить услугу «${service.title}»`}
      >
        Обсудить услугу <ArrowRight size={18} aria-hidden="true" />
      </Link>
      </div>
    </article>
  );
}

export function ServiceCatalog() {
  return (
    <section className="section service-catalog" aria-label="Услуги и форматы">
      <div className="container" id="uslugi-i-formaty">
        <SectionHeading
          eyebrow="От разбора к управлению"
          title="Услуги и форматы"
          lead="Начните с предварительного разбора, выберите отдельную задачу или согласуйте комплексную работу."
        />
        <nav className="catalog-nav" aria-label="Пять ступеней сотрудничества">
          {catalogStages.map((stage, index) => (
            <a href={`#catalog-${stage.id}`} key={stage.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>{stage.title}
            </a>
          ))}
        </nav>
        <div className="catalog-stages">
          {catalogStages.map((stage, index) => (
            <div className={`catalog-stage catalog-stage-${stage.id}`} id={`catalog-${stage.id}`} key={stage.id}>
              <div className="catalog-stage-heading">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{stage.title}</h3>
                {stage.id === "task" && <p>Семь точечных решений</p>}
              </div>
              <div className="catalog-card-grid">
                {catalogServices.filter((service) => service.stage === stage.id).map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="catalog-terms">
          Цены «от» обозначают начальную стоимость. Состав, сроки, порядок расчёта и условия работы согласовываем до начала платного этапа.
          Медицинские решения, назначения и клиническая ответственность остаются за врачом и клиникой.
        </p>
      </div>
    </section>
  );
}
