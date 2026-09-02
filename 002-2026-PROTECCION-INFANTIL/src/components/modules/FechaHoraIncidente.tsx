"use client";

/**
 * A-74 · P1 (SPEC-368) — el control amable para la fecha del hecho.
 *
 * Por qué reemplaza al `datetime-local` nativo: aun con `step=3600` el navegador
 * PINTA el segmento de minutos ("02/09/2026, 02:00 p.m.") y vacío se ve
 * "dd/mm/aaaa, --:-- ----". Verificado en el render del reporte anónimo. A un
 * padre eso le pide una precisión que no tiene y no comunica nada.
 *
 * Aquí se pregunta en tres piezas: el día, la hora de 1 a 12, y si fue a.m. o
 * p.m. Sin minutos a la vista.
 *
 * CANDADOS de B1 (SPEC-359) que este control CONSERVA:
 *  1. Es imposible elegir futuro. El tope viaja en hora LOCAL (el bug original
 *     fue calcularlo en UTC y dejar 5 h de futuro). Si el día elegido es HOY,
 *     las horas que todavía no han pasado quedan deshabilitadas.
 *  2. El `error` (el del servidor, que nombra el campo) se sigue mostrando.
 *  3. El contrato de `onChange` no cambia: sigue emitiendo "YYYY-MM-DDTHH:00",
 *     así que el borrador en sessionStorage del wizard sigue funcionando igual.
 *  4. Siempre hora en punto: los minutos van en 00.
 */
import { desdePartesHoraLocal, partesHoraLocal, type Meridiano } from "@/lib/format/fecha";

type Props = {
    /** "YYYY-MM-DDTHH:mm" en hora local. */
    value: string;
    /** Tope en hora LOCAL, "YYYY-MM-DDTHH:mm" (el ahora). */
    max: string;
    onChange: (valor: string) => void;
    error?: string | undefined;
};

const HORAS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

/** (hora 1-12, a.m./p.m.) → hora de 0 a 23. 12 a.m. = 0 · 12 p.m. = 12. */
function a24(hora12: number, meridiano: Meridiano): number {
    const base = hora12 % 12;
    return meridiano === "pm" ? base + 12 : base;
}

export function FechaHoraIncidente({ value, max, onChange, error }: Props) {
    const { fecha, hora12, meridiano } = partesHoraLocal(value);
    const maxFecha = max.slice(0, 10);
    const maxHora24 = Number.parseInt(max.slice(11, 13), 10);

    // Solo el día de HOY tiene horas futuras que bloquear; los días anteriores
    // están completos.
    const esHoy = fecha !== "" && fecha === maxFecha;
    const topeHora = esHoy && !Number.isNaN(maxHora24) ? maxHora24 : 23;

    function emitir(nuevaFecha: string, nuevaHora: number | null, nuevoMeridiano: Meridiano) {
        const compuesto = desdePartesHoraLocal(nuevaFecha, nuevaHora, nuevoMeridiano);
        if (!compuesto) {
            onChange("");
            return;
        }
        // Red de seguridad: aunque las opciones futuras estén deshabilitadas,
        // nunca dejamos salir un valor por encima del tope.
        onChange(compuesto > max ? `${maxFecha}T${String(topeHora).padStart(2, "0")}:00` : compuesto);
    }

    function cambiarFecha(nuevaFecha: string) {
        const recortada = nuevaFecha > maxFecha ? maxFecha : nuevaFecha;
        // Si al cambiar de día la hora elegida queda en el futuro, se baja al tope.
        const limite = recortada === maxFecha && !Number.isNaN(maxHora24) ? maxHora24 : 23;
        if (hora12 !== null && a24(hora12, meridiano) > limite) {
            const h12 = limite % 12 === 0 ? 12 : limite % 12;
            emitir(recortada, h12, limite >= 12 ? "pm" : "am");
            return;
        }
        emitir(recortada, hora12, meridiano);
    }

    const pmDeshabilitado = esHoy && topeHora < 12;

    return (
        <div className="flex flex-col gap-1.5">
            <span className="block text-sm font-medium text-body">Fecha y hora del incidente</span>
            {/* Flujo, no rejilla fija: el control vive dentro de una columna
                estrecha del paso y con 3 columnas duras el "p.m." se cortaba
                contra el campo de al lado (visto en el navegador). */}
            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="date"
                    aria-label="Día del incidente"
                    value={fecha}
                    max={maxFecha}
                    onChange={(e) => cambiarFecha(e.target.value)}
                    className="h-12 min-w-0 flex-1 basis-40 rounded-xl border border-tinta/15 bg-papel px-3 text-body outline-none transition focus:border-pino focus:ring-2 focus:ring-pino/25"
                />
                <select
                    aria-label="Hora del incidente"
                    value={hora12 ?? ""}
                    onChange={(e) => emitir(fecha, e.target.value ? Number(e.target.value) : null, meridiano)}
                    className="h-12 shrink-0 rounded-xl border border-tinta/15 bg-papel px-2 text-body outline-none transition focus:border-pino focus:ring-2 focus:ring-pino/25"
                >
                    <option value="">Hora</option>
                    {HORAS.map((h) => (
                        <option key={h} value={h} disabled={esHoy && a24(h, meridiano) > topeHora}>
                            {h}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="a.m. o p.m."
                    value={meridiano}
                    onChange={(e) => emitir(fecha, hora12, e.target.value as Meridiano)}
                    className="h-12 shrink-0 rounded-xl border border-tinta/15 bg-papel px-2 text-body outline-none transition focus:border-pino focus:ring-2 focus:ring-pino/25"
                >
                    <option value="am">a.m.</option>
                    <option value="pm" disabled={pmDeshabilitado}>
                        p.m.
                    </option>
                </select>
            </div>
            <p className="text-sm text-muted">No necesitas el minuto exacto: basta el día y la hora aproximada.</p>
            {error && (
                <p role="alert" className="text-sm text-ambar">
                    {error}
                </p>
            )}
        </div>
    );
}
