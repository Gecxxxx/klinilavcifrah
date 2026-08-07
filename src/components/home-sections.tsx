"use client";

import Link from "next/link";
import { useState } from "react";
import {
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
            <article className="problem-card" key={title}>
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
  return (
    <section className="section journey-section dark-section">
      <div className="container">
        <div className="section-heading light">
          <p className="eyebrow">Что берём под управление</p>
          <h2>От первого рекламного контакта до повторного пациента</h2>
          <p>Выберите этап, чтобы увидеть ключевые показатели контроля.</p>
        </div>
        <div className="journey-layout">
          <div className="journey-list" role="list">
            {patientJourney.map((stage, index) => (
              <button
                className={active === index ? "active" : ""}
                onClick={() => {
                  setActive(index);
                  reachGoal("funnel_stage_open", { stage: stage.label });
                }}
                type="button"
                key={stage.label}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {stage.label}
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
          <div className="journey-detail">
            <span>Контроль этапа</span>
            <h3>{patientJourney[active].label}</h3>
            <p>{patientJourney[active].kpi}</p>
            <div className="journey-signal">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
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
          <h2>Показываем только то, что можно подтвердить</h2>
          <p>
            Структура раздела готова. Результаты и цифры появятся после
            согласования с клиентами.
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
          <p>Без сложных тарифов и обещаний до изучения данных.</p>
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
