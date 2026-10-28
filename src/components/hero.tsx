import Link from "next/link";
import type { CSSProperties } from "react";
import { preload } from "react-dom";
import {
  ArrowRight,
  ArrowsClockwise,
  CalendarCheck,
  ChatCircleDots,
  Check,
  ClipboardText,
  Clock,
  CreditCard,
  Heartbeat,
  Megaphone,
  PaperPlaneTilt,
  Plus,
  Sparkle,
  Stethoscope,
  User,
} from "@phosphor-icons/react/dist/ssr";
import { heroStages } from "@/lib/site-data";

const iconMap = {
  megaphone: { icon: Megaphone, detail: Sparkle },
  chat: { icon: ChatCircleDots, detail: PaperPlaneTilt },
  calendar: { icon: CalendarCheck, detail: Check },
  visit: { icon: Stethoscope, detail: User },
  clipboard: { icon: ClipboardText, detail: Check },
  treatment: { icon: Heartbeat, detail: Plus },
  card: { icon: CreditCard, detail: Check },
  return: { icon: ArrowsClockwise, detail: Clock },
};

export function Hero() {
  preload("/assets/hero-data-stream.webp", {
    as: "image",
    fetchPriority: "high",
  });
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
              data-lead-cta="hero"
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
        <ol className="hero-chain" aria-label="Путь пациента">
          {heroStages.map((stage, index) => {
            const { icon: Icon, detail: Detail } =
              iconMap[stage.icon as keyof typeof iconMap];
            return (
              <li
                className={`hero-stage stage-${index + 1} tone-${stage.tone}`}
                key={stage.label}
                style={
                  {
                    animationDelay: `${index * 50}ms`,
                    "--stage-highlight-delay": `${index * 1600}ms`,
                  } as CSSProperties
                }
              >
                <div className="stage-card">
                  <span
                    className={`stage-icon stage-icon-${stage.icon}`}
                    aria-hidden="true"
                  >
                    <Icon className="stage-icon-main" size={36} weight="duotone" />
                    <span className="stage-icon-detail">
                      <Detail size={12} weight="bold" />
                    </span>
                  </span>
                  <strong>{stage.label}</strong>
                </div>
                {index < heroStages.length - 1 && (
                  <ArrowRight
                    className="stage-arrow"
                    size={18}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
