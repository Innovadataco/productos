import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";

export default function robots(): MetadataRoute.Robots {
    return {
        sitemap: `${appUrl}/sitemap.xml`,
        rules: [
            {
                userAgent: "*",
                allow: ["/", "/reportar", "/seguimiento", "/terminos", "/privacidad", "/dashboard-publico"],
                disallow: ["/dashboard", "/api", "/login", "/registro", "/recuperar", "/offline"],
            },
        ],
    };
}
