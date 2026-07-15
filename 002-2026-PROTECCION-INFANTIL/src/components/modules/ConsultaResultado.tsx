"use client";

import { ScoreDisplay } from "./ScoreDisplay";

type Ubicacion = { pais: string; ciudad: string; fecha: string };
type CategoriaItem = { categoria: string; cantidad: number };
type TimelineItem = { mes: string; cantidad: number };
type Distribucion = { porCiudad: Record<string, number>; porPais: Record<string, number> };

type Resultado = {
    identificador: string;
    plataforma: string;
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
                <p className="text-lg text-slate-600">{data.mensaje || "Sin reportes registrados para este identificador."}</p>
            </div>
        );
    }

    const estaAutenticado = data.score !== undefined;

    return (
        <div className="glass rounded-2xl p-6 animate-floatUp space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">{data.identificador}</h2>
                <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700">
                    {data.plataforma}
                </span>
            </div>

            <p className="text-sm text-slate-700">{data.resumen}</p>

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
                    />

                    {data.categorias && data.categorias.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Clasificaciones de la IA</h3>
                            <div className="space-y-2">
                                {data.categorias.map((c) => (
                                    <div key={c.categoria} className="flex items-center gap-3">
                                        <span className="w-40 text-xs text-slate-600 truncate">
                                            {CATEGORIA_LABELS[c.categoria] || c.categoria}
                                        </span>
                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary-500 rounded-full"
                                                style={{ width: `${Math.min((c.cantidad / (data.totalReportes ?? 1)) * 100, 100)}%` }}
                                            />
                                        </div>
                                        <span className="w-8 text-right text-xs font-medium text-slate-700">{c.cantidad}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {data.timeline && data.timeline.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Línea de tiempo</h3>
                            <div className="flex items-end gap-2 h-24">
                                {data.timeline.map((t) => {
                                    const max = Math.max(...data.timeline!.map((x) => x.cantidad));
                                    return (
                                        <div key={t.mes} className="flex-1 flex flex-col items-center gap-1">
                                            <div
                                                className="w-full bg-primary-400 rounded-t"
                                                style={{ height: `${max > 0 ? (t.cantidad / max) * 80 : 0}%` }}
                                                title={`${t.mes}: ${t.cantidad}`}
                                            />
                                            <span className="text-[10px] text-slate-500 rotate-45 origin-left translate-y-2">{t.mes}</span>
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
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">
                        {estaAutenticado ? "Reportes por ubicación" : "Ciudades con reportes"}
                    </h3>
                    <div className="max-h-40 overflow-y-auto rounded-xl bg-white/50">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-slate-500 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2 text-left">País</th>
                                    <th className="px-4 py-2 text-left">Ciudad</th>
                                    {estaAutenticado && <th className="px-4 py-2 text-left">Fecha</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {data.ubicaciones.slice(0, estaAutenticado ? 50 : 10).map((u, i) => (
                                    <tr key={i} className="border-b border-slate-100 last:border-0">
                                        <td className="px-4 py-2 text-slate-700">{u.pais}</td>
                                        <td className="px-4 py-2 text-slate-700">{u.ciudad}</td>
                                        {estaAutenticado && <td className="px-4 py-2 text-slate-700">{u.fecha}</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!estaAutenticado && (
                <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
                    <strong>¿Quieres ver más detalles?</strong> Inicia sesión para conocer el score de riesgo, clasificaciones de la IA y el timeline completo.
                </div>
            )}

            <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                Esta información es de carácter estadístico y no constituye una verificación de culpabilidad.
            </div>
        </div>
    );
}

function StatBox({ label, value, testId }: { label: string; value: string; testId?: string }) {
    return (
        <div className="rounded-xl bg-white/50 p-4 text-center" data-testid={testId}>
            <p className="text-2xl font-bold text-primary-700 font-mono">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
        </div>
    );
}
