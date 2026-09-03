import type { Reportes360Data, RangoEdad } from "@/lib/bi/reportes360";
import { formatearCategoria } from "@/lib/bi/pulso";
import { fmtMiles } from "@/components/bi/pulso/formatos";
import BarrasHorizontales from "@/components/bi/pulso/BarrasHorizontales";
import EvolucionMensual from "./EvolucionMensual";

/** Etiquetas legibles de los rangos de edad (solo presentación). */
const ETIQUETA_EDAD: Record<RangoEdad, string> = {
    MENOR_13: "Menores de 13",
    EDAD_13_15: "13–15",
    EDAD_16_17: "16–17",
    EDAD_18_MAS: "18 o más",
    SIN_DATO: "Sin dato",
};

/** Nota honesta compartida de los bloques vacíos (candado 9). */
function NotaVacia({ children }: { children: React.ReactNode }) {
    return <p className="py-6 text-center text-[13.5px] text-muted">{children}</p>;
}

/**
 * "Reportes 360" — análisis completo de reportes (pedido del dueño): el
 * universo "Reporte" no eliminado desglosado por categoría de la IA, estado
 * del pipeline, plataforma, anonimato, prioridad alta y edad de la víctima,
 * más la evolución mensual con selector de rango 3/6/12/24. Cada cifra es la
 * del contrato Reportes360Data (candado 10); cada vacío se anuncia con texto
 * honesto (candado 9). Las barras reutilizan el lenguaje visual del sistema
 * (BarrasHorizontales / barra-crece del Pulso y Analítica).
 */
