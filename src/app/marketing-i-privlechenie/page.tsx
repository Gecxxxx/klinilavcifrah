import type { Metadata } from "next";
import { ServicePage } from "@/components/service-page";
import { servicePages } from "@/lib/site-data";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "Маркетинговая стратегия и привлечение",
  "Маркетинг клиники, связанный с качественными обращениями, визитами и оплатами.",
  "/marketing-i-privlechenie",
);
export default function Page() {
  const data = servicePages.marketing;
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
