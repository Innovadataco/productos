import { GlassCard } from "@/components/ui/GlassCard";
import { formatoFechaBogota } from "@/lib/fechas/formato-bogota";
import { LABELS_ESTADO, LABELS_SCORE, COLORES_SCORE } from "@/lib/padre/expediente-ui";
import type { EstadoExpediente, ScoreGravedad } from "@prisma/client";

const SIN_DATOS = "—";

/**
 * Fila anonimizada (Ley 1581): espejo exacto del `select` explícito de
 * `ExpedienteRepository.listarExpedientesPorIdentificadorAnonimo`.
 * Por construcción no existe `padreUsuarioId`, eventos ni textos.
 */
export interface ExpedienteAnonimoItem {
    estado: EstadoExpediente;
    scoreGravedadActual: ScoreGravedad;
    fechaApertura: Date;
    fechaCierre: Date | null;
    numEventos: number;
    plataformaId: string | null;
}

/**
 * SPEC-233 (002-PI-133): lista anonimizada de expedientes de toda la
 * plataforma sobre un identificador (vista admin/comité). Lenguaje
 * descriptivo/estadístico, nunca veredictos sobre personas.
 */
export function IdentificadorExpedientesAnonimos({ expedientes }: { expedientes: ExpedienteAnonimoItem[] }) {
    return (
        <GlassCard className="p-6">
            <h2 className="text-lg font-semibold text-body">
                {expedientes.length === 1
                    ? "1 expediente registrado sobre este identificador"
                    : `${expedientes.length} expedientes registrados sobre este identificador`}
            </h2>
            <p className="mt-1 text-sm text-muted">
                Filas anonimizadas: no incluyen identidad de quien reporta ni contenido de los eventos.
            </p>

            <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-ambar/20 text-xs uppercase tracking-wide text-muted">
                            <th className="py-2 pr-4 font-semibold">Estado</th>
                            <th className="py-2 pr-4 font-semibold">Nivel</th>
                            <th className="py-2 pr-4 font-semibold">Apertura</th>
                            <th className="py-2 pr-4 font-semibold">Cierre</th>
                            <th className="py-2 pr-4 font-semibold">Plataforma</th>
                            <th className="py-2 font-semibold">Eventos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expedientes.map((exp, indice) => (
                            <tr key={indice} className="border-b border-ambar/10 last:border-0">
                                <td className="py-3 pr-4 text-body">{LABELS_ESTADO[exp.estado]}</td>
                                <td className="py-3 pr-4">
                                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${COLORES_SCORE[exp.scoreGravedadActual]}`}>
                                        {LABELS_SCORE[exp.scoreGravedadActual]}
                                    </span>
                                </td>
                                <td className="py-3 pr-4 text-muted">{formatoFechaBogota(exp.fechaApertura)}</td>
                                <td className="py-3 pr-4 text-muted">
                                    {exp.fechaCierre ? formatoFechaBogota(exp.fechaCierre) : SIN_DATOS}
                                </td>
                                <td className="py-3 pr-4 text-muted">{exp.plataformaId ?? SIN_DATOS}</td>
                                <td className="py-3 text-body">{exp.numEventos}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </GlassCard>
    );
}
