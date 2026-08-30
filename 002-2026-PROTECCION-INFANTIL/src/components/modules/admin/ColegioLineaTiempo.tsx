"use client";

/**
 * SPEC-311 (002-PI-210 · Fase 2 · Bloque C): línea de tiempo horizontal simple para la ficha del colegio.
 * Sin librería de charts · altura acotada · tokens PI.
 * 4 hitos: ingreso (fechaRegistro) · primer reporte (MIN(creadoEn) all-time) · pico (mes con más
 * reportes) · hoy. Si no hay reportes muestra solo `ingreso` y `hoy` con etiqueta neutral.
 */

interface LineaTiempoColegio {
    fechaRegistro: string;
    primerReporte: string | null;
    picoActividad: { anioMes: string; total: number } | null;
    hoy: string;
}

interface Hito {
    posicion: number;
    fecha: string;
    etiqueta: string;
    subEtiqueta?: string;
}

function fechaCorta(iso: string): string {
    return new Date(iso).toLocaleDateString("es-CO", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "short",
    });
}

function mesLegible(anioMes: string): string {
    const [anio, mes] = anioMes.split("-").map(Number);
    const d = new Date(anio!, mes! - 1, 1);
    return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "short" });
}

function computarHitos(lineaTiempo: LineaTiempoColegio): Hito[] {
    const ingresoTs = new Date(lineaTiempo.fechaRegistro).getTime();
    const hoyTs = new Date(lineaTiempo.hoy).getTime();
    const span = Math.max(1, hoyTs - ingresoTs);
    const hitos: Hito[] = [{ posicion: 0, fecha: lineaTiempo.fechaRegistro, etiqueta: "Ingreso", subEtiqueta: fechaCorta(lineaTiempo.fechaRegistro) }];
    if (lineaTiempo.primerReporte) {
        const primerTs = new Date(lineaTiempo.primerReporte).getTime();
        const pos = Math.min(100, Math.max(0, ((primerTs - ingresoTs) / span) * 100));
        hitos.push({ posicion: pos, fecha: lineaTiempo.primerReporte, etiqueta: "Primer reporte", subEtiqueta: fechaCorta(lineaTiempo.primerReporte) });
    }
    if (lineaTiempo.picoActividad) {
        const [anio, mes] = lineaTiempo.picoActividad.anioMes.split("-").map(Number);
        const picoTs = new Date(anio!, mes! - 1, 15).getTime();
        const pos = Math.min(100, Math.max(0, ((picoTs - ingresoTs) / span) * 100));
        hitos.push({
            posicion: pos,
            fecha: lineaTiempo.picoActividad.anioMes,
            etiqueta: `Pico (${lineaTiempo.picoActividad.total})`,
            subEtiqueta: mesLegible(lineaTiempo.picoActividad.anioMes),
        });
    }
    hitos.push({ posicion: 100, fecha: lineaTiempo.hoy, etiqueta: "Hoy", subEtiqueta: fechaCorta(lineaTiempo.hoy) });
    return hitos;
}

export function ColegioLineaTiempo({ lineaTiempo }: { lineaTiempo: LineaTiempoColegio }) {
    const sinReportes = lineaTiempo.primerReporte === null;
    const hitos = computarHitos(lineaTiempo);

    return (
        <div className="relative max-h-24 py-2" aria-label="Línea de tiempo del colegio">
            <div className="relative h-1 rounded bg-tinta/20">
                {hitos.map((h) => (
                    <div
                        key={`${h.posicion}-${h.etiqueta}`}
                        className="absolute -top-1 h-3 w-3 -translate-x-1/2 rounded-full bg-pino"
                        style={{ left: `${h.posicion}%` }}
                        title={`${h.etiqueta} · ${h.subEtiqueta ?? ""}`}
                    />
                ))}
            </div>
            <div className="relative mt-2 h-10">
                {hitos.map((h) => (
                    <div
                        key={`label-${h.posicion}-${h.etiqueta}`}
                        className="absolute -translate-x-1/2 text-center text-xs"
                        style={{ left: `${h.posicion}%`, maxWidth: "22%" }}
                    >
                        <p className="font-medium text-body">{h.etiqueta}</p>
                        {h.subEtiqueta && <p className="text-subtle">{h.subEtiqueta}</p>}
                    </div>
                ))}
            </div>
            {sinReportes && (
                <p className="mt-2 text-center text-xs text-muted">Sin reportes registrados aún</p>
            )}
        </div>
    );
}
