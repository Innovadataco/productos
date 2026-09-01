/**
 * SPEC-339 (A-67 §2.6) — El cierre: «Listo. Ya cuidas a Juan David.»
 *
 * Nombra al menor (el primero activo), ofrece los dos accesos que siguen y el
 * botón al panel. Nunca un callejón sin salida.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";
import { derivarPasoPendiente } from "@/lib/dal/services/camino/estado";
import { listarHijos } from "@/lib/dal/services/hijos";
import { destinoDePaso } from "@/lib/camino/pasos";
import { Button } from "@/components/ui/Button";

// La página depende de la sesión: nunca se pre-renderiza estática.
export const dynamic = "force-dynamic";

export default async function CaminoListoPage() {
    const usuario = await verifyAuth("PARENT");

    // El cierre solo existe con el camino terminado; si falta un paso, a él.
    const paso = await derivarPasoPendiente(usuario.id);
    if (paso !== null) redirect(destinoDePaso(paso));

    const hijos = await listarHijos(usuario.id);
    const activos = hijos.filter((h) => h.estado === "activo");
    const nombres = activos.map((h) => h.nombre.split(" ")[0]);
    const quienes =
        nombres.length === 1
            ? nombres[0]
            : nombres.length === 2
                ? `${nombres[0]} y ${nombres[1]}`
                : `${nombres[0]} y ${nombres.length - 1} más`;

    return (
        <div className="animate-fadeIn text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-pino">Listo.</p>
            <h1 className="mt-1 font-serif text-3xl text-body">Ya cuidas a {quienes}</h1>
            <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
                Desde ahora, si alguna de sus cuentas aparece en un reporte, te avisamos. Sin
                alarmas: solo lo que necesitas saber, cuando lo necesitas saber.
            </p>

            <div className="mt-8 space-y-3">
                <Link href="/dashboard/padre/circulo-confianza" className="block">
                    <Button variant="secondary" className="w-full">
                        Suma a tu círculo de confianza
                    </Button>
                </Link>
                <Link href="/dashboard/padre/notificaciones" className="block">
                    <Button variant="secondary" className="w-full">
                        Elige qué avisos quieres recibir
                    </Button>
                </Link>
                <Link href="/dashboard/padre" className="block">
                    <Button className="w-full">Ir a mi panel</Button>
                </Link>
            </div>
        </div>
    );
}
