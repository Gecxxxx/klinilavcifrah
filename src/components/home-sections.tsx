"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, MotionConfig } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  Check,
  FirstAid,
  MagnifyingGlass,
  Stethoscope,
  UsersThree,
} from "@phosphor-icons/react";
import {
  faq,
  industries,
  patientJourney,
  problemCards,
  cases,
} from "@/lib/site-data";
import { reachGoal } from "./analytics";

export function ProblemsSection() {
  return (
    <section className="section problems-section" id="points-of-loss">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">Знакомая картина?</p>
          <h2>
            У бизнеса может быть всё необходимое — но не быть единой системы
          </h2>
        </div>
        <div className="problem-grid">
          {problemCards.map(([title, text], index) => (
            <article
              className={`problem-card problem-tone-${index + 1}`}
              key={title}
            >
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <p className="problem-conclusion">
          <Check size={22} weight="bold" />
          Мы соединяем эти элементы в один коммерческий контур.
        </p>
      </div>
    </section>
  );
}

export function JourneySection() {
  const [active, setActive] = useState(1);
  const previous = () =>
    setActive((current) =>
      current === 0 ? patientJourney.length - 1 : current - 1,
    );
  const next = () =>
    setActive((current) =>
      current === patientJourney.length - 1 ? 0 : current + 1,
    );
  return (
    <section className="section journey-section dark-section">
      <div className="container">
        <div className="section-heading light">
          <p className="eyebrow">Что берём под управление</p>
          <h2>От первого рекламного контакта до повторного пациента</h2>
          <p>Выберите этап, чтобы увидеть ключевые показатели контроля.</p>
        </div>
        <div className="journey-console">
          <div className="journey-map" role="list" aria-label="Этапы пути пациента">
            {patientJourney.map((stage, index) => (
              <button
                className={`journey-node ${active === index ? "active" : ""}`}
                onClick={() => {
                  setActive(index);
                  reachGoal("funnel_stage_open", { stage: stage.label });
                }}
                type="button"
                key={stage.label}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage.label}</strong>
              </button>
            ))}
          </div>
          <MotionConfig reducedMotion="user">
            <motion.div
              className="journey-focus"
              key={patientJourney[active].label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
            >
              <div className="journey-index">
                <span>Этап</span>
                <b>{String(active + 1).padStart(2, "0")}</b>
                <small>из {patientJourney.length}</small>
              </div>
              <div className="journey-focus-copy">
                <span>Под контролем</span>
                <h3>{patientJourney[active].label}</h3>
                <p>{patientJourney[active].kpi}</p>
              </div>
              <div className="journey-controls">
                <button type="button" onClick={previous} aria-label="Предыдущий этап">
                  <ArrowLeft size={20} />
                </button>
                <button type="button" onClick={next} aria-label="Следующий этап">
                  <ArrowRight size={20} />
                </button>
              </div>
            </motion.div>
          </MotionConfig>
        </div>
      </div>
    </section>
  );
}

export function KeepTeamSection() {
  return (
    <section className="section keep-team-section">
      <div className="container keep-team-grid">
        <div>
          <p className="eyebrow">Не обязательно менять то, что работает</p>
          <h2>Не начинаем с увольнения сотрудников и замены подрядчиков</h2>
        </div>
        <div className="keep-team-copy">
          <UsersThree size={48} weight="duotone" />
          <p>
            <strong>
              Если сильный сотрудник, агентство, разработчик или другой
              подрядчик уже даёт результат, задача не в том, чтобы заменить его
              нашей командой.
            </strong>
          </p>
          <p>
            Сначала определяем общую коммерческую цель, данные, показатели и
            зоны ответственности. Действующие специалисты могут продолжить
            работу внутри единой системы.
          </p>
        </div>
      </div>
    </section>
  );
}

export function CasesPreview() {
  return (
    <section className="section cases-section">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">Разборы и проекты</p>
          <h2>Разбираем систему по этапам, а не по ощущениям</h2>
          <p>
            Каждый материал строится по одной логике: что анализировалось, что
            выявлено, что рекомендовано и на каком этапе находится работа.
          </p>
        </div>
        <div className="case-grid">
          {cases.map((item) => (
            <article className="case-card" key={item.type}>
              <span>{item.type}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <small>{item.status}</small>
            </article>
          ))}
        </div>
        <Link className="text-link" href="/kejsy-i-razbory">
          Все разборы <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}

export function IndustriesPreview() {
  const icons = [Stethoscope, FirstAid, MagnifyingGlass];
  return (
    <section className="section soft-section">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">Основная специализация</p>
          <h2>Частные клиники с длинным путём пациента</h2>
        </div>
        <div className="industry-preview-grid">
          {industries.map((item, index) => {
            const Icon = icons[index];
            return (
              <Link
                className="industry-preview-card"
                href={`/dlya-klinik#${item.id}`}
                key={item.id}
              >
                <Icon size={36} weight="duotone" />
                <h3>{item.title}</h3>
                <p>{item.journey}</p>
                <span>
                  Что берём под управление <ArrowRight size={17} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  const [open, setOpen] = useState(0);
  return (
    <section className="section faq-section">
      <div className="container faq-layout">
        <div className="section-heading">
          <p className="eyebrow">FAQ</p>
          <h2>Вопросы до начала работы</h2>
          <p>Коротко о формате, данных, команде и начале сотрудничества.</p>
        </div>
        <div className="faq-list">
          {faq.map(([question, answer], index) => (
            <article className={open === index ? "open" : ""} key={question}>
              <button
                type="button"
                onClick={() => {
                  setOpen(open === index ? -1 : index);
                  reachGoal("faq_open", { question });
                }}
                aria-expanded={open === index}
              >
                <span>{question}</span>
                <CaretDown size={20} />
              </button>
              <div className="faq-answer">
                <p>{answer}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
