import type { Metadata } from "next";
import { PadreLogoutButton } from "@/components/modules/PadreLogoutButton";

export const metadata: Metadata = {
    title: "Suscripción",
    description: "Gestiona tu suscripción de Protección Infantil.",
};

/**
 * Placeholder de /dashboard/padre/suscripcion.
 * SPEC-242 (002-PI-145): página exenta de la guarda de vigencia.
 * El diseño completo del selector de planes llega en SPEC-244 (Lote 2).
 */
export default function PadreSuscripcionPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl glass p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-500 text-white text-2xl font-bold">
                    🛡️
                </div>
                <h1 className="text-2xl font-bold text-body">Tu suscripción</h1>
                <p className="mt-4 text-muted">
                    Aquí podrás elegir o renovar tu plan. Esta funcionalidad estará disponible próximamente.
                </p>
                <div className="mt-6 flex justify-center">
                    <PadreLogoutButton className="inline-flex rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 transition" />
                </div>
            </div>
        </main>
    );
}
