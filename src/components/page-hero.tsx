import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { breadcrumbs, jsonLd } from "@/lib/seo";

export function PageHero({
  eyebrow,
  title,
  lead,
  actions = true,
  path,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  actions?: boolean;
  path?: string;
}) {
  return (
    <>
      <section className="page-hero dark-section">
        <div className="page-hero-stream" aria-hidden="true" />
        <div className="container page-hero-inner">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{lead}</p>
          {actions && (
            <div className="hero-actions">
              <Link className="button button-primary" href="/kontakty#forma">
                Получить разбор
              </Link>
              <Link className="text-link light" href="/kak-rabotaem">
                Как начинаем <ArrowRight size={18} />
              </Link>
            </div>
          )}
        </div>
      </section>
      {path && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              breadcrumbs([
                { name: "Главная", path: "/" },
                { name: title, path },
              ]),
            ),
          }}
        />
      )}
    </>
  );
}
