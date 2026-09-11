import type { Metadata } from "next";
import { Suspense } from "react";
import { verifyAuth } from "@/lib/auth";
import { obtenerHomePadre } from "@/lib/padre/home";
import { HomePadreDashboard } from "@/components/modules/padre/HomePadreDashboard";
import { AvisoRolDesdeGoogle } from "@/components/modules/padre/AvisoRolDesdeGoogle";

export const metadata: Metadata = {
    title: "Inicio",
    description: "Resumen proactivo de tu Círculo de Confianza.",
};

export default async function PadreInicioPage() {
    const usuario = await verifyAuth("PARENT");
    const data = await obtenerHomePadre(usuario.id, usuario.nombre ?? null);

    return (
        <main className="min-h-screen bg-page py-4">
            {/* SPEC-631 §3: aviso «de una vez» cuando el correo de Google ya era familia (useSearchParams
                → Suspense). Solo aparece con ?aviso=cuenta-familia; es descartable y no bloquea. */}
            <Suspense fallback={null}>
                <AvisoRolDesdeGoogle />
            </Suspense>
            <HomePadreDashboard data={data} />
        </main>
    );
}
