import type { Metadata } from "next";
import { verifyAuth } from "@/lib/auth";
import { obtenerHomePadre } from "@/lib/padre/home";
import { HomePadreDashboard } from "@/components/modules/padre/HomePadreDashboard";

export const metadata: Metadata = {
    title: "Inicio",
    description: "Resumen proactivo de tu Círculo de Confianza.",
};

export default async function PadreInicioPage() {
    const usuario = await verifyAuth("PARENT");
    const data = await obtenerHomePadre(usuario.id, usuario.nombre ?? null);

    return (
        <main className="min-h-screen bg-page py-4">
            <HomePadreDashboard data={data} />
        </main>
    );
}
