"use client";

/**
 * SPEC-224 (002-PI-125, FR-001/FR-003): tabla del catálogo de reglas del
 * motor de recomendaciones. Columnas: nombre, categoría, modo, frecuencia,
 * estado y recomendaciones generadas en los últimos 7 días; orden por
 * prioridad descendente (lo aplica el servidor). Terminología del brief §3:
 * "Regla", "Recomienda", "Ejecuta sola", "Sugerencia".
 */
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabla, TablaHead, TablaBody } from "@/components/ui/Tabla";

export interface ReglaListItemPanel {
    id: string;
    clave: string;
    nombre: string;
    categoria: string;
    modo: "RECOMIENDA" | "EJECUTA";
    frecuenciaMin: number;
    prioridad: number;
    activa: boolean;
    version: number;
    recomendacionesGeneradas7d: number;
}

interface ReglasTableProps {
    reglas: ReglaListItemPanel[];
    onEditar: (regla: ReglaListItemPanel) => void;
    onHistorial: (regla: ReglaListItemPanel) => void;
    onCambiarModo: (regla: ReglaListItemPanel) => void;
    onToggleActiva: (regla: ReglaListItemPanel) => void;
}

export function ReglasTable({ reglas, onEditar, onHistorial, onCambiarModo, onToggleActiva }: ReglasTableProps) {
    return (
        <Tabla>
            <TablaHead>
                <tr>
                    <th>Regla</th>
                    <th>Categoría</th>
                    <th>Modo</th>
                    <th>Frecuencia (min)</th>
                    <th>Estado</th>
                    <th>Sugerencias (7d)</th>
                    <th>Versión</th>
                    <th>Acciones</th>
                </tr>
            </TablaHead>
            <TablaBody>
                {reglas.map((regla) => (
                    <tr key={regla.id} className={regla.activa ? "" : "opacity-60"}>
                        <td>
                            <div className="font-medium text-body">{regla.nombre}</div>
                            <div className="text-xs text-muted">{regla.clave}</div>
                        </td>
                        <td className="text-sm text-body">{regla.categoria}</td>
                        <td>
                            {regla.modo === "EJECUTA" ? (
                                <Badge variant="danger">Ejecuta sola</Badge>
                            ) : (
                                <Badge variant="warning">Recomienda</Badge>
                            )}
                        </td>
                        <td className="text-sm text-body">{regla.frecuenciaMin}</td>
                        <td>
                            {regla.activa ? (
                                <Badge variant="success">Activa</Badge>
                            ) : (
                                <Badge variant="neutral">Inactiva</Badge>
                            )}
                        </td>
                        <td className="text-sm text-body">{regla.recomendacionesGeneradas7d}</td>
                        <td className="text-sm text-muted">v{regla.version}</td>
                        <td>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="ghost" onClick={() => onEditar(regla)}>
                                    Editar
                                </Button>
                                <Button variant="ghost" onClick={() => onHistorial(regla)}>
                                    Historial
                                </Button>
                                <Button variant="ghost" onClick={() => onToggleActiva(regla)}>
                                    {regla.activa ? "Desactivar" : "Activar"}
                                </Button>
                                <Button variant="ghost" onClick={() => onCambiarModo(regla)}>
                                    {regla.modo === "EJECUTA" ? "Cambiar a Recomienda" : "Cambiar a EJECUTA"}
                                </Button>
                            </div>
                        </td>
                    </tr>
                ))}
            </TablaBody>
        </Tabla>
    );
}
