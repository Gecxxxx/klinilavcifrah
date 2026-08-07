import type { Metadata } from "next";
import { ServicePage } from "@/components/service-page";
import { servicePages } from "@/lib/site-data";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "Сайт, CRM и коммерческая аналитика",
  "Сайт, CRM, телефония и сквозная аналитика клиники в едином цифровом маршруте.",
  "/sajt-crm-analitika",
);
export default function Page() {
  const data = servicePages.digital;
  return (
    <>
      <ServicePage data={data} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbs([
              { name: "Главная", path: "/" },
              { name: data.title, path: data.slug },
            ]),
          ),
        }}
      />
    </>
  );
}
