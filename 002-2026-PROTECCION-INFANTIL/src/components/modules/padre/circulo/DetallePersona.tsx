"use client";

/**
 * A-73 (SPEC-367) · "Ver de qué se trata" de una persona.
 *
 * Decisión 3 de Jelkin: las estadísticas (de qué se trata, dónde, cuándo) viven
 * AQUÍ DENTRO, no sueltas en la pantalla principal. Lenguaje de padre: nada de
 * "identificador", "categoría técnica" ni "agregado".
 */
import dynamic from "next/dynamic";
import {
    iniciales,
    nombreVisible,
    textoEstado,
    tonoDeContacto,
    type DetalleContacto,
    type IdentificadorDetalle,
} from "./tipos";

const MapaUbicaciones = dynamic(
    () => import("@/components/modules/MapaUbicaciones").then((m) => m.MapaUbicaciones),
    { ssr: false }
);

type Props = {
    detalle: DetalleContacto;
    guardando: boolean;
    onCerrar: () => void;
    onCambiarDato: (identificador: IdentificadorDetalle, activo: boolean) => void;
};

function mesLegible(mes: string): string {
    // `mes` viene como "2026-08"; se muestra "ago 2026" sin inventar día.
    const [ano, m] = mes.split("-");
    const fecha = new Date(Number(ano), Number(m) - 1, 1);
    if (Number.isNaN(fecha.getTime())) return mes;
    return fecha.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
}

export function DetallePersona({ detalle, guardando, onCerrar, onCambiarDato }: Props) {
    const nombre = nombreVisible(detalle);
    const tono = tonoDeContacto(detalle);
    const a = detalle.agregado;
    const puntos = (a?.ubicaciones ?? [])
        .filter((u) => u.lat !== null && u.lng !== null)
        .map((u) => ({ lat: u.lat as number, lng: u.lng as number, label: u.ciudad || u.pais, total: u.total }));
    const sinUbicacion = (a?.ubicaciones ?? []).filter((u) => u.lat === null || u.lng === null)
        .reduce((s, u) => s + u.total, 0);
    const grupos = (a?.porGrupoCategoria ?? []).filter((g) => g.total > 0);
    const maxGrupo = Math.max(1, ...grupos.map((g) => g.total));
    const meses = a?.timeline ?? [];
    const maxMes = Math.max(1, ...meses.map((m) => m.total));

    return (
        <section
            aria-labelledby="detalle-titulo"
            className="flex flex-col gap-5 rounded-2xl border border-tinta/10 bg-white p-5 shadow-sm dark:bg-tinta/20"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span
                        aria-hidden="true"
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold ${
                            tono === "ambar" ? "bg-ambar/15 text-ambar ring-2 ring-ambar" : "bg-pino/15 text-pino"
                        }`}
                    >
                        {iniciales(nombre)}
                    </span>
                    <div>
                        <h2 id="detalle-titulo" className="text-xl font-semibold text-body">
                            {nombre}
                        </h2>
                        <p className="text-sm text-muted">
                            {detalle.parentesco ? `${detalle.parentesco} · ` : ""}
                            {textoEstado(detalle)}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onCerrar}
                    aria-label="Cerrar"
                    className="rounded-lg p-1.5 text-muted transition hover:bg-papel hover:text-body"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                </button>
            </div>

            {!a || a.totalReportes === 0 ? (
                <p className="rounded-xl bg-pino/8 px-4 py-3 text-sm text-muted">
                    Nadie ha reportado a {nombre}. Si eso cambia, te avisamos al correo.
                </p>
            ) : (
                <>
                    <p className="rounded-xl bg-ambar/10 px-4 py-3 text-sm text-body">
                        <b className="font-semibold">
                            {a.totalReportes} {a.totalReportes === 1 ? "reporte" : "reportes"}
                        </b>{" "}
                        {a.totalReportes === 1 ? "menciona" : "mencionan"} sus datos.{" "}
                        {detalle.estado === "enRevision"
                            ? "Una persona del equipo lo está revisando."
                            : "Ya está procesado."}
                    </p>

                    {grupos.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-semibold text-body">De qué se trata</h3>
                            <ul className="flex flex-col gap-1.5">
                                {grupos.map((g) => (
                                    <li key={g.clave} className="flex items-center gap-3">
                                        <span className="w-40 shrink-0 truncate text-sm text-muted">{g.nombre}</span>
                                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-papel">
                                            <span
                                                className="block h-full rounded-full bg-ambar"
                                                style={{ width: `${(g.total / maxGrupo) * 100}%` }}
                                            />
                                        </span>
                                        <span className="w-6 shrink-0 text-right text-sm font-semibold text-body">{g.total}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {meses.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-semibold text-body">Cuándo</h3>
                            <ul className="flex items-end gap-1.5" aria-label="Reportes por mes">
                                {meses.map((m) => (
                                    <li key={m.mes} className="flex flex-1 flex-col items-center gap-1">
                                        <span
                                            className="w-full rounded-t bg-pino/70"
                                            style={{ height: `${Math.max(4, (m.total / maxMes) * 56)}px` }}
                                            title={`${mesLegible(m.mes)}: ${m.total}`}
                                        />
                                        <span className="text-[11px] text-muted">{mesLegible(m.mes)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {puntos.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-semibold text-body">Dónde</h3>
                            <div className="overflow-hidden rounded-xl border border-tinta/10">
                                <MapaUbicaciones puntos={puntos} sinUbicacion={sinUbicacion} />
                            </div>
                        </div>
                    )}
                </>
            )}

            <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-body">Sus datos en internet</h3>
                <ul className="flex flex-col gap-2">
                    {detalle.identificadores.map((i) => (
                        <li
                            key={i.id}
                            className="flex flex-wrap items-center gap-2 rounded-xl bg-papel px-3 py-2 text-sm"
                        >
                            <span className={i.activo ? "text-body" : "text-muted"}>
                                <b className="font-semibold">{i.valor}</b>
                                {i.plataforma && <span className="text-muted"> · {i.plataforma.nombre}</span>}
                            </span>
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    !i.activo
                                        ? "bg-tinta/10 text-muted"
                                        : i.estado === "sinReportes"
                                            ? "bg-pino/12 text-pino"
                                            : "bg-ambar/15 text-ambar"
                                }`}
                            >
                                {!i.activo ? "En pausa" : i.estado === "sinReportes" ? "Sin reportes" : `${i.totalReportes}`}
                            </span>
                            <button
                                type="button"
                                disabled={guardando}
                                onClick={() => onCambiarDato(i, !i.activo)}
                                className="ml-auto rounded-lg px-2 py-1 text-sm font-semibold text-pino transition hover:bg-pino/10 disabled:opacity-50"
                            >
                                {i.activo ? "Pausar este dato" : "Reanudar este dato"}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
