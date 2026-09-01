"use client";

// src/components/bi/OperacionBI.tsx · Tablero de Operación (mockup-bi-v2 · Fase 3)
// Cliente: 4 minicards con count-up, filtros funcionales y tabla con semáforo.
// Candado 9: TODA cifra viene de props (ResultSet real); el vacío se muestra
// como "—" / mensaje honesto, jamás se inventa un dato.

import { useEffect, useMemo, useState } from "react";
import type { FilaOperacion, ResumenOperacion } from "@/lib/bi/operacion";

type Filtro = "todos" | "hoy" | "atencion" | "inactivos";

const FILTROS: Array<{ id: Filtro; etiqueta: string }> = [
    { id: "todos", etiqueta: "Todos" },
    { id: "hoy", etiqueta: "Con actividad hoy" },
    { id: "atencion", etiqueta: "En atención" },
    { id: "inactivos", etiqueta: "Sin reportes 30 días" },
];

/** Etiquetas de presentación para el enum CategoriaConducta de PI. */
const ETIQUETAS_CATEGORIA: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    OTRO: "Otro",
    EXTORSION: "Extorsión",
    CONTENIDO_GENERADO_IA: "Contenido generado IA",
    DIFUSION_NO_CONSENTIDA: "Difusión no consentida",
    DOXING: "Doxing",
    SPAM: "Spam",
    CIBERACOSO: "Ciberacoso",
    HAPPY_SLAPPING: "Happy slapping",
    STALKING: "Stalking",
};

const CLASE_PUNTO: Record<FilaOperacion["estado"], string> = {
    ok: "punto-ok",
    warn: "punto-warn",
    bad: "punto-bad",
};

const COLOR_BORDE: Record<FilaOperacion["estado"], string> = {
    ok: "transparent",
    warn: "rgb(var(--ambar-rgb))",
    bad: "rgb(var(--rubi-rgb))",
};

/** "hace X" honesto a partir de minutos reales; null → "sin reportes". */
function formatoUltimo(minutos: number | null): string {
    if (minutos === null) return "sin reportes";
    if (minutos < 1) return "ahora mismo";
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}

/** Número con count-up; reduced-motion (y 0) muestran el valor final de una. */
function CifraAnimada({ valor, retardo }: { valor: number; retardo: number }) {
    const [visible, setVisible] = useState(0);

    useEffect(() => {
        const sinMovimiento = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        if (sinMovimiento || valor === 0) {
            const marco = requestAnimationFrame(() => setVisible(valor));
            return () => cancelAnimationFrame(marco);
        }
        const duracion = 900;
        let inicio: number | null = null;
        let marco = 0;
        const paso = (t: number) => {
            if (inicio === null) inicio = t + retardo;
            const progreso = Math.min(Math.max((t - inicio) / duracion, 0), 1);
            setVisible(Math.round(valor * progreso));
            if (progreso < 1) marco = requestAnimationFrame(paso);
        };
        marco = requestAnimationFrame(paso);
        return () => cancelAnimationFrame(marco);
    }, [valor, retardo]);

    return <span className="cifra">{visible}</span>;
}

function MiniCard({
    punto,
    valor,
    etiqueta,
    retardo,
}: {
    punto: string;
    valor: number;
    etiqueta: string;
    retardo: number;
}) {
    return (
        <div
            className="glass anim-entrada px-5 py-4 flex items-center gap-3.5"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <span className={`punto ${punto} anim-pulso`} style={{ width: 12, height: 12 }} />
            <div>
                <div className="text-[32px] font-bold leading-none">
                    <CifraAnimada valor={valor} retardo={retardo} />
                </div>
                <div className="microetiqueta mt-1.5">{etiqueta}</div>
            </div>
        </div>
    );
}

