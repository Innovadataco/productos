import type { Metadata } from "next";
import { ConsultaPublicaClient } from "@/components/modules/ConsultaPublicaClient";

export const metadata: Metadata = {
    title: "Consulta pública — Protección Infantil",
    description:
        "Consulta de forma anónima si un número, nick o usuario ha sido reportado en la comunidad de Protección Infantil.",
    alternates: {
        canonical: "/consulta",
    },
    openGraph: {
        type: "website",
        url: "/consulta",
        title: "Consulta pública — Protección Infantil",
        description:
            "Consulta si un número, nick o usuario tiene reportes registrados. Información agregada y sin datos personales.",
    },
};

export default function ConsultaPage() {
    return <ConsultaPublicaClient />;
}
