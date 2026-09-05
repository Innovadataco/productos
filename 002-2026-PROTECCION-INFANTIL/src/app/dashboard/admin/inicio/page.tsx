import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { calcularEstadoInicio } from "@/lib/dal/services/inicio-admin";
import type { EstadoInicio, SenalAlarma, SenalDegradada } from "@/lib/dal/services/inicio-admin";

/**
 * SPEC-378 · Inicio del administrador. La alarma de la casa: vacía cuando
 * todo está bien, muestra tarjetas ámbar cuando algo se rompió en silencio.
 * No es un tablero de métricas de vanidad. El corte por módulo (`inicio_admin`)
 * decide si el admin lo tiene; sin el módulo cae a la pantalla estándar.
 *
 * SPEC-414 (BRIEF A-76 §3.2, I-271) · el interruptor de datos de prueba.
 * Por defecto las colas de trabajo muestran SOLO LO REAL, con el conteo de lo
 * sembrado al lado y un enlace para traerlo de vuelta. Nada queda oculto: el
 * número siempre se ve, y `?prueba=1` lo devuelve a la cuenta con un clic.
 *
 * SPEC-414 (I-294) · una señal que no se pudo calcular se muestra como
 * degradada. El admin tiene que poder distinguir «no hay nada» de «no pude
 * mirar»: antes un fallo desaparecía y la pantalla mentía calma.
 *
 * Color: lo NUEVO de esta spec (interruptor y bloque de degradadas) usa tokens
 * (`ambar`, `tinta`), no la escala cruda de Tailwind — candado SPEC-157 FR-007,
 * `npm run tokens:check`. `TarjetaSenal` conserva sus clases crudas de SPEC-378:
 * migrarlas baja el piso del ratchet y es un cambio de otro PR.
 *
 * Rendimiento: `calcularEstadoInicio` corre ~9 consultas en paralelo. Devuelve
 * `latenciaMs` para que el mismo endpoint reporte cuánto tardó — si crece,
 * mover S3/S4 a sondas en `monitor-probes.mjs` (fuera de alcance de este PR).
 */
export const dynamic = "force-dynamic";

interface PageProps {
    searchParams: Promise<{ prueba?: string }>;
}

export default async function AdminInicioPage({ searchParams }: PageProps) {
    const acceso = await verificarAccesoPagina("inicio_admin");
    if (!acceso.permitido) {
        return <SinAccesoModulo />;
    }

    const { prueba } = await searchParams;
    const incluirSembrados = prueba === "1";
    const estado = await calcularEstadoInicio({ incluirSembrados });

    const altas = estado.alertas.filter((a) => a.prioridad === "alta");
    const medias = estado.alertas.filter((a) => a.prioridad === "media");

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <header className="space-y-3">
                <h1 className="text-2xl font-bold text-body">Inicio</h1>
                <p className="text-sm text-muted">
                    {estado.alertas.length === 0
                        ? "Alarma de operación del sistema."
                        : `${estado.alertas.length} señal${estado.alertas.length === 1 ? "" : "es"} de operación${altas.length > 0 ? ` (${altas.length} urgentes)` : ""} requieren tu atención.`}
                </p>
                <InterruptorDatosPrueba estado={estado} />
            </header>

            {estado.degradadas.length > 0 && <BloqueDegradadas degradadas={estado.degradadas} />}

            {estado.alertas.length === 0 && (
                <GlassCard className="p-8 text-center">
                    <p className="text-lg font-semibold text-body">Todo tranquilo.</p>
                    <p className="mt-2 text-sm text-muted">
                        Nada requiere tu atención ahora. Cuando algo se rompa, aparecerá acá.
                    </p>
                </GlassCard>
            )}

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

/**
 * El interruptor. Dice SIEMPRE qué se está viendo y cuánto dato de prueba hay
 * detrás — el conteo no se esconde nunca, ni cuando está en cero. Es un enlace
 * y no un botón con estado: la página es un server component y el modo vive en
 * la URL, así que se puede compartir y volver atrás con el navegador.
 */
function InterruptorDatosPrueba({ estado }: { estado: EstadoInicio }) {
    const { incluyeSembrados, sembrados } = estado;
    return (
        <GlassCard className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="text-sm">
                <p className="font-medium text-body">
                    {incluyeSembrados
                        ? "Viendo datos reales y de prueba."
                        : "Viendo solo datos reales."}
                </p>
                <p className="text-xs text-muted">
                    {sembrados.total === 0
                        ? "No hay datos de prueba en las colas de trabajo."
                        : `${sembrados.total} registro(s) de prueba (sembrados y de simulación) ${incluyeSembrados ? "están contando" : "quedaron fuera"} de las colas de trabajo.`}
                </p>
            </div>
            <Link
                href={incluyeSembrados ? "/dashboard/admin/inicio" : "/dashboard/admin/inicio?prueba=1"}
                className="rounded-lg border border-tinta/15 px-3 py-1 text-xs font-medium text-body transition hover:bg-tinta/5"
            >
                {incluyeSembrados ? "Ver solo lo real" : "Incluir datos de prueba"}
            </Link>
        </GlassCard>
    );
}

/**
 * I-294 · lo que no se pudo mirar. Va arriba de todo y en ámbar como el resto
 * (regla dura de Jelkin: nunca rojo), porque una señal caída es justamente la
 * situación en la que el silencio engaña.
 */
function BloqueDegradadas({ degradadas }: { degradadas: SenalDegradada[] }) {
    return (
        <GlassCard className="border-l-4 border-ambar p-4">
            <p className="text-sm font-semibold text-body">
                No pudimos calcular {degradadas.length} señal{degradadas.length === 1 ? "" : "es"}.
            </p>
            <p className="mt-1 text-sm text-muted">
                Esto no significa que estén bien: significa que no se pudieron mirar.
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-muted">
                {degradadas.map((d) => (
                    <li key={d.id}>{d.etiqueta}</li>
                ))}
            </ul>
        </GlassCard>
    );
}

function TarjetaSenal({ senal }: { senal: SenalAlarma }) {
    // Regla dura de Jelkin: NUNCA rojo. Ámbar para todas — la prioridad se
    // separa por sección arriba, no por color de tarjeta.
    return (
        <GlassCard className="border-l-4 border-amber-500 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm text-body">{senal.texto}</p>
                <Link
                    href={senal.ruta}
                    className="rounded-lg border border-tinta/10 px-3 py-1 text-xs font-medium text-body hover:bg-tinta/5"
                >
                    Resolver
                </Link>
            </div>
        </GlassCard>
    );
}