export default function Reportes360({
    datos,
}: {
    datos: Reportes360Data;
}) {
    const sinReportes = datos.totalReportes === 0;
    const totalClasificados = datos.porCategoria
        .filter((c) => c.categoria !== "SIN_CLASIFICAR")
        .reduce((acc, c) => acc + c.total, 0);
    const maxCategoria = Math.max(...datos.porCategoria.map((c) => c.total), 1);

    return (
        <section className="mb-4">
            <h2 className="mb-3 text-[19px] font-semibold">
                Reportes 360 · análisis completo
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
                {/* 1 · Por categoría de la IA (con % sobre el clasificado) */}
                <div className="glass anim-entrada p-6">
                    <h3 className="mb-1 text-[16.5px] font-semibold">Por categoría de la IA</h3>
                    <div className="mb-4 text-[13px] text-muted">
                        {fmtMiles(totalClasificados)} reportes clasificados — el % es sobre ese
                        total
                    </div>
                    {datos.porCategoria.length === 0 || sinReportes ? (
                        <NotaVacia>
                            Aún no hay reportes en la réplica para desglosar por categoría.
                        </NotaVacia>
                    ) : (
                        <div>
                            {datos.porCategoria.map((c, i) => {
                                const categoria = formatearCategoria(c.categoria);
                                return (
                                    <div
                                        key={`${c.categoria}-${i}`}
                                        className="grid grid-cols-[minmax(0,150px)_1fr_52px_48px] items-center gap-2.5 border-b border-[rgb(var(--tinta-rgb)/0.06)] py-2 text-[13px] last:border-b-0"
                                        title={`${categoria}: ${fmtMiles(c.total)} reportes${
                                            c.pctClasificado !== null
                                                ? ` · ${c.pctClasificado}% del clasificado`
                                                : ""
                                        }`}
                                    >
                                        <span className="truncate">{categoria}</span>
                                        <div className="h-5 overflow-hidden rounded-md bg-[rgb(var(--tinta-rgb)/0.06)]">
                                            <div
                                                className="barra-crece-x h-full rounded-md bg-[linear-gradient(to_right,rgb(var(--pino-rgb)),rgb(var(--cielo-rgb)))]"
                                                style={
                                                    {
                                                        width: `${(c.total / maxCategoria) * 100}%`,
                                                        "--anim-retardo": `${i * 50}ms`,
                                                    } as React.CSSProperties
                                                }
                                            />
                                        </div>
                                        <span className="cifra text-right font-semibold">
                                            {fmtMiles(c.total)}
                                        </span>
                                        <span className="cifra text-right text-muted">
                                            {c.pctClasificado !== null ? `${c.pctClasificado}%` : "—"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 2 · Estado del pipeline (sale del dato, no se quema) */}
                <div className="glass anim-entrada p-6">
                    <h3 className="mb-1 text-[16.5px] font-semibold">Estado del pipeline</h3>
                    <div className="mb-4 text-[13px] text-muted">
                        Dónde está cada reporte del flujo de procesamiento
                    </div>
                    {datos.porEstado.length === 0 ? (
                        <NotaVacia>
                            Aún no hay estados que mostrar: la réplica no devolvió reportes.
                        </NotaVacia>
                    ) : (
                        <BarrasHorizontales
                            filas={datos.porEstado.map((e) => ({
                                etiqueta: formatearCategoria(e.estado),
                                total: e.total,
                            }))}
                        />
                    )}
                </div>

                {/* 3 · Edad de la víctima */}
                <div className="glass anim-entrada p-6">
                    <h3 className="mb-1 text-[16.5px] font-semibold">Edad de la víctima</h3>
                    <div className="mb-4 text-[13px] text-muted">
                        Rangos de edad declarados en el reporte
                    </div>
                    {sinReportes ? (
                        <NotaVacia>
                            Aún no hay reportes en la réplica para desglosar por edad.
                        </NotaVacia>
                    ) : (
                        <BarrasHorizontales
                            filas={datos.porEdad.map((e) => ({
                                etiqueta: ETIQUETA_EDAD[e.rango],
                                total: e.total,
                                acento: e.rango === "SIN_DATO" ? "subtle" : undefined,
                            }))}
                        />
                    )}
                </div>

                {/* 4 · Top de plataformas */}
                <div className="glass anim-entrada p-6">
                    <h3 className="mb-1 text-[16.5px] font-semibold">Plataformas</h3>
                    <div className="mb-4 text-[13px] text-muted">
                        Top {datos.porPlataforma.length} por volumen de reportes
                    </div>
                    {datos.porPlataforma.length === 0 ? (
                        <NotaVacia>
                            Aún no hay plataformas con reportes en la réplica.
                        </NotaVacia>
                    ) : (
                        <BarrasHorizontales
                            filas={datos.porPlataforma.map((p) => ({
                                etiqueta: p.plataforma,
                                total: p.total,
                            }))}
                        />
                    )}
                </div>

                {/* 5 · Anonimato + prioridad alta */}
                <div className="glass anim-entrada p-6">
                    <h3 className="mb-1 text-[16.5px] font-semibold">Anonimato y prioridad</h3>
                    <div className="mb-4 text-[13px] text-muted">
                        Quién reporta y cuántos llegan marcados de prioridad alta
                    </div>
                    {sinReportes ? (
                        <NotaVacia>
                            Aún no hay reportes para distinguir quién reporta ni cuántos son de
                            prioridad alta.
                        </NotaVacia>
                    ) : (
                        <>
                            <div
                                className="flex h-[26px] overflow-hidden rounded-full"
                                role="img"
                                aria-label={`Anónimos ${fmtMiles(datos.anonimato.anonimos)}, autenticados ${fmtMiles(datos.anonimato.autenticados)}`}
                            >
                                <div
                                    className="barra-crece-x bg-[rgb(var(--cielo-rgb))]"
                                    style={{
                                        width: `${
                                            (datos.anonimato.anonimos / datos.totalReportes) * 100
                                        }%`,
                                    }}
                                />
                                <div
                                    className="barra-crece-x bg-[rgb(var(--ambar-rgb))]"
                                    style={{
                                        width: `${
                                            (datos.anonimato.autenticados / datos.totalReportes) * 100
                                        }%`,
                                        transformOrigin: "right",
                                    }}
                                />
                            </div>
                            <div className="mt-2.5 flex justify-between text-[13px]">
                                <span>
                                    Anónimos{" "}
                                    <b className="cifra font-semibold">
                                        {fmtMiles(datos.anonimato.anonimos)}
                                    </b>
                                    {datos.anonimato.pctAnonimos !== null && (
                                        <span className="text-muted">
                                            {" "}
                                            · {datos.anonimato.pctAnonimos}%
                                        </span>
                                    )}
                                </span>
                                <span>
                                    Autenticados{" "}
                                    <b className="cifra font-semibold">
                                        {fmtMiles(datos.anonimato.autenticados)}
                                    </b>
                                </span>
                            </div>
                            <div className="mt-4 border-t border-[rgb(var(--tinta-rgb)/0.06)] pt-3 text-[13px]">
                                Prioridad alta:{" "}
                                <b
                                    className={`cifra font-semibold ${
                                        datos.prioridadAlta.total > 0
                                            ? "text-estado-rubi"
                                            : "text-body"
                                    }`}
                                >
                                    {fmtMiles(datos.prioridadAlta.total)}
                                </b>
                                {datos.prioridadAlta.pct !== null && (
                                    <span className="text-muted">
                                        {" "}
                                        · {datos.prioridadAlta.pct}% del total
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* 6 · Evolución mensual con selector de rango (cliente, ancho completo) */}
                <div className="glass anim-entrada p-6 lg:col-span-2">
                    <EvolucionMensual serie={datos.evolucionMensual} />
                </div>
            </div>
        </section>
    );
}
