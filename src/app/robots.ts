import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.CRM_BASE_URL || "https://mycrm.solar";
  return {
    rules: {
      userAgent: "*",
      disallow: ["/api/", "/dashboard", "/clients", "/planning", "/reglages", "/telepros"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
