import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Analytics } from "@/components/analytics";
import { SITE_NAME, SITE_URL } from "@/lib/site-data";
import { jsonLd } from "@/lib/seo";

const robotoCondensed = localFont({
  src: "../../public/fonts/RobotoCondensed-Variable.ttf",
  variable: "--font-condensed",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — внешний коммерческий контур для клиник`,
    template: `%s — ${SITE_NAME}`,
  },
  description:
    "Связываем маркетинг, сайт, обращения, запись, визиты, планы лечения и оплату в одну управляемую систему.",
  applicationName: SITE_NAME,
  robots: { index: true, follow: true },
};

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  description: "Внешний коммерческий контур для частных клиник.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={robotoCondensed.variable}>
      <body>
        <a className="skip-link" href="#main">
          Перейти к содержанию
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <Analytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organization) }}
        />
      </body>
    </html>
  );
}
