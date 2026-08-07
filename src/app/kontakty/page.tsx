import type { Metadata } from "next";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { PageHero } from "@/components/page-hero";
import { LeadForm } from "@/components/lead-form";
import { pageMetadata } from "@/lib/seo";

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
        title="Обсудить коммерческую задачу"
        lead="Изучим открытые данные, уточним задачу и определим возможную точку резерва — без требования сразу заключать большой договор."
        actions={false}
      />
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
            <p className="contact-note">
              Прямые контакты и реквизиты будут добавлены после подтверждения
              заказчиком. Мы не выдумываем отсутствующие данные.
            </p>
          </div>
          <LeadForm />
        </div>
      </section>
    </>
  );
}
