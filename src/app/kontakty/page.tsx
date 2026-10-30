import type { Metadata } from "next";
import { Check, TelegramLogo, WhatsappLogo, ChatCircleDots } from "@phosphor-icons/react/dist/ssr";
import { PageHero } from "@/components/page-hero";
import { LeadForm } from "@/components/lead-form";
import { pageMetadata } from "@/lib/seo";
import { catalogServices } from "@/lib/service-catalog";

export const metadata: Metadata = pageMetadata(
  "Контакты",
  "Получить предварительный разбор коммерческой системы клиники.",
  "/kontakty",
);
export default function Page() {
  return (
    <>
      <PageHero
        path="/kontakty"
        eyebrow="Первый шаг без обязательств"
        title="Взаимодействовать с нами"
        lead="Расскажите о вашей клинике и коммерческой задаче. Мы уточним вводные данные и предложим подходящий следующий шаг."
        actions={false}
      >
        <div className="contact-hero-messengers" aria-label="Связаться в мессенджере">
          <a className="messenger-button messenger-telegram" href="https://t.me/+79690070865" target="_blank" rel="noopener noreferrer">
            <TelegramLogo size={26} weight="fill" aria-hidden="true" />
            Telegram<span className="visually-hidden"> (откроется в новой вкладке)</span>
          </a>
          <a className="messenger-button messenger-whatsapp" href="https://wa.me/79690070865" target="_blank" rel="noopener noreferrer">
            <WhatsappLogo size={26} weight="fill" aria-hidden="true" />
            WhatsApp<span className="visually-hidden"> (откроется в новой вкладке)</span>
          </a>
          <details className="messenger-max-details">
            <summary className="messenger-button messenger-max" aria-label="MAX — найти нас по номеру" data-contact-channel="max">
              <ChatCircleDots size={26} weight="fill" aria-hidden="true" />MAX
            </summary>
            <div className="messenger-max-help">
              В MAX откройте «Контакты» → «Найти по номеру» и введите <strong>+7 969 007-08-65</strong>.
            </div>
          </details>
        </div>
      </PageHero>
      <section className="section contact-section" id="forma">
        <div className="container contact-grid">
          <div>
            <p className="eyebrow">Что произойдёт дальше</p>
            <h2>Предварительный разбор</h2>
            {[
              "Изучим сайт и открытые данные",
              "Сформулируем 2–5 наблюдений",
              "Свяжемся для уточнения задачи",
              "Определим безопасный следующий шаг",
            ].map((x) => (
              <p className="check-line" key={x}>
                <Check size={18} weight="bold" />
                {x}
              </p>
            ))}
            <div className="contact-direct">
              <h3>Связаться напрямую</h3>
              <a href="tel:+79690070865">+7 (969) 007-08-65</a>
              <a href="mailto:revenue@klinikavcifrah.ru">revenue@klinikavcifrah.ru</a>
            </div>
            <p className="contact-note">
              В форме можно оставить телефон, email или Telegram-контакт.
              Опишите коммерческую задачу без сведений о пациентах.
            </p>
          </div>
          <LeadForm serviceOptions={catalogServices.map(({ id, title }) => ({ id, title }))} />
        </div>
      </section>
    </>
  );
}
