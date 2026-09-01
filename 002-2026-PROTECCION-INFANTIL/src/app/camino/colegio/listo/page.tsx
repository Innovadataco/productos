/**
 * SPEC-344 (A-69 · C1) — Pantalla de cierre del camino del colegio.
 *
 * Al llegar acá el camino se completó (los 5 pasos cumplieron). Server-side
 * re-deriva el paso pendiente y devuelve al usuario al paso pendiente si algo
 * cambió mientras estaba en camino (por ejemplo, inactivó su único estudiante):
 * el camino se sostiene, no se gana.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyAuth } from "@/lib/auth";
import { derivarPasoPendienteColegio } from "@/lib/dal/services/camino/estado-colegio";
import { destinoDePasoColegio } from "@/lib/camino/pasos-colegio";

// La página depende de la sesión: nunca se pre-renderiza estática.
export const dynamic = "force-dynamic";

export default async function CaminoColegioListoPage() {
    const usuario = await verifyAuth();
    if (usuario.rol !== "SCHOOL_ADMIN") redirect("/dashboard");
    const paso = await derivarPasoPendienteColegio(usuario.id);
    if (paso) redirect(destinoDePasoColegio(paso));

    return (
        <div className="space-y-6 text-center">
            <div>
                <h1 className="font-serif text-3xl text-body">Su colegio está protegido</h1>
                <p className="mt-2 text-sm text-muted">
                    Ya tenemos a sus profesores, cursos y estudiantes. Desde ahora le avisamos si algo aparece.
                </p>
            </div>
            <div className="flex flex-col gap-3">
                <Link href="/dashboard/colegio" className="rounded-md bg-pino px-4 py-2 text-white font-medium">
                    Entrar al panel
                </Link>
                <Link href="/dashboard/colegio/tablero" className="text-sm font-medium text-accent hover:underline">
                    Ver el puesto de mando
                </Link>
            </div>
        </div>
    );
}
