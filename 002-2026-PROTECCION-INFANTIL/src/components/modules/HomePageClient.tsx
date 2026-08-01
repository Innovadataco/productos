"use client";

import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { LandingFooter } from "@/components/modules/LandingFooter";
import { ConsultaPublica } from "@/components/modules/ConsultaPublica";

/** Clave de sessionStorage para transportar el RPT sin exponerlo en la URL (spec 091-US2). */
export const RPT_STORAGE_KEY = "seguimiento.rpt";

export function HomePageClient() {
    return (
        <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
            {/* SPEC-129: el bloque de consulta vive en ConsultaPublica (compartido con el colegio) */}
            <ConsultaPublica />
            <CanalesOficiales />
            <LandingFooter />
        </main>
    );
}
