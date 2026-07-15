import { Suspense } from "react";
import { SeguimientoClient } from "@/components/modules/SeguimientoClient";

export default function SeguimientoPage() {
    return (
        <Suspense
            fallback={
                <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
                    <div className="glass rounded-2xl p-8 text-center">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                        <p className="mt-3 text-sm text-slate-500">Cargando...</p>
                    </div>
                </main>
            }
        >
            <SeguimientoClient />
        </Suspense>
    );
}
