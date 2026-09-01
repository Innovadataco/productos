"use client";

/**
 * SPEC-344 (A-69 · C1) — El armazón del camino guiado del colegio.
 *
 * Espejo temático del layout del padre (`src/app/camino/layout.tsx`):
 *   - Indicador «Paso N de 5» siempre visible.
 *   - Barra de progreso con pasos completados en pino.
 *   - Dos salidas: «Salir y seguir después» → /login, «Este no es mi correo»
 *     → /registro-colegio.
 *   - Móvil primero (390 px del mockup A-69 v3).
 *
 * Voz: usted formal Colombia (brief §0).
 */
import { usePathname, useRouter } from "next/navigation";
import {
    PASOS_COLEGIO,
    DEFINICION_PASOS_COLEGIO,
    TOTAL_PASOS_COLEGIO,
} from "@/lib/camino/pasos-colegio";
import { useAuth } from "@/lib/contexts/AuthContext";

function pasoActual(pathname: string | null): (typeof PASOS_COLEGIO)[number] | null {
    if (!pathname) return null;
    for (const paso of PASOS_COLEGIO) {
        const destino = DEFINICION_PASOS_COLEGIO[paso].destino;
        if (pathname === destino || pathname.startsWith(destino + "/")) return paso;
    }
    return null;
}

export default function CaminoColegioLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { logout } = useAuth();
    const paso = pasoActual(pathname);
    const definicion = paso ? DEFINICION_PASOS_COLEGIO[paso] : null;

    const salir = async (destino: string) => {
        await logout();
        router.push(destino);
    };

    return (
        <div className="theme-colegio min-h-screen bg-page">
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
                {definicion && (
                    <header className="mb-6">
                        <p className="text-sm font-medium text-muted">
                            Paso {definicion.numero} de {TOTAL_PASOS_COLEGIO} · {definicion.titulo}
                        </p>
                        <div className="mt-2 flex gap-1.5" aria-hidden="true">
                            {PASOS_COLEGIO.map((p) => (
                                <div
                                    key={p}
                                    className={`h-1.5 flex-1 rounded-full ${
                                        DEFINICION_PASOS_COLEGIO[p].numero <= definicion.numero
                                            ? "bg-pino"
                                            : "bg-tinta/10 dark:bg-papel/10"
                                    }`}
                                />
                            ))}
                        </div>
                    </header>
                )}

                <main className="flex-1">{children}</main>

                <footer className="mt-8 flex items-center justify-center gap-4 text-sm">
                    <button
                        type="button"
                        onClick={() => salir("/login")}
                        className="text-muted underline-offset-2 hover:underline"
                    >
                        Salir y seguir después
                    </button>
                    <span className="text-muted/50" aria-hidden="true">
                        ·
                    </span>
                    <button
                        type="button"
                        onClick={() => salir("/registro-colegio")}
                        className="text-muted underline-offset-2 hover:underline"
                    >
                        Este no es mi correo
                    </button>
                </footer>
            </div>
        </div>
    );
}
