import type { Metadata } from "next";
import { HomePageClient } from "@/components/modules/HomePageClient";

export const metadata: Metadata = {
    title: {
        absolute: "Protección Infantil — Reportes Comunitarios",
    },
    description:
        "Consulta identificadores de riesgo y reporta conductas sospechosas para proteger a menores en plataformas digitales.",
    alternates: {
        canonical: "/",
    },
    openGraph: {
        type: "website",
        url: "/",
        title: "Protección Infantil — Reportes Comunitarios",
        description:
            "Consulta identificadores de riesgo y reporta conductas sospechosas para proteger a menores en plataformas digitales.",
    },
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";

const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "WebSite",
            name: "Protección Infantil",
            url: appUrl,
            description:
                "Plataforma de reportes comunitarios para la protección de menores en entornos digitales.",
            inLanguage: "es-CO",
        },
        {
            "@type": "Organization",
            name: "Protección Infantil",
            url: appUrl,
            logo: `${appUrl}/icons/icon-192x192.png`,
            sameAs: [],
        },
    ],
};

export default function HomePage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
            />
            <HomePageClient />
        </>
    );
}
