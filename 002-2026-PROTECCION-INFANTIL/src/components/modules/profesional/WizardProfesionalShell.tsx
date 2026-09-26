"use client";

/**
 * SPEC-740 (bug de Jelkin) — El armazón del asistente de registro del profesional.
 *
 * ESPEJO VISUAL FIEL del `/camino` del padre (`src/app/camino/layout.tsx`): mismo
 * indicador «Paso N de 3», misma barra de progreso segmentada, mismos botones
 * Siguiente/Atrás y la salida sin encierro. NO comparte el shell del padre (que está
 * acoplado a cookie/middleware/rol) — es un análogo, como el del colegio. La voz es la
 * de cada rol: el profesional habla de **usted** (el padre, tú). La fidelidad es VISUAL
 * y ESTRUCTURAL (FORMA-SPEC740 §3), no de copy.
 *
 * El «Siguiente» (guardar-por-paso) vive en cada PANTALLA (el paso sabe qué persistir);
 * este shell pone el marco: Atrás (pasos 2-3, solo navega), indicador, progreso y salida.
 * Móvil primero (columna max-w-md), como el mockup del padre.
 */
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
    PASOS_PROFESIONAL,
    DEFINICION_PASOS_PROFESIONAL,
    TOTAL_PASOS_PROFESIONAL,
    pasoDeRuta,
    pasoAnteriorProfesional,
    destinoDePasoProfesional,
} from "@/lib/camino/pasos-profesional";

export function WizardProfesionalShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { logout } = useAuth();
    const paso = pasoDeRuta(pathname);
    const definicion = paso ? DEFINICION_PASOS_PROFESIONAL[paso] : null;
    const anterior = paso ? pasoAnteriorProfesional(paso) : null;

    // Ruta fuera del asistente (defensivo): sin marco, deja pasar.
    if (!definicion) return <>{children}</>;

    const salir = async () => {
        await logout();
        router.push("/login");
    };

    return (
        <div className="theme-profesional min-h-screen bg-page">
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
                <header className="mb-6">
                    {/* SPEC-740: «Atrás» en pasos 2 y 3 — solo NAVEGA (el borrador ya se guardó al
                        avanzar; volver no pierde nada, como el candado camino-atras del padre). */}
                    {anterior && (
                        <button
                            type="button"
                            onClick={() => router.push(destinoDePasoProfesional(anterior))}
                            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted underline-offset-2 transition hover:text-body hover:underline"
                        >
                            <span aria-hidden="true">←</span> Atrás
                        </button>
                    )}
                    <p className="text-sm font-medium text-muted">
                        Paso {definicion.numero} de {TOTAL_PASOS_PROFESIONAL} · {definicion.titulo}
                    </p>
                    {/* Barra de progreso: pasos completados en pino, resto en papel (idéntico al padre). */}
                    <div className="mt-2 flex gap-1.5" aria-hidden="true">
                        {PASOS_PROFESIONAL.map((p) => (
                            <div
                                key={p}
                                className={`h-1.5 flex-1 rounded-full ${
                                    DEFINICION_PASOS_PROFESIONAL[p].numero <= definicion.numero
                                        ? "bg-pino"
                                        : "bg-tinta/10 dark:bg-papel/10"
                                }`}
                            />
                        ))}
                    </div>
                </header>

                <main className="flex-1">{children}</main>

                {/* Salida sin encierro — como en el /camino del padre (FORMA §3g). */}
                <footer className="mt-8 flex items-center justify-center gap-4 text-sm">
                    <button
                        type="button"
                        onClick={salir}
                        className="text-muted underline-offset-2 hover:underline"
                    >
                        Salir y seguir después
                    </button>
                </footer>
            </div>
        </div>
    );
}
