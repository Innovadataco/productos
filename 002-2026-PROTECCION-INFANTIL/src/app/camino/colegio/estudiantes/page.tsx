/**
 * SPEC-344 (A-69 · C1) · corregido por SPEC-355 (ítems 4/5) — Paso 5 · Estudiantes.
 *
 * El paso cierra cuando el colegio tiene ≥ 1 estudiante activo. Ofrece dos
 * caminos: agregar uno a la vez desde la ficha del curso, o cargar una lista
 * completa con el wizard unificado existente (`/dashboard/colegio/cursos/
 * unificado`).
 *
 * SPEC-355: la versión original era un client component que consultaba
 * `GET /api/colegio/alumnos` — endpoint listable que NUNCA existió (404 en
 * vivo) y encima pintaba "Tiene  estudiantes activos" con el conteo caído.
 * Ahora es un server component: el conteo sale del DAL en el mismo render
 * (cero fetch, cero estado contradictorio), patrón del paso Plan.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { derivarPasoPendienteColegio } from "@/lib/dal/services/camino/estado-colegio";
import { EstudianteRepository } from "@/lib/dal/repositories/estudiante";
import { DESTINO_CIERRE_COLEGIO, destinoDePasoColegio } from "@/lib/camino/pasos-colegio";
import { GlassCard } from "@/components/ui/GlassCard";

export const dynamic = "force-dynamic";

export default async function PasoEstudiantesColegio() {
    const usuario = await verifyAuth("SCHOOL_ADMIN");

    // Doble valla: derivación autoritativa además del guardián (patrón del paso Plan).
    const paso = await derivarPasoPendienteColegio(usuario.id);
    if (paso === null) redirect(DESTINO_CIERRE_COLEGIO);
    if (paso !== "estudiantes") redirect(destinoDePasoColegio(paso));

    const totalActivos = usuario.colegioId
        ? await new EstudianteRepository().contarActivos(usuario.colegioId)
        : 0;
    const listo = totalActivos > 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-serif text-2xl text-body">A quién estamos cuidando.</h1>
                <p className="mt-2 text-sm text-muted">
                    Agregue al menos un estudiante para terminar. Puede sumar uno a la vez o cargar
                    la lista completa desde Excel.
                </p>
            </div>

            <GlassCard>
                <p className="text-sm text-body">
                    Tiene <strong>{totalActivos}</strong> estudiante{totalActivos === 1 ? "" : "s"} activo
                    {totalActivos === 1 ? "" : "s"}.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Link
                        href="/dashboard/colegio/cursos/unificado"
                        className="rounded-md bg-pino px-3 py-1.5 text-center text-sm font-medium text-white"
                    >
                        Cargar lista desde Excel
                    </Link>
                    <Link
                        href="/dashboard/colegio/cursos"
                        className="rounded-md border border-pino px-3 py-1.5 text-center text-sm font-medium text-pino"
                    >
                        Agregar uno a uno
                    </Link>
                </div>
                <p className="mt-3 text-xs text-muted">
                    El acudiente puede llevar tipo y número de documento (opcional). Sus cuentas también se vigilan:
                    los agresores muchas veces llegan por ahí.
                </p>
            </GlassCard>

            {listo ? (
                <Link
                    href="/camino/colegio/listo"
                    className="block w-full rounded-md bg-pino px-3 py-2 text-center text-sm font-medium text-white"
                >
                    Terminar
                </Link>
            ) : (
                <p className="w-full rounded-md border border-tinta/15 px-3 py-2 text-center text-sm text-muted">
                    Agregue su primer estudiante para terminar.
                </p>
            )}

            {/* SPEC-442 (I-307 · Jelkin vivo 04-09): «siempre hay salida» —
                botón atrás en todos los pasos. `Link` funciona bajo server
                component; no necesita client boundary. */}
            <Link
                href="/camino/colegio/cursos"
                className="block w-full rounded-md border border-tinta/20 px-3 py-2 text-center text-sm font-medium text-muted hover:border-pino hover:text-pino"
            >
                Atrás
            </Link>
        </div>
    );
}
