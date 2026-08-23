"use client";

import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import type { WorkerLog, NivelLog } from "@prisma/client";

const VARIANTE_POR_NIVEL: Record<NivelLog, BadgeVariant> = {
    DEBUG: "info",
    INFO: "default",
    WARN: "warning",
    ERROR: "danger",
};

type LogsTableProps = {
    items: WorkerLog[];
    onVerContexto: (item: WorkerLog) => void;
};

function formatearFecha(fecha: Date): string {
    return new Date(fecha).toLocaleString("es-CO", { timeZone: "America/Bogota", year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

export function LogsTable({ items, onVerContexto }: LogsTableProps) {
    return (
        <Tabla>
            <TablaHead variante="borde">
                <tr className="text-subtle">
                    <th className="pb-3 font-medium">Fecha</th>
                    <th className="pb-3 font-medium">Servicio</th>
                    <th className="pb-3 font-medium">Nivel</th>
                    <th className="pb-3 font-medium">Mensaje</th>
                    <th className="pb-3 font-medium text-right">Acciones</th>
                </tr>
            </TablaHead>
            <TablaBody>
                {items.map((item) => (
                    <tr key={item.id} className="align-top">
                        <td className="py-3 pr-3 whitespace-nowrap text-body">
                            {formatearFecha(item.creadoEn)}
                        </td>
                        <td className="py-3 pr-3 text-body">{item.servicio}</td>
                        <td className="py-3 pr-3">
                            <Badge variant={VARIANTE_POR_NIVEL[item.nivel]}>{item.nivel}</Badge>
                        </td>
                        <td className="py-3 pr-3 text-body">{item.mensaje}</td>
                        <td className="py-3 text-right">
                            <Button
                                variant="outline"
                                className="px-3 py-1.5 text-xs"
                                disabled={!item.contextoJson}
                                onClick={() => onVerContexto(item)}
                            >
                                Ver contexto
                            </Button>
                        </td>
                    </tr>
                ))}
            </TablaBody>
        </Tabla>
    );
}
