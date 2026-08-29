"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ImportExcel } from "./ImportExcel";
import {
    DOCUMENTO_TIPO_OPCIONES,
    estudianteVacio,
    type AcudienteForm,
    type EstudianteForm,
    type ModoEstudiantes,
} from "./tipos";
import type { FilaListaValidada } from "@/lib/colegio/unificado/validar-lista";

/**
 * SPEC-146 (T005) — Sección 2 del wizard: estudiantes. Dos caminos (mockup
 * §5.3): "Uno por uno" (tabla editable inline: solo nombre + apellidos
 * obligatorios, documento y acudientes opcionales — máx 2) o "Excel/CSV"
 * (dry-run con vista previa §5.4 y "guardar solo los correctos").
 */

interface TablaEstudiantesProps {
    estudiantes: EstudianteForm[];
    onChange: (estudiantes: EstudianteForm[]) => void;
    errores: Record<string, string>;
    modo: ModoEstudiantes;
    onModoChange: (modo: ModoEstudiantes) => void;
    onImportar: (filas: FilaListaValidada[]) => void;
    nuevaClave: () => string;
}

export function TablaEstudiantes({ estudiantes, onChange, errores, modo, onModoChange, onImportar, nuevaClave }: TablaEstudiantesProps) {
    function actualizar(key: string, parcial: Partial<EstudianteForm>) {
        onChange(estudiantes.map((e) => (e.key === key ? { ...e, ...parcial } : e)));
    }

    function actualizarAcudiente(key: string, indice: number, parcial: Partial<AcudienteForm>) {
        const estudiante = estudiantes.find((e) => e.key === key);
        if (!estudiante) return;
        const acudientes = estudiante.acudientes.map((a, i) => (i === indice ? { ...a, ...parcial } : a));
        actualizar(key, { acudientes });
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Cómo agregarlos">
                <span className="text-sm font-medium text-body">Cómo agregarlos:</span>
                <Button type="button" variant={modo === "manual" ? "primary" : "outline"} className="min-h-12" onClick={() => onModoChange("manual")}>
                    Uno por uno
                </Button>
                <Button type="button" variant={modo === "excel" ? "primary" : "outline"} className="min-h-12" onClick={() => onModoChange("excel")}>
                    Excel/CSV
                </Button>
            </div>

            {modo === "excel" ? (
                <ImportExcel onAceptar={onImportar} />
            ) : (
                <>
                    {estudiantes.map((estudiante, indice) => (
                        <div key={estudiante.key} className="glass-input space-y-3 rounded-2xl p-4" aria-label={`Estudiante ${indice + 1}`}>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Input
                                    aria-label={`Nombre del estudiante ${indice + 1}`}
                                    placeholder="Nombre *"
                                    maxLength={150}
                                    value={estudiante.nombre}
                                    onChange={(e) => actualizar(estudiante.key, { nombre: e.target.value })}
                                />
                                <Input
                                    aria-label={`Apellidos del estudiante ${indice + 1}`}
                                    placeholder="Apellidos *"
                                    maxLength={150}
                                    value={estudiante.apellidos}
                                    onChange={(e) => actualizar(estudiante.key, { apellidos: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Select
                                    aria-label={`Tipo de documento del estudiante ${indice + 1}`}
                                    options={DOCUMENTO_TIPO_OPCIONES}
                                    value={estudiante.documentoTipo}
                                    onChange={(e) => actualizar(estudiante.key, { documentoTipo: e.target.value })}
                                />
                                <Input
                                    aria-label={`Número de documento del estudiante ${indice + 1}`}
                                    placeholder="Número de documento (opcional)"
                                    maxLength={50}
                                    value={estudiante.documentoNumero}
                                    onChange={(e) => actualizar(estudiante.key, { documentoNumero: e.target.value })}
                                />
                            </div>

                            {estudiante.acudientes.map((acudiente, indiceAcudiente) => (
                                <div key={indiceAcudiente} className="space-y-2 rounded-xl bg-tinta/5 p-3" aria-label={`Acudiente ${indiceAcudiente + 1} del estudiante ${indice + 1}`}>
                                    <p className="text-xs font-semibold text-subtle">Acudiente {indiceAcudiente + 1} (opcional)</p>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        <Input
                                            aria-label={`Nombre del acudiente ${indiceAcudiente + 1} del estudiante ${indice + 1}`}
                                            placeholder="Nombre del acudiente"
                                            maxLength={150}
                                            value={acudiente.nombre}
                                            onChange={(e) => actualizarAcudiente(estudiante.key, indiceAcudiente, { nombre: e.target.value })}
                                        />
                                        <Input
                                            aria-label={`Relación del acudiente ${indiceAcudiente + 1} del estudiante ${indice + 1}`}
                                            placeholder="Relación (madre, padre, tutor…)"
                                            maxLength={50}
                                            value={acudiente.relacion}
                                            onChange={(e) => actualizarAcudiente(estudiante.key, indiceAcudiente, { relacion: e.target.value })}
                                        />
                                        <Input
                                            aria-label={`Teléfono del acudiente ${indiceAcudiente + 1} del estudiante ${indice + 1}`}
                                            placeholder="Teléfono"
                                            maxLength={50}
                                            value={acudiente.telefono}
                                            onChange={(e) => actualizarAcudiente(estudiante.key, indiceAcudiente, { telefono: e.target.value })}
                                        />
                                        <Input
                                            aria-label={`Email del acudiente ${indiceAcudiente + 1} del estudiante ${indice + 1}`}
                                            placeholder="Email"
                                            maxLength={255}
                                            value={acudiente.email}
                                            onChange={(e) => actualizarAcudiente(estudiante.key, indiceAcudiente, { email: e.target.value })}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="min-h-12"
                                        onClick={() =>
                                            actualizar(estudiante.key, {
                                                acudientes: estudiante.acudientes.filter((_, i) => i !== indiceAcudiente),
                                            })
                                        }
                                    >
                                        Quitar acudiente
                                    </Button>
                                </div>
                            ))}

                            <div className="flex flex-wrap gap-2">
                                {estudiante.acudientes.length < 2 ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="min-h-12"
                                        onClick={() =>
                                            actualizar(estudiante.key, {
                                                acudientes: [...estudiante.acudientes, { nombre: "", relacion: "", telefono: "", email: "" }],
                                            })
                                        }
                                    >
                                        + Agregar acudiente
                                    </Button>
                                ) : null}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="min-h-12"
                                    aria-label={`Quitar estudiante ${indice + 1}`}
                                    onClick={() => onChange(estudiantes.filter((e) => e.key !== estudiante.key))}
                                >
                                    Quitar estudiante
                                </Button>
                            </div>

                            {errores[estudiante.key] ? (
                                <p role="alert" className="text-sm font-semibold text-estado-rubi">
                                    {errores[estudiante.key]}
                                </p>
                            ) : null}
                        </div>
                    ))}

                    <Button type="button" variant="outline" className="min-h-12 w-full" onClick={() => onChange([...estudiantes, estudianteVacio(nuevaClave())])}>
                        + Agregar otro estudiante
                    </Button>

                    <p className="text-sm text-muted">
                        ℹ Solo nombre y apellidos son obligatorios. El resto lo puedes completar después.
                    </p>
                </>
            )}
        </div>
    );
}
