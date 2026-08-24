import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-data";
export const dynamic = "force-static";

const routes = [
  "",
  "/marketing-i-privlechenie",
  "/sajt-crm-analitika",
  "/kommercheskaya-sistema",
  "/kak-rabotaem",
  "/kejsy-i-razbory",
  "/dlya-klinik",
  "/kontakty",
  "/soglasheniya",
];
export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route, index) => ({
    url: new URL(route || "/", SITE_URL).toString(),
    lastModified: new Date(),
    changeFrequency: index === 0 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : route === "/soglasheniya" ? 0.2 : 0.7,
  }));
}
