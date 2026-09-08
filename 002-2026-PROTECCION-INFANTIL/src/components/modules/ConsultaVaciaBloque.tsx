"use client";

import { Alerta } from "@/components/ui/Alerta";

/**
 * SPEC-596 (decisión CEO 06-09): rediseño del resultado vacío de la consulta
 * pública. La tarjeta de señales y acciones pasa a ser el PROTAGONISTA visual:
 * expandida siempre (sin modal ni enlace previo), más importante que el estado
 * anterior. Contenido 100% estático (parámetros curados, NADA de IA) y solo
 * informativo. Presunción de inocencia: lenguaje descriptivo, nunca
 * "es seguro/peligroso".
 *
 * Sale de esta pantalla, por decisión del CEO: el CTA «Reportar una conducta»
 * y el bloque de canales oficiales (141 / CAI Virtual / Te Protejo). La
 * restricción de constitución («toda interfaz de reporte muestra canales
 * oficiales») aplica a los FLUJOS DE REPORTE: /reportar los sigue mostrando
 * (CanalesOficiales montado ahí) y la portada los mantiene arriba del todo
 * (candado SPEC-456). La consulta vacía queda limpia e informativa.
 */
export type ConsultaVaciaBloqueData = {
    disclaimer?: string;
    senales?: string[];
    acciones?: string[];
};

export function ConsultaVaciaBloque({ bloque }: { bloque: ConsultaVaciaBloqueData }) {
    const haySenales = (bloque.senales?.length ?? 0) > 0;
    const hayAcciones = (bloque.acciones?.length ?? 0) > 0;
    const hayTarjeta = haySenales || hayAcciones;

    return (
        <div className="space-y-4 text-left">
            {bloque.disclaimer && <Alerta tono="advertencia">{bloque.disclaimer}</Alerta>}

            {hayTarjeta && (
                <section
                    aria-labelledby="consulta-vacia-senales-titulo"
                    className="overflow-hidden rounded-2xl border border-ambar/40 bg-papel shadow-lg"
                >
                    <div className="bg-ambar/10 px-5 py-4">
                        <h2
                            id="consulta-vacia-senales-titulo"
                            className="text-base font-semibold text-tinta"
                        >
                            Señales de alerta y qué puedes hacer
                        </h2>
                        <p className="mt-1 text-sm text-muted">
                            Información de prevención para cuidar a los menores.
                        </p>
                    </div>

                    <div className="space-y-5 px-5 py-5">
                        {haySenales && (
                            <div>
                                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-body">
                                    Señales de alerta a las que estar atento
                                </h3>
                                <ul className="space-y-2">
                                    {bloque.senales?.map((senal) => (
                                        <li key={senal} className="flex items-start gap-2 text-sm text-body">
                                            <span aria-hidden="true" className="mt-0.5 text-ambar">●</span>
                                            <span>{senal}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {hayAcciones && (
                            <div>
                                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-body">
                                    Qué puedes hacer
                                </h3>
                                <ul className="space-y-2">
                                    {bloque.acciones?.map((accion) => (
                                        <li key={accion} className="flex items-start gap-2 text-sm text-body">
                                            <span aria-hidden="true" className="mt-0.5 text-pino">●</span>
                                            <span>{accion}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
