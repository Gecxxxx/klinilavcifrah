import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ChartLineUp,
  ClipboardText,
  Database,
  Globe,
  Heartbeat,
  MagnifyingGlass,
  Megaphone,
  PhoneCall,
  CalendarCheck,
  Timer,
  Briefcase,
} from "@phosphor-icons/react/dist/ssr";
import { catalogServices, catalogStages, type CatalogService } from "@/lib/service-catalog";
import { SectionHeading } from "./common-sections";

const icons = [
  MagnifyingGlass, ClipboardText, ChartLineUp, Megaphone, Globe, PhoneCall,
  Heartbeat, CalendarCheck, Database, Timer, Briefcase,
];

function ServiceCard({ service }: { service: CatalogService }) {
  const index = catalogServices.indexOf(service);
  const Icon = icons[index];
  return (
    <article className="catalog-card" id={`service-${service.id}`} data-catalog-service={service.id}>
      <div className="catalog-card-top">
        <span className="catalog-service-icon" aria-hidden="true"><Icon size={27} weight="duotone" /></span>
        <span className="catalog-service-number">{String(index + 1).padStart(2, "0")}</span>
      </div>
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
    </article>
  );
}

export function ServiceCatalog() {
  return (
    <section className="section service-catalog" id="uslugi-i-formaty" aria-label="Услуги и форматы">
      <div className="container">
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
