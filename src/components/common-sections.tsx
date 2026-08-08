import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Check,
  CirclesThreePlus,
  Eye,
  Gauge,
  Handshake,
  ShieldCheck,
  Sparkle,
  Target,
  TrendUp,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import {
  directions,
  formats,
  ownerResults,
  startSteps,
  team,
} from "@/lib/site-data";
import { Reveal } from "./reveal";
import { LeadForm } from "./lead-form";

export function SectionHeading({
  eyebrow,
  title,
  lead,
  light = false,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  light?: boolean;
}) {
  return (
    <div className={`section-heading ${light ? "light" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {lead && <p>{lead}</p>}
    </div>
  );
}

export function DirectionsSection({ compact = false }: { compact?: boolean }) {
  return (
    <section className="section directions-section">
      <div className="container">
        <SectionHeading
          eyebrow="Что мы делаем"
          title="Управляем ключевыми участками коммерческой системы"
          lead="Не набор разрозненных услуг, а три зоны управления одной коммерческой цепочкой."
        />
        <div className="direction-grid">
          {directions.map((item) => (
            <Reveal key={item.href} className="direction-card">
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <Link className="text-link" href={item.href}>
                Подробнее <ArrowRight size={18} />
              </Link>
            </Reveal>
          ))}
        </div>
        {!compact && (
          <p className="section-note">
            <ShieldCheck size={23} /> Не обязательно передавать нам все
            направления. Состав работы определяется задачей и фактическим
            состоянием системы.
          </p>
        )}
      </div>
    </section>
  );
}

export function TeamSection() {
  return (
    <section className="section team-section" id="team">
      <div className="container">
        <SectionHeading
          eyebrow="Команда"
          title="Одна система — три зоны ответственности"
          lead="Собственнику не требуется самостоятельно соединять маркетолога, разработчика, аналитику, CRM и подрядчиков."
        />
        <div className="team-grid">
          {team.map((person) => (
            <Reveal
              key={person.name}
              className={`team-card tone-${person.tone}`}
            >
              <div className="team-avatar">{person.initials}</div>
              <div>
                <h3>{person.name}</h3>
                <strong>{person.role}</strong>
                <p>{person.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PeopleAiSection() {
  const human = [
    "Понимает контекст",
    "Определяет стратегию",
    "Принимает решение",
    "Ведёт переговоры",
    "Контролирует риски",
    "Несёт ответственность",
  ];
  const ai = [
    "Обрабатывает большие объёмы данных",
    "Сопоставляет информацию",
    "Ищет закономерности",
    "Ускоряет исследования",
    "Проверяет гипотезы",
    "Контролирует качество",
  ];
  return (
    <section className="section dark-section ai-section">
      <div className="container">
        <SectionHeading
          light
          eyebrow="Люди + ИИ"
          title="Человеческая экспертиза + ИИ-инструменты"
          lead="ИИ анализирует, систематизирует и предлагает. Человек проверяет, принимает решение и отвечает за результат."
        />
        <div className="ai-grid">
          <Reveal className="ai-card">
            <UsersThree size={38} weight="duotone" />
            <h3>Человек</h3>
            {human.map((x) => (
              <p key={x}>
                <Check size={16} />
                {x}
              </p>
            ))}
          </Reveal>
          <div className="ai-result">
            <Sparkle size={28} weight="fill" />
            <strong>Один управляемый результат</strong>
          </div>
          <Reveal className="ai-card">
            <Brain size={38} weight="duotone" />
            <h3>ИИ-системы</h3>
            {ai.map((x) => (
              <p key={x}>
                <Check size={16} />
                {x}
              </p>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function StepsSection() {
  return (
    <section className="section steps-section">
      <div className="container">
        <SectionHeading
          eyebrow="Как начинаем"
          title="Не предлагаем большой договор до понимания задачи"
        />
        <div className="steps-grid">
          {startSteps.map(([number, title, text]) => (
            <Reveal className="step-card" key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FormatsSection() {
  const icons = [Target, Handshake, CirclesThreePlus];
  return (
    <section className="section soft-section">
      <div className="container">
        <SectionHeading
          eyebrow="Форматы сотрудничества"
          title="Начать можно с нужного уровня ответственности"
        />
        <div className="format-grid">
          {formats.map(([title, text], i) => {
            const Icon = icons[i];
            return (
              <Reveal className="format-card" key={title}>
                <Icon size={34} weight="duotone" />
                <h3>{title}</h3>
                <p>{text}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function OwnerResultsSection() {
  const icons = [Gauge, TrendUp, Target, UsersThree, Eye, Sparkle];
  return (
    <section className="section owner-section dark-section">
      <div className="container">
        <SectionHeading
          light
          eyebrow="Результат для собственника"
          title="В итоге собственник должен видеть"
        />
        <div className="owner-grid">
          {ownerResults.map((text, index) => {
            const Icon = icons[index];
            return (
              <Reveal
                className={`owner-card owner-tone-${index + 1}`}
                key={text}
              >
                <span>0{index + 1}</span>
                <Icon size={28} weight="duotone" />
                <p>{text}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FinalCta({
  title = "Начнём с предварительного разбора",
  lead = "Изучим открытые данные и поможем определить, где именно находится резерв системы.",
}: {
  title?: string;
  lead?: string;
}) {
  return (
    <section className="section final-cta" id="forma">
      <div className="container final-cta-grid">
        <div>
          <p className="eyebrow">Следующий шаг</p>
          <h2>{title}</h2>
          <p>{lead}</p>
          <div className="final-points">
            <span>
              <Check size={18} />
              Без обязательств
            </span>
            <span>
              <Check size={18} />
              2–5 наблюдений
            </span>
            <span>
              <Check size={18} />
              Понятный следующий шаг
            </span>
          </div>
        </div>
        <LeadForm />
      </div>
    </section>
  );
}
