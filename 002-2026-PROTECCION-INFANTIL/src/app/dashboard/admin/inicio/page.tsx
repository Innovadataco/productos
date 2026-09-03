import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { calcularEstadoInicio } from "@/lib/dal/services/inicio-admin";

/**
 * SPEC-378 · Inicio del administrador. La alarma de la casa: vacía cuando
 * todo está bien, muestra tarjetas ámbar cuando algo se rompió en silencio.
 * No es un tablero de métricas de vanidad. El corte por módulo (`inicio_admin`)
 * decide si el admin lo tiene; sin el módulo cae a la pantalla estándar.
 *
 * Rendimiento: `calcularEstadoInicio` corre ~7 consultas en paralelo. Devuelve
 * `latenciaMs` para que el mismo endpoint reporte cuánto tardó — si crece,
 * mover S3/S4 a sondas en `monitor-probes.mjs` (fuera de alcance de este PR).
 */
export const dynamic = "force-dynamic";

export default async function AdminInicioPage() {
    const acceso = await verificarAccesoPagina("inicio_admin");
    if (!acceso.permitido) {
        return <SinAccesoModulo />;
    }

    const estado = await calcularEstadoInicio();

    if (estado.alertas.length === 0) {
        return (
            <div className="mx-auto max-w-3xl space-y-6">
                <header>
                    <h1 className="text-2xl font-bold text-body">Inicio</h1>
                    <p className="text-sm text-muted">Alarma de operación del sistema.</p>
                </header>
                <GlassCard className="p-8 text-center">
                    <p className="text-lg font-semibold text-body">Todo tranquilo.</p>
                    <p className="mt-2 text-sm text-muted">
                        Nada requiere tu atención ahora. Cuando algo se rompa, aparecerá acá.
                    </p>
                </GlassCard>
            </div>
        );
    }

    const altas = estado.alertas.filter((a) => a.prioridad === "alta");
    const medias = estado.alertas.filter((a) => a.prioridad === "media");

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-body">Inicio</h1>
                <p className="text-sm text-muted">
                    {estado.alertas.length} señal{estado.alertas.length === 1 ? "" : "es"} de operación
                    {altas.length > 0 ? ` (${altas.length} urgentes)` : ""} requieren tu atención.
                </p>
            </header>

            {altas.length > 0 && (
                <section className="space-y-3" aria-labelledby="urgente-title">
                    <h2 id="urgente-title" className="text-sm font-semibold uppercase tracking-wide text-muted">
                        Urgente
                    </h2>
                    {altas.map((s) => (
                        <TarjetaSenal key={s.id} senal={s} />
                    ))}
                </section>
            )}

            {medias.length > 0 && (
                <section className="space-y-3" aria-labelledby="media-title">
                    <h2 id="media-title" className="text-sm font-semibold uppercase tracking-wide text-muted">
                        Requiere revisión
                    </h2>
                    {medias.map((s) => (
                        <TarjetaSenal key={s.id} senal={s} />
                    ))}
                </section>
            )}
        </div>
    );
}

function TarjetaSenal({ senal }: { senal: { id: string; prioridad: "alta" | "media"; texto: string; ruta: string } }) {
    // Regla dura de Jelkin: NUNCA rojo. Ámbar para todas — la prioridad se
    // separa por sección arriba, no por color de tarjeta.
    return (
        <GlassCard className="border-l-4 border-amber-500 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm text-body">{senal.texto}</p>
                <Link
                    href={senal.ruta}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-body hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                    Resolver
                </Link>
            </div>
        </GlassCard>
    );
}
