import type { Metadata } from "next";
import { ServicePage } from "@/components/service-page";
import { servicePages } from "@/lib/site-data";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "Управление коммерческой системой клиники",
  "Коммерческая диагностика, обработка обращений, пациентская база и единые KPI.",
  "/kommercheskaya-sistema",
);
export default function Page() {
  const data = servicePages.system;
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
