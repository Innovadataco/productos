"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Tabla, TablaHead, TablaBody } from "@/components/ui/Tabla";
import { Cargando } from "@/components/ui/Cargando";

type EstadoRun = "PENDIENTE" | "EN_PROGRESO" | "COMPLETADA" | "FALLIDA" | "CANCELADA";
type Escenario = "robot_inundando" | "ataque_coordinado" | "bot_ips_rotativas" | "denunciante_spam" | "personalizado";

type RunDetalle = {
    id: string;
    escenario: Escenario;
    estado: EstadoRun;
    n: number;
    totalEsperado: number;
    totalEnviados: number;
    totalBloqueados: number;
    totalSpam: number;
    latenciaPromedioMs: number;
    latenciaP50Ms: number;
    latenciaP95Ms: number;
    ipInyectada: string | null;
    identificador: string | null;
    plataforma: string | null;
    usuarioId: string | null;
    descripcionEscenario: string;
    creadoEn: string;
    actualizadoEn: string;
    detalles: Array<{
        idx: number;
        ip: string;
        identificador: string;
        status: number;
        latenciaMs: number;
        estado: string;
    }>;
};

interface DetalleModalProps {
    run: RunDetalle | null;
    isOpen: boolean;
    onClose: () => void;
    onRepetir: () => void;
    onCancelar: () => void;
    isLoading: boolean;
}

export function AdminAntiAbusoSimuladorDetalleModal({
    run,
    isOpen,
    onClose,
    onRepetir,
    onCancelar,
    isLoading,
}: DetalleModalProps) {
    const [mostrarDetalles, setMostrarDetalles] = useState(false);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Detalle de la simulación" size="xl">
            {isLoading || !run ? (
                <Cargando texto="Cargando detalle..." />
            ) : (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-body">¿Qué probó este escenario?</h3>
                        <p className="mt-1 text-sm text-body">{run.descripcionEscenario}</p>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-body">Configuración usada</h3>
                        <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                            <div className="flex justify-between sm:block">
                                <dt className="text-muted">Escenario</dt>
                                <dd className="font-medium">{run.escenario}</dd>
                            </div>
                            <div className="flex justify-between sm:block">
                                <dt className="text-muted">N</dt>
                                <dd className="font-medium">{run.n}</dd>
                            </div>
                            <div className="flex justify-between sm:block">
                                <dt className="text-muted">IP</dt>
                                <dd className="font-medium">{run.ipInyectada ?? "—"}</dd>
                            </div>
                            <div className="flex justify-between sm:block">
                                <dt className="text-muted">Identificador</dt>
                                <dd className="font-medium">{run.identificador ?? "—"}</dd>
                            </div>
                            <div className="flex justify-between sm:block">
                                <dt className="text-muted">Plataforma</dt>
                                <dd className="font-medium">{run.plataforma ?? "—"}</dd>
                            </div>
                            {run.usuarioId && (
                                <div className="flex justify-between sm:block">
                                    <dt className="text-muted">Usuario PARENT</dt>
                                    <dd className="font-medium">{run.usuarioId}</dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-body">Resultado</h3>
                        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="glass rounded-xl p-3">
                                <p className="text-xs text-muted">Total intentados</p>
                                <p className="text-xl font-semibold text-body">{run.totalEsperado}</p>
                            </div>
                            <div className="glass rounded-xl p-3">
                                <p className="text-xs text-muted">Aceptados (201)</p>
                                <p className="text-xl font-semibold text-body">{run.totalEnviados}</p>
                                <p className="text-xs text-muted">reportes aceptados y encolados</p>
                            </div>
                            <div className="glass rounded-xl p-3">
                                <p className="text-xs text-muted">Bloqueados (429)</p>
                                <p className="text-xl font-semibold text-body">{run.totalBloqueados}</p>
                                <p className="text-xs text-muted">rate-limit rechazó (esperado si supera cuota)</p>
                            </div>
                            <div className="glass rounded-xl p-3">
                                <p className="text-xs text-muted">POSIBLE_SPAM</p>
                                <p className="text-xl font-semibold text-body">{run.totalSpam}</p>
                                <p className="text-xs text-muted">detectados por filtro de PII</p>
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="glass rounded-xl p-3">
                                <p className="text-xs text-muted">Latencia promedio</p>
                                <p className="text-lg font-semibold text-body">{run.latenciaPromedioMs} ms</p>
                            </div>
                            <div className="glass rounded-xl p-3">
                                <p className="text-xs text-muted">Latencia p50</p>
                                <p className="text-lg font-semibold text-body">{run.latenciaP50Ms} ms</p>
                            </div>
                            <div className="glass rounded-xl p-3">
                                <p className="text-xs text-muted">Latencia p95</p>
                                <p className="text-lg font-semibold text-body">{run.latenciaP95Ms} ms</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <Button variant="outline" onClick={() => setMostrarDetalles((v) => !v)}>
                            {mostrarDetalles ? "Ocultar detalle por reporte" : "Ver detalle por reporte"}
                        </Button>
                        {mostrarDetalles && (
                            <div className="mt-3 max-h-80 overflow-auto">
                                <Tabla aria-label="Detalle por reporte simulado" sinContenedor>
                                    <TablaHead>
                                        <tr>
                                            <th className="px-3 py-2">#</th>
                                            <th className="px-3 py-2">IP</th>
                                            <th className="px-3 py-2">Identificador</th>
                                            <th className="px-3 py-2">Status</th>
                                            <th className="px-3 py-2">Latencia</th>
                                            <th className="px-3 py-2">Estado</th>
                                        </tr>
                                    </TablaHead>
                                    <TablaBody>
                                        {run.detalles.map((d) => (
                                            <tr key={d.idx}>
                                                <td className="px-3 py-2">{d.idx + 1}</td>
                                                <td className="px-3 py-2 font-mono text-xs">{d.ip}</td>
                                                <td className="px-3 py-2">{d.identificador}</td>
                                                <td className="px-3 py-2">{d.status}</td>
                                                <td className="px-3 py-2">{d.latenciaMs} ms</td>
                                                <td className="px-3 py-2">{d.estado}</td>
                                            </tr>
                                        ))}
                                    </TablaBody>
                                </Tabla>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button onClick={onRepetir}>Repetir con NUEVA sugerencia</Button>
                        {run.estado === "EN_PROGRESO" && (
                            <Button variant="danger" onClick={onCancelar}>
                                Cancelar
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </Modal>
    );
}
