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

            {/* SPEC-362 (A-70 · G14): eran tres botones sueltos en una pantalla
                vacía y no se entendía qué hacer con ellos. Ahora cada opción es
                una tarjeta que dice qué es y para qué sirve, y el paso principal
                (ir al panel) se distingue de los otros dos. */}
            <div className="mx-auto mt-8 grid max-w-2xl gap-4 text-left sm:grid-cols-2">
                <Link
                    href="/dashboard/padre/circulo-confianza"
                    className="group rounded-2xl border border-tinta/10 bg-papel/50 p-5 transition hover:border-cielo/50 dark:bg-tinta/40"
                >
                    <h2 className="text-base font-semibold text-body">Suma tu círculo de confianza</h2>
                    <p className="mt-1 text-sm text-muted">
                        Las cuentas de las personas que rodean a {quienes}: si alguna aparece en un
                        reporte, lo sabrás antes.
                    </p>
                    <span className="mt-3 inline-block text-sm font-semibold text-cielo-600 group-hover:underline">
                        Agregar personas →
                    </span>
                </Link>

                <Link
                    href="/dashboard/padre/notificaciones"
                    className="group rounded-2xl border border-tinta/10 bg-papel/50 p-5 transition hover:border-cielo/50 dark:bg-tinta/40"
                >
                    <h2 className="text-base font-semibold text-body">Elige qué avisos recibes</h2>
                    <p className="mt-1 text-sm text-muted">
                        Decide de qué te avisamos y a qué correo llega. Puedes cambiarlo cuando
                        quieras.
                    </p>
                    <span className="mt-3 inline-block text-sm font-semibold text-cielo-600 group-hover:underline">
                        Ajustar avisos →
                    </span>
                </Link>

                <Link
                    href="/dashboard/padre"
                    className="group rounded-2xl border border-cielo/40 bg-cielo/5 p-5 transition hover:border-cielo sm:col-span-2"
                >
                    <h2 className="text-base font-semibold text-body">Ir a mi panel</h2>
                    <p className="mt-1 text-sm text-muted">
                        Ahí ves todo junto: quién está protegido, los avisos que llegan y tus
                        reportes.
                    </p>
                    <span className="mt-3 inline-block text-sm font-semibold text-cielo-600 group-hover:underline">
                        Entrar al panel →
                    </span>
                </Link>
            </div>
        </div>
    );
}
