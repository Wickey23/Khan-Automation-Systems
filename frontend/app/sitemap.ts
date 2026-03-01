import type { MetadataRoute } from "next";
import { caseStudies } from "@/lib/case-studies";
import { siteConfig } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    "/how-it-works",
    "/pricing",
    "/case-studies",
    "/book",
    "/contact",
    "/resources/ai-reception-checklist",
    "/privacy",
    "/terms",
    "/login",
    "/signup",
    "/admin/login"
  ];

  return [
    ...routes.map((route) => ({
      url: `${siteConfig.url}${route}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const
    })),
    ...caseStudies.map((item) => ({
      url: `${siteConfig.url}/case-studies/${item.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const
    }))
  ];
}
