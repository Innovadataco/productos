"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ColegioLineaTiempo } from "./ColegioLineaTiempo";

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
    actividadReportesCruzada?: {
        total: number;
        porEstado: Record<string, number>;
        casosAbiertos: number;
        ultimaActividad: string | null;
        rango: { desde: string; hasta: string; periodoDias: number };
    };
    // SPEC-311 (002-PI-210 · Fase 2): 4 bloques aditivos.
    distribucionRol?: { padre: number; estudiante: number; profesor: number; anonimo: number };
    operadoresAsignados?: Array<{ id: string; nombre: string; email: string }>;
    lineaTiempo?: {
        fechaRegistro: string;
        primerReporte: string | null;
        picoActividad: { anioMes: string; total: number } | null;
        hoy: string;
    };
    serieMensual?: Array<{ anioMes: string; total: number }>;
};

function fechaCorta(iso: string): string {
    return new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "short", day: "numeric" });
}

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

// SPEC-311 (002-PI-210 · Fase 2): semáforo con ícono + texto (nunca solo color · contraste AA).
function badgeSemaforo(semaforo: "verde" | "amarillo" | "rojo") {
    const variant = semaforo === "verde" ? "success" : semaforo === "rojo" ? "danger" : "warning";
    const icono = semaforo === "verde" ? "🟢" : semaforo === "rojo" ? "🔴" : "🟡";
    const texto = semaforo === "verde" ? "Al día" : semaforo === "rojo" ? "Requiere acción" : "Requiere mirada";
    return (
        <Badge variant={variant}>
            <span aria-hidden="true">{icono}</span> {texto}
        </Badge>
    );
}

// SPEC-311 (002-PI-210 · Fase 2 · Bloque A): motivo breve del hallazgo negativo con mayor peso.
function primerMotivo(hallazgos: { negativos: string[] }): string | null {
    return hallazgos.negativos[0] ?? null;
}

