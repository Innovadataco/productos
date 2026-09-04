"use client";

/**
 * SPEC-339 (A-67) — El armazón del camino guiado del padre.
 *
 * Una sola cosa por pantalla, el indicador «Paso N de 4» siempre visible, y las
 * dos salidas que NUNCA pueden faltar (decisión CEO · precedentes I-25/I-35,
 * que fueron de rutas — este sería de pantalla y duele igual):
 *   - «Salir»: cierra la sesión.
 *   - «Este no es mi correo»: sale y vuelve a la puerta.
 *
 * Móvil primero: el mockup aprobado está a 390 px. El contenido es una columna
 * de ancho máximo md, sin desbordes.
 *
 * Respeta prefers-reduced-motion: la única animación (fadeIn) la desactiva la
 * media query global; acá no se agrega movimiento.
 */
import { usePathname, useRouter } from "next/navigation";
import { PASOS_CAMINO, DEFINICION_PASOS, TOTAL_PASOS } from "@/lib/camino/pasos";
import { useAuth } from "@/lib/contexts/AuthContext";

function pasoActual(pathname: string | null): (typeof PASOS_CAMINO)[number] | null {
    if (!pathname) return null;
    for (const paso of PASOS_CAMINO) {
        const destino = DEFINICION_PASOS[paso].destino;
        if (pathname === destino || pathname.startsWith(destino + "/")) return paso;
    }
    return null;
}

export default function CaminoLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { logout } = useAuth();
    const paso = pasoActual(pathname);
    const definicion = paso ? DEFINICION_PASOS[paso] : null;

    // SPEC-442 (I-307 · Jelkin vivo 04-09): el flujo del colegio tiene su
    // propio layout anidado con header + footer. Si este layout padre pinta
    // TAMBIÉN el header y el footer, el rector ve el par «Salir · Este no es
    // mi correo» DOS VECES. Cuando el pathname es del colegio, el padre se
    // reduce a shell mínimo (el hijo pinta todo lo visual).
    const esColegio = pathname?.startsWith("/camino/colegio") ?? false;

    const salir = async (destino: string) => {
        await logout();
        router.push(destino);
    };

    if (esColegio) {
        // El hijo `/camino/colegio/layout.tsx` es la fuente única del chrome
        // (header, ancho, footer). Devolvemos los children sin envolver.
        return <>{children}</>;
    }

    return (
        <div className="theme-padre min-h-screen bg-page">
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
                {definicion && (
                    <header className="mb-6">
                        <p className="text-sm font-medium text-muted">
                            Paso {definicion.numero} de {TOTAL_PASOS} · {definicion.titulo}
                        </p>
                        {/* Barra de progreso: pasos completados en pino, resto en papel. */}
                        <div className="mt-2 flex gap-1.5" aria-hidden="true">
                            {PASOS_CAMINO.map((p) => (
                                <div
                                    key={p}
                                    className={`h-1.5 flex-1 rounded-full ${
                                        DEFINICION_PASOS[p].numero <= definicion.numero
                                            ? "bg-pino"
                                            : "bg-tinta/10 dark:bg-papel/10"
                                    }`}
                                />
                            ))}
                        </div>
                    </header>
                )}

                <main className="flex-1">{children}</main>

                {/* Las dos salidas — nunca un padre atrapado en pantalla. */}
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
                        onClick={() => salir("/registro")}
                        className="text-muted underline-offset-2 hover:underline"
                    >
                        Este no es mi correo
                    </button>
                </footer>
            </div>
        </div>
    );
}
