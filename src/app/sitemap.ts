import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-data";

const routes = [
  "",
  "/chto-my-delaem",
  "/marketing-i-privlechenie",
  "/sajt-crm-analitika",
  "/kommercheskaya-sistema",
  "/kak-rabotaem",
  "/komanda",
  "/kejsy-i-razbory",
  "/dlya-klinik",
  "/o-kompanii",
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
