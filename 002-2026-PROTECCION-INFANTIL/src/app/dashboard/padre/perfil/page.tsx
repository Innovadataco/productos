import type { Metadata } from "next";
import { verifyAuth } from "@/lib/auth";
import { PerfilPadreForm } from "@/components/modules/padre/PerfilPadreForm";

export const metadata: Metadata = {
    title: "Mi perfil",
    description: "Tus datos de contacto.",
};

// SPEC-334: pantalla real del perfil del padre (reemplaza el placeholder).
export default async function PadrePerfilPage() {
    await verifyAuth("PARENT");
    return (
        <main className="min-h-screen bg-page px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-body">Mi perfil</h1>
                    <p className="mt-1 text-sm text-muted">Completa tus datos. Puedes editarlos cuando quieras.</p>
                </div>
                <PerfilPadreForm />
            </div>
        </main>
    );
}
