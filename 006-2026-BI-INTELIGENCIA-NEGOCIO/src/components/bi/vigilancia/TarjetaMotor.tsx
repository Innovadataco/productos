import type { VigilanciaData } from "@/lib/bi/vigilancia";
import CifraAnimada from "../pulso/CifraAnimada";
import { fmtMiles } from "../pulso/formatos";

/** "2026-09-03T04:12:00Z" → "04:12"; ISO inválido → null (se dice sin hora). */
function formatearHora(iso: string): string | null {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return null;
    return fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/**
 * Tarjeta-monitor "Motor de clasificación" (marco de vigilancia, Lote 1):
 * vigila el SÍNTOMA visible en la réplica — cuánto lleva sin caer una
 * clasificación y cuántos reportes esperan —, no los procesos de PI.
 *
 * Pino "clasificando al día" cuando no hay sospecha; ámbar latiendo "posible
 * freno desde las HH:mm · N sin clasificar en 48 h" cuando la capa de datos
 * la levanta. Sin última clasificación registrada se dice tal cual, jamás se
 * inventa una hora (candado 9). La nota honesta deja claro dónde vive la
 * salud real de procesos (workers/Ollama): en PI, no en este tablero.
 */
export default function TarjetaMotor({
    motorCaido,
    retardo = 0,
}: {
    motorCaido: VigilanciaData["motorCaido"];
    retardo?: number;
}) {
    const { sospecha, ultimaClasificacionEn, colaSinClasificar } = motorCaido;
    const hora = ultimaClasificacionEn === null ? null : formatearHora(ultimaClasificacionEn);

    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className={`punto ${sospecha ? "punto-warn anim-pulso" : "punto-ok"}`} />
                    <h3 className="text-[16.5px] font-semibold">Motor de clasificación</h3>
                </div>
                <span
                    className={`text-[11px] font-bold uppercase tracking-[0.12em] ${
                        sospecha ? "text-estado-ambar" : "text-estado-pino"
                    }`}
                >
                    {sospecha ? "Posible freno" : "Clasificando al día"}
                </span>
            </div>
            <div className="mb-4 text-[13px] text-muted">
                Última clasificación y cola de espera en la réplica
            </div>

            <div
                className={`cifra text-[42px] font-bold leading-[1.1] tracking-tight ${
                    sospecha ? "text-estado-ambar" : ""
                }`}
            >
                <CifraAnimada valor={colaSinClasificar} />
            </div>
            <div className="mb-4 text-[12.5px] text-muted">
                {colaSinClasificar === 1
                    ? "reporte sin clasificar en 48 h"
                    : "reportes sin clasificar en 48 h"}
            </div>

            <p className={`text-[13px] ${sospecha ? "text-estado-ambar" : "text-muted"}`}>
                {sospecha
                    ? hora !== null
                        ? `Posible freno desde las ${hora} · ${fmtMiles(colaSinClasificar)} sin clasificar en 48 h.`
                        : "Posible freno: no hay clasificaciones registradas en la réplica."
                    : hora !== null
                      ? `Última clasificación a las ${hora}.`
                      : "Sin clasificaciones registradas aún en la réplica."}
            </p>

            <p className="aviso-honesto">
                Es un síntoma en los datos; la salud de procesos vive en PI.
            </p>
        </div>
    );
}
