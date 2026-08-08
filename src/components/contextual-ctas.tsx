import Link from "next/link";
import {
  ArrowRight,
  Browser,
  CalendarCheck,
  ChartLineUp,
  ChatCircleText,
  CheckCircle,
  Database,
  Gauge,
  MagnifyingGlass,
  Megaphone,
  Path,
  Target,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { ServicePageData } from "@/lib/site-data";

const serviceIcons = {
  marketing: [Megaphone, ChatCircleText, CalendarCheck],
  digital: [Browser, Database, ChartLineUp],
  system: [MagnifyingGlass, Target, UsersThree],
};

export function ServiceInlineCta({ data }: { data: ServicePageData }) {
  const icons = serviceIcons[data.tone];

  return (
    <aside className={`service-inline-cta inline-cta-${data.tone}`}>
      <div className="service-inline-copy">
        <p>{data.ctaEyebrow}</p>
        <h2>{data.ctaTitle}</h2>
        <span>{data.ctaLead}</span>
        <Link className="button button-primary" href="/kontakty#forma">
          Получить разбор <ArrowRight size={18} />
        </Link>
      </div>
      <div className="service-inline-flow" aria-label="Что войдёт в разбор">
        {data.ctaSteps.map((step, index) => {
          const Icon = icons[index];
          return (
            <div key={step}>
              <span>0{index + 1}</span>
              <Icon size={31} weight="duotone" />
              <strong>{step}</strong>
              {index < data.ctaSteps.length - 1 && (
                <ArrowRight size={18} aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function HomeDiagnosticCta() {
  return (
    <section className="section home-diagnostic-cta">
      <div className="container home-diagnostic-card">
        <div className="home-diagnostic-copy">
          <p className="eyebrow">С чего начать</p>
          <h2>Не знаете, где именно теряется результат?</h2>
          <p>
            Выберите участок, который вызывает больше вопросов. На разборе мы
            проверим его связь с остальной коммерческой цепочкой.
          </p>
          <Link className="button button-primary" href="/kontakty#forma">
            Получить разбор <ArrowRight size={18} />
          </Link>
        </div>
        <div className="home-diagnostic-options">
          <Link href="/marketing-i-privlechenie">
            <Megaphone size={28} weight="duotone" />
            <span>01</span>
            <strong>Мало качественных обращений</strong>
          </Link>
          <Link href="/sajt-crm-analitika">
            <Browser size={28} weight="duotone" />
            <span>02</span>
            <strong>Сайт и CRM не дают общей картины</strong>
          </Link>
          <Link href="/kommercheskaya-sistema">
            <Path size={28} weight="duotone" />
            <span>03</span>
            <strong>Пациенты теряются внутри клиники</strong>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function WorkStartCta() {
  return (
    <section className="section work-start-cta">
      <div className="container work-start-card">
        <div className="work-start-heading">
          <p className="eyebrow">Безопасный старт</p>
          <h2>Первый этап не требует перестраивать всю клинику</h2>
          <Link className="button button-primary" href="/kontakty#forma">
            Начать с разбора <ArrowRight size={18} />
          </Link>
        </div>
        <div className="work-start-route">
          <div>
            <span>40–50 минут</span>
            <strong>Фиксируем одну задачу</strong>
          </div>
          <ArrowRight size={22} aria-hidden="true" />
          <div>
            <span>2–5 наблюдений</span>
            <strong>Проверяем гипотезы</strong>
          </div>
          <ArrowRight size={22} aria-hidden="true" />
          <div>
            <span>Следующий шаг</span>
            <strong>Решаем, есть ли смысл идти дальше</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CasesReviewCta() {
  return (
    <section className="section cases-review-cta">
      <div className="container cases-review-card">
        <div className="cases-review-mark">
          <Gauge size={52} weight="duotone" />
          <span>Ваш будущий кейс начинается не с красивой цифры</span>
        </div>
        <div>
          <p className="eyebrow">Разбор вместо обещаний</p>
          <h2>Сначала зафиксируем исходную точку вашей клиники</h2>
          <p>
            Покажем, какие данные уже можно связать, чего не хватает и какой
            результат будет честно измерять прогресс.
          </p>
          <div className="cases-review-points">
            {["Исходные данные", "Точка потери", "Измеримый критерий"].map(
              (item) => (
                <span key={item}>
                  <CheckCircle size={18} />
                  {item}
                </span>
              ),
            )}
          </div>
          <Link className="button button-primary" href="/kontakty#forma">
            Разобрать мою клинику <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
