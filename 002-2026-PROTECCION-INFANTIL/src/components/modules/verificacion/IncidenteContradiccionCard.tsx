"use client";

/**
 * SPEC-787 · Tarjeta de un «reporte que no coincide» — SIMÉTRICA (FORMA-SPEC753-INCIDENTE).
 *
 * Las dos versiones van en columnas IDÉNTICAS (mismo tono neutro, mismo peso): ninguna es «la
 * verdadera». El sistema no sabe quién tiene razón — por eso existe el incidente. El estado usa
 * ámbar/neutro (CERO rubí). El reloj dice legal/interno (de dónde sale el plazo), no quién gana.
 * Superficie interna (verificador, usted); nunca la ven padre ni profesional.
 */
import { Button } from "@/components/ui/Button";
import type { IncidenteBandejaDto, LadoRespuestaDto } from "@/lib/profesional/cita/bandeja-incidentes.service";
import { COPY_INCIDENTE, copiaEstadoIncidente, copiaReloj, etiquetaRespuesta } from "./copy-incidente-verificador";

function ColumnaLado({ lado, titulo }: { lado: LadoRespuestaDto; titulo: string }) {
    // MISMO className para ambos lados: la simetría es estructural (no hay tono por rol).
    return (
        <div data-lado={lado.rol} className="flex-1 rounded-[var(--radio-card)] bg-tinta/5 p-3">
            <p className="text-xs font-semibold text-body">{titulo}</p>
            <dl className="mt-2 space-y-1 text-xs text-muted">
                <div className="flex justify-between gap-2">
                    <dt>¿Se realizó?</dt>
                    <dd className="text-body">{lado.seRealizo ? "Sí" : "No"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                    <dt>Operador</dt>
                    <dd className="text-body">{lado.operador}</dd>
                </div>
            </dl>
        </div>
    );
}

export function IncidenteContradiccionCard({
    incidente,
    onResolver,
    resolviendo,
}: {
    incidente: IncidenteBandejaDto;
    onResolver?: (id: string) => void;
    resolviendo?: boolean;
}) {
    const estado = copiaEstadoIncidente(incidente.estado, incidente.relojLegal);
    const tonoTexto = estado.tono === "ambar" ? "text-estado-ambar" : "text-muted";
    const [padre, profesional] = incidente.lados;

    return (
        <div data-incidente className="glass rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h3 className="text-sm font-semibold text-body">{COPY_INCIDENTE.rotulo}</h3>
                    <p className="text-xs text-muted">{COPY_INCIDENTE.subtitulo}</p>
                </div>
                <span data-estado data-tono={estado.tono} className={`text-xs font-medium ${tonoTexto}`}>
                    {estado.texto}
                </span>
            </div>

            <p data-reloj className="mt-2 text-xs text-muted">{copiaReloj(incidente.relojLegal, incidente.quedanDiasHabiles)}</p>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <ColumnaLado lado={padre} titulo={COPY_INCIDENTE.ladoPadre} />
                <ColumnaLado lado={profesional} titulo={COPY_INCIDENTE.ladoProfesional} />
            </div>

            {incidente.preguntaDivergente !== "SE_REALIZO" && (
                <p className="mt-2 text-xs text-muted">
                    Difieren en <span className="text-body">{incidente.preguntaDivergente}</span>:{" "}
                    {etiquetaRespuesta(incidente.preguntaDivergente, incidente.padreValor)} (padre) ·{" "}
                    {etiquetaRespuesta(incidente.preguntaDivergente, incidente.profesionalValor)} (profesional)
                </p>
            )}

            {onResolver && (
                <div className="mt-4">
                    <Button variant="primary" onClick={() => onResolver(incidente.id)} isLoading={resolviendo ?? false}>
                        Registrar resolución
                    </Button>
                </div>
            )}
        </div>
    );
}
