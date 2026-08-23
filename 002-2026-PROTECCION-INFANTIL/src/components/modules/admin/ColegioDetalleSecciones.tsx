"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { fechaCorta } from "@/lib/format/fecha";

type Detalle = {
    id: string;
    infoBasica: {
        nombre: string;
        tipoPeriodo: string;
        ciudad: string;
        departamento: string | null;
        direccion: string | null;
        fechaRegistro: string;
        contactoRector: { nombre: string; email: string } | null;
    };
    metricasTamaño: { alumnos: number; profesores: number; cursos: number; materias: number };
    actividadReportes: {
        serie30Dias: Array<{ fecha: string; total: number }>;
        porClasificacion: Array<{ categoria: string; total: number }>;
        topIdentificadores: Array<{ identificador: string; plataforma: string; total: number }>;
    };
    comite: {
        integrantesActivos: number;
        casosEscalados: number;
        casosResueltos: number;
        tiempoPromedioResolucionHoras: number | null;
        ultimosCasos: Array<{ numero: string; estado: string; creadoEn: string; resueltoEn: string | null }>;
    };
    alertas: {
        total: number;
        resueltas: number;
        ultimasAlertas: Array<{ id: string; estado: string; tipoSujeto: string; creadoEn: string }>;
    };
    hallazgos: { positivos: string[]; negativos: string[]; semaforo: "verde" | "amarillo" | "rojo" };
    comparacionMedia: { metricas: Array<{ nombre: string; valorColegio: number; mediana: number | null }>; insuficientes: boolean };
};

function BarrasSimples({ data }: { data: Array<{ label: string; valor: number }> }) {
    const max = Math.max(1, ...data.map((d) => d.valor));
    return (
        <div className="space-y-2">
            {data.map((d) => (
                <div key={d.label} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 truncate text-xs text-muted">{d.label}</span>
                    <div className="flex-1">
                        <div
                            className="h-4 rounded bg-pino/80"
                            style={{ width: `${Math.max(4, (d.valor / max) * 100)}%` }}
                            title={`${d.valor}`}
                        />
                    </div>
                    <span className="w-8 text-right text-xs text-body">{d.valor}</span>
                </div>
            ))}
        </div>
    );
}

