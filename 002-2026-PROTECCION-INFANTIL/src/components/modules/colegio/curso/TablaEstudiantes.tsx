"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { AcudienteContacto } from "./AcudienteContacto";
import type { AcudienteVista } from "./AcudienteContacto";

/**
 * SPEC-147 (US2/US3, FR-004) — Tabla de estudiantes del curso (patrón ui/Tabla):
 * buscador por nombre/apellidos con debounce 280 ms (§9), columna acudiente con
 * contacto clicable (AcudienteContacto), badge de estado y acciones "Ver" (ficha
 * del estudiante) y activar/desactivar (endpoint existente, lo dispara el padre).
 * El orden alfabético (apellidos, nombre) viene del servidor; el filtro es local.
 */

export interface EstudianteFila {
    id: string;
    nombre: string;
    apellidos: string;
    estado: string;
    identificadores: { id: string }[];
    acudientes: AcudienteVista[];
}

interface TablaEstudiantesProps {
    estudiantes: EstudianteFila[];
    onToggleEstado: (estudiante: EstudianteFila) => void;
    /** Id del estudiante con cambio de estado en curso (botón en loading). */
    togglingId?: string | null;
}

const DEBOUNCE_MS = 280;

export function TablaEstudiantes({ estudiantes, onToggleEstado, togglingId = null }: TablaEstudiantesProps) {
    const [texto, setTexto] = useState("");
    const [filtro, setFiltro] = useState("");

    useEffect(() => {
        const temporizador = setTimeout(() => setFiltro(texto), DEBOUNCE_MS);
        return () => clearTimeout(temporizador);
    }, [texto]);

    const filtrados = useMemo(() => {
        const busqueda = filtro.trim().toLowerCase();
        if (!busqueda) return estudiantes;
        return estudiantes.filter((e) => `${e.nombre} ${e.apellidos}`.toLowerCase().includes(busqueda));
    }, [estudiantes, filtro]);

    return (
        <div className="space-y-4">
            <div className="max-w-sm">
                <Input
                    aria-label="Buscar por nombre"
                    placeholder="Buscar por nombre..."
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                />
            </div>

            <Tabla sinContenedor aria-label="Estudiantes del curso">
                <TablaHead variante="borde">
                    <tr className="text-subtle">
                        <th className="pb-3 font-medium">Estudiante</th>
                        <th className="pb-3 font-medium">Acudiente</th>
                        <th className="pb-3 font-medium">Estado</th>
                        <th className="pb-3 text-right font-medium">Acciones</th>
                    </tr>
                </TablaHead>
                <TablaBody>
                    {filtrados.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="py-6 text-center text-sm text-muted">
                                Sin resultados para «{filtro.trim()}».
                            </td>
                        </tr>
                    ) : (
                        filtrados.map((estudiante) => (
                            <tr key={estudiante.id} className="align-top">
                                <td className="py-3 pr-3">
                                    <Link
                                        href={`/dashboard/colegio/alumnos/${estudiante.id}`}
                                        className="font-medium text-body hover:text-accent hover:underline"
                                    >
                                        {estudiante.nombre} {estudiante.apellidos}
                                    </Link>
                                    <span className="block text-xs text-subtle">
                                        {estudiante.identificadores.length}{" "}
                                        {estudiante.identificadores.length === 1 ? "identificador" : "identificadores"}
                                    </span>
                                </td>
                                <td className="py-3 pr-3">
                                    <AcudienteContacto acudientes={estudiante.acudientes} />
                                </td>
                                <td className="py-3 pr-3">
                                    <Badge variant={estudiante.estado === "activo" ? "success" : "neutral"}>
                                        {estudiante.estado === "activo" ? "Activo" : "Inactivo"}
                                    </Badge>
                                </td>
                                <td className="py-3 text-right">
                                    <span className="inline-flex flex-wrap justify-end gap-2">
                                        <Link
                                            href={`/dashboard/colegio/alumnos/${estudiante.id}`}
                                            className="inline-flex min-h-12 items-center rounded-xl px-3 text-sm font-semibold text-accent transition hover:underline"
                                        >
                                            Ver
                                        </Link>
                                        <Button
                                            variant={estudiante.estado === "activo" ? "danger" : "secondary"}
                                            className="min-h-12 px-3 text-xs"
                                            isLoading={togglingId === estudiante.id}
                                            onClick={() => onToggleEstado(estudiante)}
                                        >
                                            {estudiante.estado === "activo" ? "Desactivar" : "Activar"}
                                        </Button>
                                    </span>
                                </td>
                            </tr>
                        ))
                    )}
                </TablaBody>
            </Tabla>
        </div>
    );
}
