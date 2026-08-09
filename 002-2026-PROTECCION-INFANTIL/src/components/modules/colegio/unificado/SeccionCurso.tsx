"use client";

import { useFetchJson } from "@/components/ui/use-fetch-json";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { GRADO_OPTIONS } from "@/lib/colegio/grados";
import type { CursoForm, ModoProfesor, ProfesorNuevoForm } from "./tipos";

/**
 * SPEC-146 (T005) — Sección 1 del wizard: datos del curso + profesor titular
 * (selector de existentes same-tenant vía GET /api/colegio/profesores, o "+
 * Nuevo" inline con nombre + apellidos — FR-007).
 */

interface Profesor {
    id: string;
    nombre: string;
    apellidos: string;
}

interface SeccionCursoProps {
    curso: CursoForm;
    onCursoChange: (curso: CursoForm) => void;
    modoProfesor: ModoProfesor;
    onModoProfesorChange: (modo: ModoProfesor) => void;
    profesorNuevo: ProfesorNuevoForm;
    onProfesorNuevoChange: (profesor: ProfesorNuevoForm) => void;
    errorNombre?: string | undefined;
}

export function SeccionCurso({
    curso,
    onCursoChange,
    modoProfesor,
    onModoProfesorChange,
    profesorNuevo,
    onProfesorNuevoChange,
    errorNombre,
}: SeccionCursoProps) {
    const { datos, cargando } = useFetchJson<{ items: Profesor[] }>("/api/colegio/profesores?pageSize=100");
    const profesores = datos?.items ?? [];

    return (
        <div className="space-y-4">
            <Input
                label="Nombre *"
                minLength={2}
                maxLength={150}
                value={curso.nombre}
                onChange={(e) => onCursoChange({ ...curso, nombre: e.target.value })}
                placeholder="Ej. 8° B"
                error={errorNombre}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                    label="Grado"
                    options={GRADO_OPTIONS}
                    value={curso.grado}
                    onChange={(e) => onCursoChange({ ...curso, grado: e.target.value })}
                />
                <Input
                    label="Año lectivo"
                    maxLength={20}
                    value={curso.anioLectivo}
                    onChange={(e) => onCursoChange({ ...curso, anioLectivo: e.target.value })}
                    placeholder="Ej. 2026"
                />
            </div>

            <fieldset>
                <legend className="mb-1.5 block text-sm font-medium text-body">Profesor titular (opcional)</legend>
                {modoProfesor === "existente" ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <Select
                            aria-label="Profesor titular"
                            options={[
                                {
                                    value: "",
                                    label: cargando ? "Cargando profesores…" : profesores.length === 0 ? "Aún no tienes profesores" : "Sin profesor titular",
                                },
                                ...profesores.map((p) => ({ value: p.id, label: `${p.nombre} ${p.apellidos}` })),
                            ]}
                            value={curso.profesorTitularId}
                            onChange={(e) => onCursoChange({ ...curso, profesorTitularId: e.target.value })}
                        />
                        <Button type="button" variant="outline" className="min-h-12 shrink-0" onClick={() => onModoProfesorChange("nuevo")}>
                            + Nuevo
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                label="Nombre del profesor"
                                maxLength={150}
                                value={profesorNuevo.nombre}
                                onChange={(e) => onProfesorNuevoChange({ ...profesorNuevo, nombre: e.target.value })}
                            />
                            <Input
                                label="Apellidos del profesor"
                                maxLength={150}
                                value={profesorNuevo.apellidos}
                                onChange={(e) => onProfesorNuevoChange({ ...profesorNuevo, apellidos: e.target.value })}
                            />
                        </div>
                        <Button type="button" variant="ghost" className="min-h-12" onClick={() => onModoProfesorChange("existente")}>
                            ← Elegir de la lista
                        </Button>
                    </div>
                )}
            </fieldset>
        </div>
    );
}