export function ColegioDetalleSecciones({ detalle }: { detalle: Detalle }) {
    const { infoBasica, metricasTamaño, actividadReportes, comite, alertas, hallazgos, comparacionMedia } = detalle;
    const actividadCruzada = detalle.actividadReportesCruzada;
    const distribucionRol = detalle.distribucionRol;
    const operadoresAsignados = detalle.operadoresAsignados ?? [];
    const lineaTiempo = detalle.lineaTiempo;
    const serieMensual = detalle.serieMensual;
    const motivo = hallazgos.semaforo === "verde" ? null : primerMotivo(hallazgos);
    const totalRango = actividadCruzada?.total ?? 0;
    const casosAbiertos = actividadCruzada?.casosAbiertos ?? 0;
    const procesadoPct =
        actividadCruzada && actividadCruzada.total > 0
            ? Math.round(
                ((actividadCruzada.total -
                      (actividadCruzada.porEstado.PENDIENTE ?? 0) -
                      (actividadCruzada.porEstado.REVISION_MANUAL ?? 0)) /
                      actividadCruzada.total) *
                      100
            )
            : 0;

    return (
        <div className="space-y-6">
            {/* ================ BLOQUE A · ¿QUÉ PASA AQUÍ HOY? ================ */}
            <GlassCard>
                <div className="mb-4 flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-body">A. ¿Qué pasa aquí hoy?</h2>
                    {badgeSemaforo(hallazgos.semaforo)}
                    {motivo && <span className="text-sm text-muted">↳ {motivo}</span>}
                </div>
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-papel/50 p-4">
                        <p className="text-3xl font-bold text-body">{casosAbiertos}</p>
                        <p className="text-xs text-muted">Casos abiertos</p>
                    </div>
                    <div className="rounded-xl bg-papel/50 p-4">
                        <p className="text-3xl font-bold text-body">{totalRango}</p>
                        <p className="text-xs text-muted">
                            Reportes{" "}
                            {actividadCruzada ? `(últimos ${actividadCruzada.rango.periodoDias} días)` : ""}
                        </p>
                    </div>
                    <div className="rounded-xl bg-papel/50 p-4">
                        <p className="text-3xl font-bold text-body">{procesadoPct}%</p>
                        <p className="text-xs text-muted">Procesados</p>
                    </div>
                </div>
                <div className="mb-4 flex flex-wrap gap-3">
                    <a
                        href="#actividad"
                        className="rounded-lg border border-tinta/20 bg-papel/70 px-4 py-2 text-sm text-body hover:bg-tinta/5 dark:border-tinta/30 dark:bg-papel/70 dark:hover:bg-tinta/10"
                    >
                        Ver casos abiertos
                    </a>
                    <a
                        href="#alertas"
                        className="rounded-lg border border-tinta/20 bg-papel/70 px-4 py-2 text-sm text-body hover:bg-tinta/5 dark:border-tinta/30 dark:bg-papel/70 dark:hover:bg-tinta/10"
                    >
                        Ver alertas
                    </a>
                </div>
                <div>
                    <p className="mb-2 text-sm font-medium text-body">Operadores asignados</p>
                    {operadoresAsignados.length === 0 ? (
                        <p className="text-sm text-muted">Sin operadores asignados</p>
                    ) : (
                        <ul className="space-y-1 text-sm text-muted">
                            {operadoresAsignados.map((op) => (
                                <li key={op.id}>
                                    <span className="text-body font-medium">{op.nombre}</span>
                                    <span className="ml-2 text-subtle">· {op.email}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </GlassCard>

            {/* ================ BLOQUE B · CÓMO SE COMPORTA ================ */}
            <GlassCard>
                <h2 id="actividad" className="mb-3 text-lg font-semibold text-body">
                    B. Cómo se comporta
                </h2>
                {(!actividadCruzada || actividadCruzada.total === 0) && (!serieMensual || serieMensual.length === 0) ? (
                    <EmptyState
                        title="Aún no hay actividad registrada"
                        description="Sin reportes que pertenezcan al colegio en el período."
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        <div>
                            <h3 className="mb-2 text-sm font-medium text-body">Reportes por mes</h3>
                            {serieMensual && serieMensual.length > 0 ? (
                                <BarrasSimples data={serieMensual.map((s) => ({ label: s.anioMes, valor: s.total }))} />
                            ) : (
                                <p className="text-sm text-muted">Sin serie mensual</p>
                            )}
                        </div>
                        <div>
                            <h3 className="mb-2 text-sm font-medium text-body">Por estado</h3>
                            {actividadCruzada && Object.keys(actividadCruzada.porEstado).length > 0 ? (
                                <BarrasSimples
                                    data={Object.entries(actividadCruzada.porEstado).map(([estado, n]) => ({
                                        label: estado,
                                        valor: n,
                                    }))}
                                />
                            ) : (
                                <p className="text-sm text-muted">Sin distribución</p>
                            )}
                        </div>
                        <div>
                            <h3 className="mb-2 text-sm font-medium text-body">Quién reporta</h3>
                            {distribucionRol ? (
                                <BarrasSimples
                                    data={[
                                        { label: "Padres", valor: distribucionRol.padre },
                                        { label: "Estudiantes", valor: distribucionRol.estudiante },
                                        { label: "Profesores", valor: distribucionRol.profesor },
                                        { label: "Anónimos", valor: distribucionRol.anonimo },
                                    ]}
                                />
                            ) : (
                                <p className="text-sm text-muted">Sin distribución por rol</p>
                            )}
                        </div>
                    </div>
                )}
                {actividadReportes.topIdentificadores.length > 0 && (
                    <div className="mt-6">
                        <h3 className="mb-2 text-sm font-medium text-body">Top 5 identificadores</h3>
                        <ul className="space-y-2 text-sm">
                            {actividadReportes.topIdentificadores.map((t) => (
                                <li key={t.identificador} className="flex justify-between">
                                    <span className="text-muted">
                                        {t.identificador} <span className="text-subtle">({t.plataforma})</span>
                                    </span>
                                    <span className="font-medium text-body">{t.total}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </GlassCard>

            {/* ================ BLOQUE C · LÍNEA DE TIEMPO ================ */}
            <GlassCard>
                <h2 className="mb-3 text-lg font-semibold text-body">C. Línea de tiempo (desde el ingreso)</h2>
                {lineaTiempo ? (
                    <ColegioLineaTiempo lineaTiempo={lineaTiempo} />
                ) : (
                    <p className="text-sm text-muted">Línea de tiempo no disponible.</p>
                )}
            </GlassCard>

            {/* ================ BLOQUE D · FICHA Y CONTEXTO ================ */}
            <GlassCard>
                <h2 className="mb-4 text-lg font-semibold text-body">D. Ficha y contexto</h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <section>
                        <h3 className="mb-2 text-sm font-medium text-body">Información básica</h3>
                        <dl className="space-y-2 text-sm">
                            <div className="flex justify-between"><dt className="text-muted">Nombre</dt><dd className="text-body font-medium">{infoBasica.nombre}</dd></div>
                            <div className="flex justify-between"><dt className="text-muted">Tipo de periodo</dt><dd className="text-body">{infoBasica.tipoPeriodo}</dd></div>
                            <div className="flex justify-between"><dt className="text-muted">Ubicación</dt><dd className="text-body">{infoBasica.ciudad}{infoBasica.departamento ? `, ${infoBasica.departamento}` : ""}</dd></div>
                            <div className="flex justify-between"><dt className="text-muted">Dirección</dt><dd className="text-body">{infoBasica.direccion || "—"}</dd></div>
                            <div className="flex justify-between"><dt className="text-muted">Registro</dt><dd className="text-body">{fechaCorta(infoBasica.fechaRegistro)}</dd></div>
                            <div className="flex justify-between"><dt className="text-muted">Contacto rector</dt><dd className="text-body">{infoBasica.contactoRector ? `${infoBasica.contactoRector.nombre} · ${infoBasica.contactoRector.email}` : "—"}</dd></div>
                        </dl>
                    </section>

                    <section>
                        <h3 className="mb-2 text-sm font-medium text-body">Métricas de tamaño</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-papel/50 p-3">
                                <p className="text-xl font-bold text-body">{metricasTamaño.alumnos}</p>
                                <p className="text-xs text-muted">Alumnos activos</p>
                            </div>
                            <div className="rounded-xl bg-papel/50 p-3">
                                <p className="text-xl font-bold text-body">{metricasTamaño.profesores}</p>
                                <p className="text-xs text-muted">Profesores activos</p>
                            </div>
                            <div className="rounded-xl bg-papel/50 p-3">
                                <p className="text-xl font-bold text-body">{metricasTamaño.cursos}</p>
                                <p className="text-xs text-muted">Cursos activos</p>
                            </div>
                            <div className="rounded-xl bg-papel/50 p-3">
                                <p className="text-xl font-bold text-body">{metricasTamaño.materias}</p>
                                <p className="text-xs text-muted">Materias activas</p>
                            </div>
                        </div>
                    </section>
                </div>

                <section className="mt-6">
                    <h3 className="mb-2 text-sm font-medium text-body">Comité de Convivencia</h3>
                    <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                        <div><dt className="text-muted">Integrantes activos</dt><dd className="text-body">{comite.integrantesActivos}</dd></div>
                        <div><dt className="text-muted">Casos escalados</dt><dd className="text-body">{comite.casosEscalados}</dd></div>
                        <div><dt className="text-muted">Casos resueltos</dt><dd className="text-body">{comite.casosResueltos}</dd></div>
                        <div><dt className="text-muted">Tiempo promedio</dt><dd className="text-body">{comite.tiempoPromedioResolucionHoras !== null ? `${Math.round(comite.tiempoPromedioResolucionHoras)} h` : "—"}</dd></div>
                    </dl>
                    {comite.ultimosCasos.length > 0 && (
                        <div className="mt-3">
                            <p className="mb-1 text-xs font-medium text-body">Últimos casos</p>
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
                </section>

                <section id="alertas" className="mt-6">
                    <h3 className="mb-2 text-sm font-medium text-body">Alertas del colegio</h3>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                        <div><dt className="text-muted">Total</dt><dd className="text-body">{alertas.total}</dd></div>
                        <div><dt className="text-muted">Resueltas</dt><dd className="text-body">{alertas.resueltas}</dd></div>
                    </dl>
                    {alertas.ultimasAlertas.length > 0 && (
                        <div className="mt-3">
                            <p className="mb-1 text-xs font-medium text-body">Últimas alertas</p>
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
                </section>

                <section className="mt-6">
                    <h3 className="mb-2 text-sm font-medium text-body">Hallazgos</h3>
                    {hallazgos.positivos.length === 0 && hallazgos.negativos.length === 0 ? (
                        <p className="text-sm text-muted">Sin hallazgos destacados.</p>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <p className="mb-1 text-xs font-medium text-estado-pino">Qué está bien</p>
                                <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
                                    {hallazgos.positivos.map((h, i) => (<li key={i}>{h}</li>))}
                                </ul>
                            </div>
                            <div>
                                <p className="mb-1 text-xs font-medium text-estado-rubi">Qué está mal</p>
                                <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
                                    {hallazgos.negativos.map((h, i) => (<li key={i}>{h}</li>))}
                                </ul>
                            </div>
                        </div>
                    )}
                </section>

                <section className="mt-6">
                    <h3 className="mb-2 text-sm font-medium text-body">Comparación con la media</h3>
                    {comparacionMedia.insuficientes ? (
                        <p className="text-sm text-muted">Insuficientes colegios activos para calcular la mediana (&lt; 3).</p>
                    ) : (
                        <div className="space-y-2">
                            {comparacionMedia.metricas.map((m) => (
                                <div key={m.nombre} className="grid grid-cols-3 gap-4 text-sm">
                                    <span className="text-muted">{m.nombre}</span>
                                    <span className="text-body font-medium">{m.valorColegio}</span>
                                    <span className="text-subtle">Mediana: {m.mediana ?? "—"}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </GlassCard>
        </div>
    );
}
