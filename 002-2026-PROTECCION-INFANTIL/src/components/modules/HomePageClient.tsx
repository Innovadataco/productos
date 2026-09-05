"use client";

import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { LandingFooter } from "@/components/modules/LandingFooter";
import { ConsultaPublica } from "@/components/modules/ConsultaPublica";

/** Clave de sessionStorage para transportar el RPT sin exponerlo en la URL (spec 091-US2). */
export const RPT_STORAGE_KEY = "seguimiento.rpt";

export function HomePageClient() {
    return (
        <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
            {/* SPEC-456 (P-5): los canales oficiales (141, ICBF…) son la prueba de
                seriedad más fuerte del producto y estaban ENTERRADOS antes del pie —
                en un celular quedaban pasado el 70% de la página. Suben al tope para
                que un padre asustado los vea SIN hacer scroll (aceptación §4.3:
                «mover arriba»). El hero+consulta quedan debajo. */}
            <CanalesOficiales />
            {/* SPEC-129: el bloque de consulta vive en ConsultaPublica (compartido con el colegio) */}
            <ConsultaPublica />
            <LandingFooter />
        </main>
    );
}