export default function OperacionBI({
    filas,
    resumen,
    minutosBadgeNuevo,
}: {
    filas: FilaOperacion[];
    resumen: ResumenOperacion;
    minutosBadgeNuevo: number;
}) {
    const [filtro, setFiltro] = useState<Filtro>("todos");

    const visibles = useMemo(
        () =>
            filas.filter((f) => {
                if (filtro === "hoy") return f.hoy > 0;
                if (filtro === "atencion") return f.estado === "warn";
                if (filtro === "inactivos") return f.estado === "bad";
                return true;
            }),
        [filas, filtro],
    );

    return (
        <>
            {/* Resumen: 4 minicards con count-up */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5 mb-5">
                <MiniCard punto="punto-ok" valor={resumen.activos} etiqueta="Colegios activos" retardo={60} />
                <MiniCard punto="punto-warn" valor={resumen.enAtencion} etiqueta="En atención" retardo={120} />
                <MiniCard punto="punto-bad" valor={resumen.sinActividad} etiqueta="Sin actividad 30 d" retardo={180} />
                <MiniCard punto="punto-ok" valor={resumen.reportesHoy} etiqueta="Reportes hoy" retardo={240} />
            </div>

            {/* Filtros funcionales (filtran en cliente) */}
            <div
                className="anim-entrada flex gap-2.5 mb-[18px] flex-wrap"
                style={{ "--anim-retardo": "300ms" } as React.CSSProperties}
            >
                {FILTROS.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        onClick={() => setFiltro(f.id)}
                        className={
                            filtro === f.id
                                ? "px-4 py-2 rounded-full text-[13px] font-semibold bg-[rgb(var(--pino-rgb))] text-[#060b0a] transition-all"
                                : "px-4 py-2 rounded-full text-[13px] text-muted border border-[rgb(var(--tinta-rgb)/0.12)] transition-all hover:border-[rgb(var(--pino-rgb)/0.5)]"
                        }
                    >
                        {f.etiqueta}
                    </button>
                ))}
            </div>

            {/* Tabla de colegios */}
            <div
                className="glass anim-entrada px-3 py-2 overflow-x-auto"
                style={{ "--anim-retardo": "360ms" } as React.CSSProperties}
            >
                {visibles.length === 0 ? (
                    <p className="text-muted text-sm text-center py-10 px-6">
                        {filas.length === 0
                            ? "Todavía no hay colegios activos en la réplica. En cuanto PI sincronice colegios, este tablero los muestra tal cual."
                            : "Ningún colegio cumple este filtro con los datos actuales."}
                    </p>
                ) : (
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr>
                                {["Colegio", "Reportes mes", "Hoy", "Categoría top", "Último reporte", "Estado"].map(
                                    (th) => (
                                        <th
                                            key={th}
                                            className="microetiqueta text-left font-normal px-3.5 py-2.5 border-b border-[rgb(var(--tinta-rgb)/0.1)]"
                                        >
                                            {th}
                                        </th>
                                    ),
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {visibles.map((f) => {
                                const esNuevo =
                                    f.ultimoReporteHaceMin !== null &&
                                    f.ultimoReporteHaceMin < minutosBadgeNuevo;
                                return (
                                    <tr key={f.colegio} className="group">
                                        <td
                                            className="px-3.5 py-3 font-semibold border-b border-[rgb(var(--tinta-rgb)/0.06)] group-hover:bg-[rgb(var(--tinta-rgb)/0.04)] transition-colors"
                                            style={{ borderLeft: `3px solid ${COLOR_BORDE[f.estado]}` }}
                                        >
                                            {f.colegio}
                                            {esNuevo && (
                                                <span className="ml-2 align-[1px] text-[10px] font-bold tracking-[0.1em] px-2 py-0.5 rounded-full bg-[rgb(var(--cielo-rgb)/0.2)] text-[rgb(var(--cielo-ink-rgb))]">
                                                    NUEVO
                                                </span>
                                            )}
                                        </td>
                                        <td className="cifra px-3.5 py-3 border-b border-[rgb(var(--tinta-rgb)/0.06)] group-hover:bg-[rgb(var(--tinta-rgb)/0.04)] transition-colors">
                                            {f.reportesMes}
                                        </td>
                                        <td className="cifra px-3.5 py-3 border-b border-[rgb(var(--tinta-rgb)/0.06)] group-hover:bg-[rgb(var(--tinta-rgb)/0.04)] transition-colors">
                                            {f.hoy > 0 ? f.hoy : "—"}
                                        </td>
                                        <td className="px-3.5 py-3 border-b border-[rgb(var(--tinta-rgb)/0.06)] group-hover:bg-[rgb(var(--tinta-rgb)/0.04)] transition-colors">
                                            {f.categoriaTop
                                                ? (ETIQUETAS_CATEGORIA[f.categoriaTop] ?? f.categoriaTop)
                                                : "—"}
                                        </td>
                                        <td className="text-muted px-3.5 py-3 border-b border-[rgb(var(--tinta-rgb)/0.06)] group-hover:bg-[rgb(var(--tinta-rgb)/0.04)] transition-colors">
                                            {formatoUltimo(f.ultimoReporteHaceMin)}
                                        </td>
                                        <td className="px-3.5 py-3 border-b border-[rgb(var(--tinta-rgb)/0.06)] group-hover:bg-[rgb(var(--tinta-rgb)/0.04)] transition-colors">
                                            <span className="inline-flex items-center gap-[7px] font-semibold text-[13px]">
                                                <span className={`punto ${CLASE_PUNTO[f.estado]} anim-pulso`} />
                                                {f.estadoEtiqueta}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
}
