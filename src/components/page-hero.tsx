import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { breadcrumbs, jsonLd } from "@/lib/seo";

export function PageHero({
  eyebrow,
  title,
  lead,
  actions = true,
  path,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  actions?: boolean;
  path?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <section className="page-hero dark-section">
        <div className="page-hero-stream" aria-hidden="true" />
        <div className="container page-hero-inner">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{lead}</p>
          {children}
          {actions && (
            <div className="hero-actions">
              <Link
                className="button button-primary"
                data-lead-cta="page_hero"
                href="/kontakty#forma"
              >
                Получить разбор
              </Link>
              <Link
                className="text-link light"
                href={
                  path === "/kak-rabotaem" ? "#etapy" : "/kak-rabotaem#etapy"
                }
              >
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
