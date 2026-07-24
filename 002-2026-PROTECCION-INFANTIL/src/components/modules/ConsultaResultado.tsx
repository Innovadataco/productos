"use client";

import { ScoreDisplay } from "./ScoreDisplay";
import { formatPlataforma } from "@/lib/plataforma";

type Ubicacion = { pais: string; ciudad: string; fecha: string };
type CategoriaItem = { categoria: string; cantidad: number };
type TimelineItem = { mes: string; cantidad: number };
type Distribucion = { porCiudad: Record<string, number>; porPais: Record<string, number> };

type Resultado = {
    identificador: string;
    plataformas?: { id: string; nombre: string; clave?: string; otraPlataforma?: string | null; total: number }[];
    tieneReportes: boolean;
    totalReportes?: number;
    reportesAutenticados?: number;
    reportesAnonimos?: number;
    ultimoReporte?: string | null;
    resumen?: string;
    ubicaciones?: Ubicacion[];
    score?: number;
    nivelRiesgo?: "BAJO" | "MEDIO" | "ALTO" | "CRITICO";
    ratioAutenticados?: number;
    categorias?: CategoriaItem[];
    timeline?: TimelineItem[];
    distribucion?: Distribucion;
    mensaje?: string;
};

const CATEGORIA_LABELS: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    OTRO: "Otro",
};

export function ConsultaResultado({ data }: { data: Resultado }) {
    if (!data.tieneReportes) {
        return (
            <div className="glass rounded-2xl p-8 text-center animate-floatUp">
                <p className="text-lg text-muted">{data.mensaje || "Sin reportes registrados para este identificador."}</p>
            </div>
        );
    }

    const estaAutenticado = data.score !== undefined;

    return (
        <div className="glass rounded-2xl p-6 animate-floatUp space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-body">{data.identificador}</h2>
                <div className="flex flex-wrap gap-2">
                    {data.plataformas?.map((p) => (
                        <span
                            key={p.id}
                            className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-accent dark:bg-sky-950/40"
                            title={`${p.total} reportes`}
                        >
                            {formatPlataforma(p.nombre, p.otraPlataforma, p.clave)}
                        </span>
                    ))}
                </div>
            </div>

            <p className="text-sm text-muted">{data.resumen}</p>

            <div className="grid gap-4 sm:grid-cols-3">
                <StatBox label="Total reportes" value={String(data.totalReportes ?? 0)} testId="total-reportes" />
                <StatBox label="Autenticados" value={String(data.reportesAutenticados ?? 0)} testId="reportes-autenticados" />
                <StatBox label="Anónimos" value={String(data.reportesAnonimos ?? 0)} testId="reportes-anonimos" />
            </div>

            {estaAutenticado && (
                <>
                    <ScoreDisplay
                        score={data.score ?? 0}
                        nivelRiesgo={data.nivelRiesgo ?? "BAJO"}
                        ratioAutenticados={data.ratioAutenticados}
                        totalReportes={data.totalReportes}
                        ciudades={data.distribucion ? Object.keys(data.distribucion.porCiudad) : undefined}
                        categoriaPrincipal={
                            data.categorias && data.categorias.length > 0
                                ? (CATEGORIA_LABELS[data.categorias[0].categoria] ?? data.categorias[0].categoria)
                                : undefined
                        }
                    />

                    {data.categorias && data.categorias.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-body mb-3">Clasificaciones de la IA</h3>
                            <div className="space-y-2">
                                {data.categorias.map((c) => (
                                    <div key={c.categoria} className="flex items-center gap-3">
                                        <span className="w-40 text-xs text-muted truncate">
                                            {CATEGORIA_LABELS[c.categoria] || c.categoria}
                                        </span>
                                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-accent rounded-full"
                                                style={{ width: `${Math.min((c.cantidad / (data.totalReportes ?? 1)) * 100, 100)}%` }}
                                            />
                                        </div>
                                        <span className="w-8 text-right text-xs font-medium text-body">{c.cantidad}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {data.timeline && data.timeline.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-body mb-3">Línea de tiempo</h3>
                            <div className="flex items-end gap-2 h-24">
                                {data.timeline.map((t) => {
                                    const max = Math.max(...data.timeline!.map((x) => x.cantidad));
                                    return (
                                        <div key={t.mes} className="flex-1 flex flex-col items-center gap-1">
                                            <div
                                                className="w-full bg-sky-400 dark:bg-cyan-400 rounded-t"
                                                style={{ height: `${max > 0 ? (t.cantidad / max) * 80 : 0}%` }}
                                                title={`${t.mes}: ${t.cantidad}`}
                                            />
                                            <span className="text-[10px] text-subtle rotate-45 origin-left translate-y-2">{t.mes}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            {data.ubicaciones && data.ubicaciones.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-body mb-3">
                        {estaAutenticado ? "Reportes por ubicación" : "Ciudades con reportes"}
                    </h3>
                    <div className="max-h-40 overflow-y-auto rounded-xl bg-white/40 dark:bg-slate-900/40">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-subtle border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-4 py-2 text-left">País</th>
                                    <th className="px-4 py-2 text-left">Ciudad</th>
                                    {estaAutenticado && <th className="px-4 py-2 text-left">Fecha</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {data.ubicaciones.slice(0, estaAutenticado ? 50 : 10).map((u, i) => (
                                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                        <td className="px-4 py-2 text-body">{u.pais}</td>
                                        <td className="px-4 py-2 text-body">{u.ciudad}</td>
                                        {estaAutenticado && <td className="px-4 py-2 text-body">{u.fecha}</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!estaAutenticado && (
                <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 p-3 text-xs text-sky-800 dark:text-sky-200">
                    <strong>¿Quieres ver más detalles?</strong> Inicia sesión para conocer el score de riesgo, clasificaciones de la IA y el timeline completo.
                </div>
            )}

            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-200">
                Esta información es de carácter estadístico y no constituye una verificación de culpabilidad.
            </div>
        </div>
    );
}

function StatBox({ label, value, testId }: { label: string; value: string; testId?: string }) {
    return (
        <div className="rounded-xl bg-white/40 dark:bg-slate-900/40 p-4 text-center" data-testid={testId}>
            <p className="text-2xl font-bold text-accent font-mono">{value}</p>
            <p className="text-xs text-subtle mt-1">{label}</p>
        </div>
    );
}
