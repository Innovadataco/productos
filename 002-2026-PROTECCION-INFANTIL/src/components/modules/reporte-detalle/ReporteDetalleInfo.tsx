"use client";

import type { DetalleReporte } from "./types";
import { formatCategoria, formatEstado } from "./types";
import { fechaHoraSinMinutos } from "@/lib/format/fecha";

interface ReporteDetalleInfoProps {
    reporte: DetalleReporte;
}

export function ReporteDetalleInfo({ reporte }: ReporteDetalleInfoProps) {
    return (
        <div className="space-y-4 text-sm text-body">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <span className="font-medium text-subtle">Número de seguimiento</span>
                    <p>{reporte.numeroSeguimiento}</p>
                </div>
                <div>
                    <span className="font-medium text-subtle">Estado</span>
                    <p>{formatEstado(reporte.estado)}</p>
                </div>
                <div>
                    <span className="font-medium text-subtle">Plataforma</span>
                    <p>{reporte.plataforma.nombre}</p>
                </div>
                <div>
                    <span className="font-medium text-subtle">Identificador</span>
                    <p>{reporte.identificador}</p>
                </div>
                <div>
                    <span className="font-medium text-subtle">Ubicación</span>
                    <p>{reporte.ciudad}, {reporte.pais}</p>
                </div>
                <div>
                    <span className="font-medium text-subtle">Fecha del incidente</span>
                    {/* I-261 (SPEC-368): misma presentación que ve el padre — día y
                        hora en a.m./p.m., SIN minutos. Antes esta vista mostraba
                        solo la fecha, con un formateador propio; el minuto exacto
                        de un hecho no se conoce y fingirlo es peor (G20). */}
                    <p>{fechaHoraSinMinutos(reporte.fechaIncidente)}</p>
                </div>
                <div>
                    <span className="font-medium text-subtle">Origen</span>
                    <p>{reporte.esAnonimo ? "Anónimo" : "Autenticado"}</p>
                </div>
                <div>
                    <span className="font-medium text-subtle">Recibido</span>
                    <p>{new Date(reporte.creadoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</p>
                </div>
            </div>

            {reporte.clasificacion && (
                <div className="rounded-lg border border-tinta/10 p-4">
                    <h3 className="mb-2 font-medium text-body">Clasificación IA</h3>
                    <p><span className="text-subtle">Categoría:</span> {formatCategoria(reporte.clasificacion.categoria)}</p>
                    <p><span className="text-subtle">Confianza:</span> {(reporte.clasificacion.confianza * 100).toFixed(1)}%</p>
                    <p><span className="text-subtle">Modelo:</span> {reporte.clasificacion.modeloUsado}</p>
                    {reporte.clasificacion.posibleAgresorPar && (
                        <p className="text-estado-cielo">Posible agresor par / adolescente</p>
                    )}
                    {reporte.clasificacion.categoriasSecundarias && reporte.clasificacion.categoriasSecundarias.length > 0 && (
                        <div className="mt-2">
                            <p className="text-subtle">Categorías secundarias:</p>
                            <ul className="list-disc pl-5">
                                {reporte.clasificacion.categoriasSecundarias.map((c) => (
                                    <li key={c.categoria}>
                                        {formatCategoria(c.categoria)} ({(c.score * 100).toFixed(1)}%)
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {reporte.clasificacion.contienePii && (
                        <p className="text-estado-ambar">Contiene datos personales</p>
                    )}
                </div>
            )}

            {(reporte.prioridadAlta || reporte.esRafaga) && (
                <div className="rounded-lg border border-rubi/20 bg-rubi/5 p-4">
                    <div className="flex flex-wrap gap-2 mb-2">
                        {reporte.prioridadAlta && (
                            <span className="rounded-full bg-rubi/10 px-2 py-0.5 text-xs font-medium text-estado-rubi">
                                Prioridad alta
                            </span>
                        )}
                        {reporte.esRafaga && (
                            <span className="rounded-full bg-rubi/10 px-2 py-0.5 text-xs font-medium text-estado-rubi">
                                Ráfaga
                            </span>
                        )}
                    </div>
                    {reporte.keywordsDetectadas && reporte.keywordsDetectadas.length > 0 && (
                        <p><span className="text-subtle">Términos detectados:</span> {reporte.keywordsDetectadas.join(", ")}</p>
                    )}
                </div>
            )}

            {reporte.reintentos && reporte.reintentos.length > 0 && (
                <div className="rounded-lg border border-tinta/10 p-4">
                    <h3 className="mb-2 font-medium text-body">Historial de intentos de procesamiento</h3>
                    <ul className="space-y-2 text-sm">
                        {reporte.reintentos.map((r) => (
                            <li key={r.id} className="flex flex-col gap-1 rounded-md bg-tinta/5 p-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-subtle">Intento #{r.intento}</span>
                                    {r.exitoso ? (
                                        <span className="rounded-full bg-pino/10 px-2 py-0.5 text-xs font-medium text-estado-pino">
                                            Éxito
                                        </span>
                                    ) : (
                                        <span className="rounded-full bg-rubi/10 px-2 py-0.5 text-xs font-medium text-estado-rubi">
                                            Fallo
                                        </span>
                                    )}
                                </div>
                                {r.error && <p className="text-estado-rubi text-xs">{r.error}</p>}
                                <p className="text-xs text-subtle">{new Date(r.creadoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {reporte.clasificacion?.correccion && (
                <div className="rounded-lg border border-cielo/20 bg-cielo/10 p-4">
                    <h3 className="mb-2 font-medium text-estado-cielo">Corrección registrada</h3>
                    <p><span className="text-subtle">Categoría original:</span> {formatCategoria(reporte.clasificacion.correccion.categoriaOriginal)}</p>
                    <p><span className="text-subtle">Categoría corregida:</span> {formatCategoria(reporte.clasificacion.correccion.categoriaCorregida)}</p>
                    {reporte.clasificacion.correccion.motivo && <p><span className="text-subtle">Motivo:</span> {reporte.clasificacion.correccion.motivo}</p>}
                </div>
            )}

            <div>
                <h3 className="mb-1 font-medium text-body">Texto actual</h3>
                <p className="whitespace-pre-wrap rounded-lg glass-input p-3">{reporte.texto}</p>
            </div>
        </div>
    );
}
