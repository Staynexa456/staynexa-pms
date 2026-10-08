// app/robots.ts
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/settings/",
          "/calendar/",
          "/reports/",
          "/payments/",
          "/guests/",
          "/housekeeping/",
          "/properties/",
        ],
      },
    ],
    sitemap: "https://staynexa.in/sitemap.xml",
  };
}
