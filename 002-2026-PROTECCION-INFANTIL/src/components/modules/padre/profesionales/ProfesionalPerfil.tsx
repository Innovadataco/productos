/**
 * SPEC-392 (L3) · perfil detallado del profesional.
 *
 * TARIFA por delante (misma regla del brief) + presentación + especialidades +
 * modalidades. El contacto (email, teléfono) NO viaja: se entrega en L4 al
 * confirmar la cita (candado H-2 del brief §5). El botón "Solicitar cita"
 * está desactivado en L3 con el mensaje claro de que llega en L4.
 *
 * Los canales oficiales van AL FINAL — el padre ya se presentó y filtró; si
 * la urgencia le desborda antes de reservar, tiene la salida a la mano.
 */
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import type { PerfilPublicoDTO } from "@/lib/dal/repositories/perfil-profesional";

const CURRENCY_COP = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
});

function modalidadesTexto(virtual: boolean, presencial: boolean): string {
    if (virtual && presencial) return "Virtual o presencial";
    if (virtual) return "Solo virtual";
    if (presencial) return "Solo presencial";
    return "Sin modalidad declarada";
}

export function ProfesionalPerfil({
    p,
    presentacionDelPadre,
    urgencia,
}: {
    p: PerfilPublicoDTO;
    presentacionDelPadre?: string | undefined;
    urgencia?: "ESTA_SEMANA" | "SIN_APURO" | undefined;
}) {
    return (
        <div className="mx-auto max-w-3xl p-4 space-y-6">
            {/* Cabecera */}
            <div className="flex items-start gap-4">
                {p.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.fotoUrl} alt="" className="h-20 w-20 rounded-full object-cover bg-cielo/15 dark:bg-cielo/30" />
                ) : (
                    <div className="h-20 w-20 rounded-full bg-cielo/15 dark:bg-cielo/30 flex items-center justify-center text-cielo dark:text-cielo text-2xl font-semibold" aria-hidden="true">
                        {p.nombreVisible.charAt(0).toUpperCase()}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-serif text-body">{p.nombreVisible}</h1>
                    <p className="text-sm text-muted">{p.tituloProfesional}</p>
                    <p className="text-xs text-subtle mt-1">
                        {p.ciudad?.nombre ?? "Ciudad no declarada"} · {modalidadesTexto(p.atiendeVirtual, p.atiendePresencial)}
                    </p>
                </div>
            </div>

            {/* TARIFA por delante */}
            <div className="glass rounded-2xl p-5 bg-cielo/10 dark:bg-cielo/10">
                <p className="text-xs uppercase tracking-wide text-cielo dark:text-cielo">
                    Costo de la consulta
                </p>
                <p className="mt-1 text-3xl font-bold text-cielo dark:text-cielo">
                    {CURRENCY_COP.format(p.tarifaConsultaCOP)}
                </p>
                <p className="mt-1 text-sm text-muted">
                    Sesión de {p.duracionMinutos} minutos{p.emiteFactura ? " · emite factura" : ""}.
                </p>
                <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-ambar/10 dark:bg-ambar/10 px-3 py-1 text-xs font-medium text-ambar dark:text-ambar">
                    ✨ Nuevo en la red
                </p>
            </div>

            {/* Presentación del profesional */}
            {p.presentacion && (
                <section aria-labelledby="pres-prof">
                    <h2 id="pres-prof" className="text-sm font-semibold uppercase tracking-wide text-subtle mb-2">
                        Cómo se presenta
                    </h2>
                    <p className="text-sm text-body whitespace-pre-wrap">{p.presentacion}</p>
                </section>
            )}

            {/* Especialidades + experiencia */}
            <section className="grid gap-3 sm:grid-cols-2">
                <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle mb-2">Especialidades</h2>
                    {p.especialidades.length === 0 ? (
                        <p className="text-sm text-muted">Sin especialidades declaradas.</p>
                    ) : (
                        <ul className="flex flex-wrap gap-2">
                            {p.especialidades.map((e) => (
                                <li key={e} className="rounded-full bg-cielo/15 dark:bg-cielo/20 px-3 py-1 text-xs text-cielo dark:text-cielo">
                                    {e}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle mb-2">Experiencia</h2>
                    <p className="text-sm text-body">{p.aniosExperiencia} años de práctica.</p>
                </div>
            </section>

            {/* Reserva de cita — DESACTIVADA en L3 */}
            <section aria-labelledby="reservar" className="glass rounded-2xl p-5">
                <h2 id="reservar" className="text-sm font-semibold text-body">Solicitar cita</h2>
                <p className="mt-1 text-xs text-muted">
                    La reserva de cita se habilita en el próximo paso del módulo
                    (Lote 4). Los datos que anotaste antes se conservan para
                    cuando esté disponible.
                </p>
                {(presentacionDelPadre || urgencia) && (
                    <div className="mt-3 rounded-xl bg-cielo/10 dark:bg-cielo/10 p-3 text-xs">
                        {urgencia && (
                            <p>
                                <span className="font-medium">Tu urgencia:</span>{" "}
                                {urgencia === "ESTA_SEMANA" ? "Esta semana" : "Sin apuro"}
                            </p>
                        )}
                        {presentacionDelPadre && (
                            <p className="mt-1">
                                <span className="font-medium">Tu presentación:</span>{" "}
                                <span className="text-muted">{presentacionDelPadre.slice(0, 200)}{presentacionDelPadre.length > 200 ? "…" : ""}</span>
                            </p>
                        )}
                    </div>
                )}
                <button
                    type="button"
                    disabled
                    className="mt-3 w-full rounded-xl bg-cielo/40 px-4 py-3 text-sm font-semibold text-white cursor-not-allowed"
                    aria-disabled="true"
                >
                    Solicitar cita (próximamente)
                </button>
            </section>

            <CanalesOficiales />
        </div>
    );
}
