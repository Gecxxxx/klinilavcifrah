"use client";

import Link from "next/link";
import { motion, MotionConfig } from "motion/react";
import {
  Armchair,
  ArrowRight,
  Browser,
  CalendarBlank,
  ChatCircle,
  ClipboardText,
  CreditCard,
  Megaphone,
  UserCircle,
} from "@phosphor-icons/react";
import { heroStages } from "@/lib/site-data";
import { reachGoal } from "./analytics";

const iconMap = {
  browser: Browser,
  megaphone: Megaphone,
  chat: ChatCircle,
  calendar: CalendarBlank,
  chair: Armchair,
  clipboard: ClipboardText,
  card: CreditCard,
  user: UserCircle,
};

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-background" aria-hidden="true" />
      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">От пациентопотока до прибыли</p>
          <h1>Внешнее коммерческое управление частными клиниками</h1>
          <p className="hero-lead">
            Выявляем коммерческие ограничения, определяем приоритеты и
            организуем управление обращениями, записью, началом лечения,
            повторными визитами, загрузкой врачей и экономикой клиники.
          </p>
          <div className="hero-actions">
            <Link
              className="button button-primary"
              href="/kontakty#forma"
              onClick={() => reachGoal("cta_click", { location: "hero" })}
            >
              Получить предварительный разбор
            </Link>
            <Link className="button button-ghost" href="/kak-rabotaem">
              Как мы работаем
            </Link>
          </div>
          <p className="hero-note">
            Первичная оценка по открытым данным. Без обязательств на дальнейшее
            сотрудничество.
          </p>
        </div>
        <MotionConfig reducedMotion="user">
          <ol className="hero-chain" aria-label="Путь пациента">
            {heroStages.map((stage, index) => {
              const Icon = iconMap[stage.icon as keyof typeof iconMap];
              return (
                <motion.li
                  className={`hero-stage stage-${index + 1} tone-${stage.tone}`}
                  key={stage.label}
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 + index * 0.07, duration: 0.42 }}
                >
                  <div className="stage-card">
                    <Icon size={34} weight="duotone" aria-hidden="true" />
                    <strong>{stage.label}</strong>
                  </div>
                  {index < heroStages.length - 1 && (
                    <ArrowRight
                      className="stage-arrow"
                      size={18}
                      aria-hidden="true"
                    />
                  )}
                </motion.li>
              );
            })}
          </ol>
        </MotionConfig>
      </div>
    </section>
  );
}