export function ColegioDetalleSecciones({ detalle }: { detalle: Detalle }) {
    const { infoBasica, metricasTamaño, actividadReportes, comite, alertas, hallazgos, comparacionMedia } = detalle;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <GlassCard>
                    <h2 className="mb-3 text-lg font-semibold text-body">1. Información básica</h2>
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between"><dt className="text-muted">Nombre</dt><dd className="text-body font-medium">{infoBasica.nombre}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted">Tipo de periodo</dt><dd className="text-body">{infoBasica.tipoPeriodo}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted">Ubicación</dt><dd className="text-body">{infoBasica.ciudad}{infoBasica.departamento ? `, ${infoBasica.departamento}` : ""}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted">Dirección</dt><dd className="text-body">{infoBasica.direccion || "—"}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted">Registro</dt><dd className="text-body">{fechaCorta(infoBasica.fechaRegistro)}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted">Contacto rector</dt><dd className="text-body">{infoBasica.contactoRector ? `${infoBasica.contactoRector.nombre} · ${infoBasica.contactoRector.email}` : "—"}</dd></div>
                    </dl>
                </GlassCard>

                <GlassCard>
                    <h2 className="mb-3 text-lg font-semibold text-body">2. Métricas de tamaño</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-papel/50 p-4">
                            <p className="text-2xl font-bold text-body">{metricasTamaño.alumnos}</p>
                            <p className="text-xs text-muted">Alumnos activos</p>
                        </div>
                        <div className="rounded-xl bg-papel/50 p-4">
                            <p className="text-2xl font-bold text-body">{metricasTamaño.profesores}</p>
                            <p className="text-xs text-muted">Profesores activos</p>
                        </div>
                        <div className="rounded-xl bg-papel/50 p-4">
                            <p className="text-2xl font-bold text-body">{metricasTamaño.cursos}</p>
                            <p className="text-xs text-muted">Cursos activos</p>
                        </div>
                        <div className="rounded-xl bg-papel/50 p-4">
                            <p className="text-2xl font-bold text-body">{metricasTamaño.materias}</p>
                            <p className="text-xs text-muted">Materias activas</p>
                        </div>
                    </div>
                </GlassCard>
            </div>

            <GlassCard>
                <h2 className="mb-3 text-lg font-semibold text-body">3. Actividad de reportes</h2>
                {actividadReportes.serie30Dias.length === 0 && actividadReportes.porClasificacion.length === 0 ? (
                    <EmptyState title="Sin datos" description="No hay reportes en el periodo analizado." />
                ) : (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div>
                            <h3 className="mb-2 text-sm font-medium text-body">Últimos {actividadReportes.serie30Dias.length} días con datos</h3>
                            <BarrasSimples data={actividadReportes.serie30Dias.map((s) => ({ label: s.fecha.slice(5), valor: s.total }))} />
                        </div>
                        <div>
                            <h3 className="mb-2 text-sm font-medium text-body">Por clasificación</h3>
                            <BarrasSimples data={actividadReportes.porClasificacion.map((c) => ({ label: c.categoria, valor: c.total }))} />
                        </div>
                        <div>
                            <h3 className="mb-2 text-sm font-medium text-body">Top 5 identificadores</h3>
                            {actividadReportes.topIdentificadores.length === 0 ? (
                                <p className="text-sm text-muted">Sin identificadores reportados</p>
                            ) : (
                                <ul className="space-y-2 text-sm">
                                    {actividadReportes.topIdentificadores.map((t) => (
                                        <li key={t.identificador} className="flex justify-between">
                                            <span className="text-muted">{t.identificador} <span className="text-subtle">({t.plataforma})</span></span>
                                            <span className="font-medium text-body">{t.total}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </GlassCard>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <GlassCard>
                    <h2 className="mb-3 text-lg font-semibold text-body">4. Comité de Convivencia</h2>
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between"><dt className="text-muted">Integrantes activos</dt><dd className="text-body">{comite.integrantesActivos}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted">Casos escalados</dt><dd className="text-body">{comite.casosEscalados}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted">Casos resueltos</dt><dd className="text-body">{comite.casosResueltos}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted">Tiempo promedio resolución</dt><dd className="text-body">{comite.tiempoPromedioResolucionHoras !== null ? `${Math.round(comite.tiempoPromedioResolucionHoras)} h` : "—"}</dd></div>
                    </dl>
                    {comite.ultimosCasos.length > 0 && (
                        <div className="mt-4">
                            <h3 className="mb-2 text-sm font-medium text-body">Últimos casos</h3>
                            <ul className="space-y-1 text-sm">
                                {comite.ultimosCasos.map((c) => (
                                    <li key={c.numero} className="flex justify-between text-muted">
                                        <span>{c.numero} · {c.estado}</span>
                                        <span>{fechaCorta(c.creadoEn)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </GlassCard>

                <GlassCard>
                    <h2 className="mb-3 text-lg font-semibold text-body">5. Alertas</h2>
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between"><dt className="text-muted">Total</dt><dd className="text-body">{alertas.total}</dd></div>
                        <div className="flex justify-between"><dt className="text-muted">Resueltas</dt><dd className="text-body">{alertas.resueltas}</dd></div>
                    </dl>
                    {alertas.ultimasAlertas.length > 0 && (
                        <div className="mt-4">
                            <h3 className="mb-2 text-sm font-medium text-body">Últimas alertas</h3>
                            <ul className="space-y-1 text-sm">
                                {alertas.ultimasAlertas.map((a) => (
                                    <li key={a.id} className="flex justify-between text-muted">
                                        <span>{a.tipoSujeto} · {a.estado}</span>
                                        <span>{fechaCorta(a.creadoEn)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </GlassCard>
            </div>

            <GlassCard>
                <div className="mb-3 flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-body">6. Hallazgos</h2>
                    <Badge variant={hallazgos.semaforo === "verde" ? "success" : hallazgos.semaforo === "rojo" ? "danger" : "warning"}>{hallazgos.semaforo}</Badge>
                </div>
                {hallazgos.positivos.length === 0 && hallazgos.negativos.length === 0 ? (
                    <p className="text-sm text-muted">Sin hallazgos destacados.</p>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <h3 className="mb-2 text-sm font-medium text-estado-pino">Qué está bien</h3>
                            <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
                                {hallazgos.positivos.map((h, i) => (<li key={i}>{h}</li>))}
                            </ul>
                        </div>
                        <div>
                            <h3 className="mb-2 text-sm font-medium text-estado-rubi">Qué está mal</h3>
                            <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
                                {hallazgos.negativos.map((h, i) => (<li key={i}>{h}</li>))}
                            </ul>
                        </div>
                    </div>
                )}
            </GlassCard>

            <GlassCard>
                <h2 className="mb-3 text-lg font-semibold text-body">7. Comparación con la media</h2>
                {comparacionMedia.insuficientes ? (
                    <p className="text-sm text-muted">Insuficientes colegios activos para calcular la mediana (&lt; 3).</p>
                ) : (
                    <div className="space-y-3">
                        {comparacionMedia.metricas.map((m) => (
                            <div key={m.nombre} className="grid grid-cols-3 gap-4 text-sm">
                                <span className="text-muted">{m.nombre}</span>
                                <span className="text-body font-medium">{m.valorColegio}</span>
                                <span className="text-subtle">Mediana: {m.mediana ?? "—"}</span>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
